// Campaign 15-day engine: processes attribution events, dedups active days,
// awards milestone rewards, marks completion/failure. All server-side, idempotent.
import { getDb } from '../db/index.js';
import { uid, todayInTz, nowIso } from '../utils/index.js';
import config from '../config/index.js';
import { applyPointTransaction } from './pointLedger.js';
import { notify } from './notifications.js';
import { audit } from './audit.js';
import { flagFraud } from './fraud.js';
import { qualifyReferral } from './referral.js';

const CAMPAIGN_TZ = () => {
  const db = getDb();
  const s = db.prepare(`SELECT value FROM settings WHERE key = 'campaign_timezone'`).get();
  return s?.value || 'Asia/Jakarta';
};

/**
 * Process an attribution event for a campaign_user enrollment.
 * Idempotent: if event_id already exists, returns { processed: false, reason: 'duplicate' }.
 *
 * @param {object} args
 * @param {string} args.trackingSessionId  (or campaignUserId)
 * @param {string} args.eventType  canonical (INSTALL, FIRST_OPEN, DAILY_ACTIVE, ...)
 * @param {string} args.eventId    partner id
 * @param {string} args.eventTime  ISO
 * @param {object} args.metadata
 */
export function processAttributionEvent({ trackingSessionId = null, campaignUserId = null, eventType, eventId = null, eventTime, metadata = {} }) {
  const db = getDb();

  return db.transaction(() => {
    // Resolve enrollment
    let cu;
    if (campaignUserId) {
      cu = db.prepare(`SELECT * FROM campaign_users WHERE id = ?`).get(campaignUserId);
    } else if (trackingSessionId) {
      cu = db.prepare(`SELECT * FROM campaign_users WHERE tracking_session_id = ?`).get(trackingSessionId);
    }
    if (!cu) {
      const e = new Error('Enrollment not found for tracking session / campaign_user');
      e.code = 'ENROLLMENT_NOT_FOUND';
      throw e;
    }
    if (cu.status === 'COMPLETED' || cu.status === 'CANCELLED' || cu.status === 'EXPIRED') {
      return { processed: false, reason: 'campaign already ' + cu.status };
    }

    // Idempotency: dedup by (campaign_user_id, event_id) if event_id present
    if (eventId) {
      const dup = db.prepare(`SELECT id FROM campaign_events WHERE campaign_user_id = ? AND event_id = ?`).get(cu.id, eventId);
      if (dup) {
        flagFraud({ userId: cu.user_id, category: 'DUPLICATE_EVENT', severity: 'LOW',
          details: { campaignUserId: cu.id, eventId, eventType } });
        return { processed: false, reason: 'duplicate event_id' };
      }
    }

    const campaign = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(cu.campaign_id);
    if (!campaign) throw new Error('campaign missing');

    const tz = CAMPAIGN_TZ();
    // Date in campaign tz derived from event time (not "now") so backdated/forward-dated
    // events map to the correct calendar day for active-day dedup.
    const eventDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(eventTime || nowIso()));

    // Compute day index based on first_open_at
    let dayIndex = null;
    if (eventType === 'FIRST_OPEN' || eventType === 'INSTALL') {
      dayIndex = 0;
    } else if (cu.first_open_at) {
      const start = new Date(cu.first_open_at);
      const now = new Date(eventTime || nowIso());
      const days = Math.floor((now - start) / 86400000);
      dayIndex = Math.max(0, days); // 0-based from first_open; milestone days are 1-based
    }

    // Insert raw event
    db.prepare(`
      INSERT INTO campaign_events (id, campaign_user_id, event_type, event_id, event_time, day_index, metadata)
      VALUES (?,?,?,?,?,?,?)
    `).run(uid('ev_'), cu.id, eventType, eventId, eventTime || nowIso(), dayIndex, JSON.stringify(metadata));

    // Update last_event_at
    db.prepare(`UPDATE campaign_users SET last_event_at = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(eventTime || nowIso(), cu.id);

    const results = { processed: true, statusBefore: cu.status, events: [] };

    // ---- State transitions ----
    if (eventType === 'INSTALL' && cu.status === 'CLICKED') {
      db.prepare(`UPDATE campaign_users SET status = 'INSTALLED', install_at = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(eventTime || nowIso(), cu.id);
      cu.status = 'INSTALLED';
      results.events.push('INSTALL');
      // Award INSTALL milestone (day=0) if exists
      tryAwardMilestone(cu, campaign, 0, 'INSTALL', db);
    }

    if (eventType === 'FIRST_OPEN') {
      if (!cu.first_open_at) {
        db.prepare(`UPDATE campaign_users SET first_open_at = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(eventTime || nowIso(), cu.id);
        cu.first_open_at = eventTime || nowIso();
      }
      if (cu.status === 'CLICKED' || cu.status === 'INSTALLED') {
        db.prepare(`UPDATE campaign_users SET status = 'ACTIVE', install_at = COALESCE(install_at, ?), updated_at = datetime('now') WHERE id = ?`)
          .run(eventTime || nowIso(), cu.id);
        cu.status = 'ACTIVE';
      }
      results.events.push('FIRST_OPEN');
    }

    // Daily active: dedup by date. Counts unique active days only.
    if (['DAILY_ACTIVE', 'APP_OPEN', 'GAME_SESSION', 'LEVEL_REACHED', 'TASK_COMPLETED'].includes(eventType)) {
      if (cu.first_open_at) {
        // Insert active day (unique by date)
        const start = new Date(cu.first_open_at);
        const dIdx = Math.max(1, Math.floor((new Date(eventTime || nowIso()) - start) / 86400000) + 1);
        try {
          db.prepare(`
            INSERT INTO campaign_active_days (id, campaign_user_id, day_date, day_index)
            VALUES (?,?,?,?)
          `).run(uid('ad_'), cu.id, eventDate, dIdx);
        } catch (e) {
          if (!String(e.message).includes('UNIQUE')) throw e;
          // already counted today
        }
        const active = db.prepare(`SELECT COUNT(*) c FROM campaign_active_days WHERE campaign_user_id = ?`).get(cu.id);
        db.prepare(`UPDATE campaign_users SET active_days = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(active.c, cu.id);
        cu.active_days = active.c;

        // Try milestone awards for day milestones up to active_days
        const milestones = db.prepare(`SELECT * FROM campaign_milestones WHERE campaign_id = ? AND day > 0 ORDER BY day ASC`).all(campaign.id);
        for (const m of milestones) {
          if (cu.active_days >= m.day) {
            tryAwardMilestone(cu, campaign, m.day, m.milestone_id, db);
          }
        }

        // Completion check
        if (cu.active_days >= campaign.required_days && cu.status === 'ACTIVE') {
          db.prepare(`UPDATE campaign_users SET status = 'COMPLETED', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(cu.id);
          cu.status = 'COMPLETED';
          notify({ userId: cu.user_id, title: '🎉 Campaign selesai!',
            body: `${campaign.title} berhasil diselesaikan selama ${campaign.required_days} hari.`,
            type: 'CAMPAIGN_COMPLETED', metadata: { campaignUserId: cu.id } });
          results.events.push('COMPLETED');
          // Trigger referral qualification (invitee completed first campaign)
          tryReferralQualification(cu.user_id);
        }
      }
    }

    // UNINSTALL: mark FAILED only when truly signalled (per requirements, only on real partner signal)
    if (eventType === 'UNINSTALL') {
      if (cu.status === 'ACTIVE' || cu.status === 'INSTALLED') {
        db.prepare(`UPDATE campaign_users SET status = 'FAILED', failed_at = datetime('now'), fail_reason = 'UNINSTALL signal from attribution partner', updated_at = datetime('now') WHERE id = ?`).run(cu.id);
        cu.status = 'FAILED';
        notify({ userId: cu.user_id, title: '⚠️ Campaign gagal',
          body: `${campaign.title} dinyatakan gagal: aplikasi di-uninstall sebelum persyaratan selesai. Reward penyelesaian tidak diberikan.`,
          type: 'CAMPAIGN_FAILED', metadata: { campaignUserId: cu.id } });
        results.events.push('FAILED');
      }
    }

    // CAMPAIGN_COMPLETED direct event from partner (e.g. level reached final)
    if (eventType === 'CAMPAIGN_COMPLETED' && cu.status === 'ACTIVE') {
      db.prepare(`UPDATE campaign_users SET status = 'COMPLETED', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(cu.id);
      cu.status = 'COMPLETED';
      notify({ userId: cu.user_id, title: '🎉 Campaign selesai!',
        body: `${campaign.title} diselesaikan (partner event CAMPAIGN_COMPLETED).`,
        type: 'CAMPAIGN_COMPLETED', metadata: { campaignUserId: cu.id } });
      results.events.push('COMPLETED');
      tryReferralQualification(cu.user_id);
    }

    results.statusAfter = cu.status;
    results.activeDays = cu.active_days;
    return results;
  })();
}

function tryAwardMilestone(cu, campaign, day, milestoneId, db) {
  // Unique constraint on (campaign_user_id, milestone_id) prevents double reward.
  const milestone = db.prepare(`SELECT * FROM campaign_milestones WHERE campaign_id = ? AND milestone_id = ?`).get(campaign.id, milestoneId);
  if (!milestone) return false;
  if (milestone.reward_points <= 0) return false;

  // Try insert reward row; if exists, skip (idempotent)
  try {
    const rewardId = uid('cmr_');
    db.prepare(`
      INSERT INTO campaign_milestone_rewards (id, campaign_user_id, milestone_id, points_awarded)
      VALUES (?,?,?,?)
    `).run(rewardId, cu.id, milestoneId, milestone.reward_points);

    // Award points via ledger (atomic)
    const txResult = applyPointTransaction({
      userId: cu.user_id,
      type: 'EARN',
      amount: milestone.reward_points,
      description: `${milestone.label} - ${campaign.title}`,
      referenceId: cu.id,
      referenceType: 'campaign_milestone',
    });
    db.prepare(`UPDATE campaign_milestone_rewards SET point_transaction_id = ? WHERE id = ?`).run(txResult.id, rewardId);

    notify({ userId: cu.user_id, title: '⭐ Reward masuk!',
      body: `+${milestone.reward_points.toLocaleString('id-ID')} poin dari ${campaign.title} (${milestone.label}).`,
      type: 'REWARD', metadata: { campaignUserId: cu.id, milestoneId } });
    audit({ actorType: 'system', action: 'MILESTONE_REWARD',
      targetType: 'campaign_user', targetId: cu.id,
      details: { milestoneId, points: milestone.reward_points, txId: txResult.id } });
    return true;
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      // already rewarded — idempotent, no-op
      return false;
    }
    throw e;
  }
}

// Trigger referral qualification when invitee completes their first campaign.
function tryReferralQualification(inviteeUserId) {
  try {
    qualifyReferral(inviteeUserId);
  } catch (e) {
    audit({ actorType: 'system', action: 'REFERRAL_QUALIFY_FAILED',
      targetType: 'user', targetId: inviteeUserId, details: { error: e.message } });
  }
}
