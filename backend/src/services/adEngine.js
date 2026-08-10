// Ad-watching daily task service.
// Flow: list available ads -> start (creates view session + token) -> watch -> complete
//       (server validates elapsed time >= min, no-skip, idempotent) -> credit EARN via ledger.
//
// Anti-fraud / anti-spam:
//  - daily limit per user (date(started_at) based, server TZ)
//  - cooldown between views (seconds since last STARTED/COMPLETED)
//  - reward_granted flag + view_token UNIQUE => reward credited exactly once (idempotent)
//  - elapsed time measured server-side from started_at to completion; client never sets reward
//  - skipped flag set when client completes before min watch => reward NOT granted
import { getDb } from '../db/index.js';
import { uid, parseDate } from '../utils/index.js';
import { ApiError } from '../utils/http.js';
import config from '../config/index.js';
import { applyPointTransaction } from './pointLedger.js';
import { audit } from './audit.js';
import { flagFraud } from './fraud.js';

const fail = (status, message, code, extra = {}) => {
  const err = new ApiError(status, message, { code, ...extra });
  return err;
};

// Pick a dynamic ad by weight from the active pool.
export function pickWeightedAd() {
  const db = getDb();
  const pool = db.prepare(`
    SELECT * FROM ads WHERE status = 'ACTIVE'
      AND (start_date IS NULL OR start_date <= datetime('now'))
      AND (end_date IS NULL OR end_date >= datetime('now'))
  `).all();
  if (!pool.length) return null;
  const totalWeight = pool.reduce((s, a) => s + Math.max(1, a.weight), 0);
  let r = Math.random() * totalWeight;
  for (const a of pool) {
    r -= Math.max(1, a.weight);
    if (r <= 0) return a;
  }
  return pool[pool.length - 1];
}

// Count completed ad views today for a user.
export function countTodayViews(userId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT COUNT(*) c FROM ad_views
    WHERE user_id = ? AND date(started_at) = date('now')
      AND status IN ('STARTED','COMPLETED')
  `).get(userId);
  return row?.c ?? 0;
}

export function getDailyProgress(userId) {
  const db = getDb();
  const today = db.prepare(`
    SELECT COUNT(*) c FROM ad_views
    WHERE user_id = ? AND date(started_at) = date('now')
      AND status IN ('STARTED','COMPLETED')
  `).get(userId);
  const completed = db.prepare(`
    SELECT COUNT(*) c FROM ad_views
    WHERE user_id = ? AND date(started_at) = date('now') AND status = 'COMPLETED'
  `).get(userId);
  const earned = db.prepare(`
    SELECT COALESCE(SUM(amount),0) s FROM point_transactions
    WHERE user_id = ? AND type = 'EARN' AND reference_type = 'ad_view'
      AND date(created_at) = date('now')
  `).get(userId);
  // Cooldown applies after a completed (rewarded) view to prevent spamming the next one.
  const lastCompleted = db.prepare(`
    SELECT * FROM ad_views WHERE user_id = ? AND status = 'COMPLETED'
    ORDER BY completed_at DESC LIMIT 1
  `).get(userId);
  let cooldownEndsAt = null;
  if (lastCompleted) {
    const base = parseDate(lastCompleted.completed_at || lastCompleted.started_at);
    const ends = new Date(base.getTime() + config.adCooldownSeconds * 1000);
    if (ends > new Date()) cooldownEndsAt = ends.toISOString();
  }
  return {
    viewedToday: today?.c ?? 0,
    completedToday: completed?.c ?? 0,
    limit: config.adDailyLimit,
    remaining: Math.max(0, config.adDailyLimit - (today?.c ?? 0)),
    rewardPerView: config.adRewardPerView,
    minWatchSeconds: config.adMinWatchSeconds,
    cooldownSeconds: config.adCooldownSeconds,
    cooldownEndsAt,
    earnedToday: earned?.s ?? 0,
  };
}

/**
 * Start an ad view session. Picks a dynamic ad, enforces daily limit + cooldown.
 * Returns the ad + a one-time view_token + expires_at.
 */
export function startAdView(userId, { ip = null } = {}) {
  const db = getDb();
  const progress = getDailyProgress(userId);
  if (progress.viewedToday >= config.adDailyLimit) {
    throw fail(429, 'Batas tonton iklan harian tercapai', 'AD_DAILY_LIMIT');
  }
  if (progress.cooldownEndsAt) {
    throw fail(429, 'Cooldown aktif. Tunggu sebentar sebelum menonton iklan berikutnya.', 'AD_COOLDOWN', { cooldownEndsAt: progress.cooldownEndsAt });
  }

  const ad = pickWeightedAd();
  if (!ad) {
    throw fail(503, 'Tidak ada iklan tersedia saat ini', 'AD_UNAVAILABLE');
  }

  const now = new Date();
  const expires = new Date(now.getTime() + config.adViewTtlSeconds * 1000);
  const viewToken = uid('adview_');

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO ad_views (id, view_token, user_id, ad_id, status, reward_granted,
        started_at, expires_at, skipped)
      VALUES (?,?,?,?, 'STARTED', 0, ?, ?, 0)
    `).run(uid('av_'), viewToken, userId, ad.id, now.toISOString(), expires.toISOString());
  });
  tx();

  audit({ actorType: 'user', actorId: userId, action: 'AD_VIEW_STARTED',
    targetType: 'ad', targetId: ad.id, details: { viewToken }, ip });

  return {
    ad: {
      id: ad.id, title: ad.title, description: ad.description, advertiser: ad.advertiser,
      duration_seconds: ad.duration_seconds, reward_points: ad.reward_points,
    },
    viewToken,
    startedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    minWatchSeconds: config.adMinWatchSeconds,
  };
}

/**
 * Complete an ad view. Server validates:
 *  - token exists + belongs to user + not expired
 *  - elapsed (server now - started_at) >= min watch => not skipped
 *  - reward_granted == 0 (idempotent: second complete returns prior result, no double reward)
 * On success credits EARN via the point ledger (atomic).
 */
export function completeAdView(userId, viewToken, { ip = null } = {}) {
  const db = getDb();
  const view = db.prepare(`SELECT * FROM ad_views WHERE view_token = ?`).get(viewToken);
  if (!view || view.user_id !== userId) {
    throw fail(404, 'Sesi iklan tidak valid', 'AD_VIEW_NOT_FOUND');
  }
  if (view.status === 'COMPLETED' && view.reward_granted) {
    // Idempotent: already rewarded. Return prior result.
    return { alreadyCompleted: true, rewardGranted: 0, viewToken, status: 'COMPLETED' };
  }

  const now = new Date();
  const startedAt = parseDate(view.started_at);
  const expiresAt = parseDate(view.expires_at);
  const elapsedSec = (now.getTime() - startedAt.getTime()) / 1000;

  if (now > expiresAt) {
    db.prepare(`UPDATE ad_views SET status = 'EXPIRED', failure_reason = ? WHERE id = ?`)
      .run('view session expired before completion', view.id);
    throw fail(410, 'Sesi iklan telah berakhir. Mulai ulang iklan.', 'AD_VIEW_EXPIRED');
  }

  const skipped = elapsedSec < config.adMinWatchSeconds;
  if (skipped) {
    // Client attempted to complete before minimum watch => no reward. Mark FAILED.
    db.prepare(`
      UPDATE ad_views SET status = 'FAILED', skipped = 1,
        failure_reason = ?, completed_at = ? WHERE id = ?
    `).run(`completed after ${Math.floor(elapsedSec)}s (< ${config.adMinWatchSeconds}s min)`, now.toISOString(), view.id);
    flagFraud({ userId, category: 'AD_SKIP_ATTEMPT', severity: 'LOW',
      details: { viewToken, elapsedSec, min: config.adMinWatchSeconds } });
    audit({ actorType: 'user', actorId: userId, action: 'AD_VIEW_SKIPPED',
      targetType: 'ad', targetId: view.ad_id, details: { elapsedSec }, ip });
    throw fail(422, 'Iklan ditonton terlalu singkat. Reward hanya untuk tontonan penuh tanpa skip.', 'AD_SKIPPED');
  }

  const ad = db.prepare(`SELECT * FROM ads WHERE id = ?`).get(view.ad_id);
  const reward = ad?.reward_points ?? config.adRewardPerView;

  // Atomic: mark complete + grant reward once + ledger entry.
  const tx = db.transaction(() => {
    const cur = db.prepare(`SELECT status, reward_granted FROM ad_views WHERE id = ?`).get(view.id);
    if (cur.reward_granted) return { alreadyCompleted: true };
    db.prepare(`
      UPDATE ad_views SET status = 'COMPLETED', reward_granted = 1, skipped = 0, completed_at = ?
      WHERE id = ?
    `).run(now.toISOString(), view.id);
    return null;
  });
  const already = tx();
  if (already?.alreadyCompleted) {
    return { alreadyCompleted: true, rewardGranted: 0, viewToken, status: 'COMPLETED' };
  }

  const { balanceAfter } = applyPointTransaction({
    userId, type: 'EARN', amount: reward,
    description: `Reward tonton iklan: ${ad?.title || 'Iklan'}`,
    referenceId: view.id, referenceType: 'ad_view',
  });

  audit({ actorType: 'system', action: 'AD_REWARD_GRANTED', targetType: 'ad_view', targetId: view.id,
    details: { userId, adId: view.ad_id, reward }, ip });

  return { alreadyCompleted: false, rewardGranted: reward, viewToken, status: 'COMPLETED', balanceAfter };
}
