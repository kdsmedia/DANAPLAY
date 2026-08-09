import { Router } from 'express';
import { authRequired, asyncHandler } from '../middleware/auth.js';
import { ApiError, ok } from '../utils/http.js';
import { getDb } from '../db/index.js';
import { uid } from '../utils/index.js';
import { audit } from '../services/audit.js';
import { checkDuplicateEnrollment } from '../services/fraud.js';

const router = Router();

function withMilestones(campaign) {
  if (!campaign) return null;
  const db = getDb();
  const milestones = db.prepare(`
    SELECT * FROM campaign_milestones WHERE campaign_id = ? ORDER BY sort_order ASC, day ASC
  `).all(campaign.id);
  return { ...campaign, milestones };
}

// List active campaigns (public-ish, but we require auth to personalize)
router.get('/', authRequired, asyncHandler(async (req, res) => {
  const db = getDb();
  const campaigns = db.prepare(`
    SELECT * FROM campaigns WHERE status = 'ACTIVE' ORDER BY created_at DESC
  `).all();
  // attach user's active enrollment status if any (completed/failed allowed to re-show? no — exclude ACTIVE ones)
  const enrolled = db.prepare(`
    SELECT campaign_id, status FROM campaign_users
    WHERE user_id = ? AND status IN ('CLICKED','INSTALLED','ACTIVE')
  `).all(req.user.id);
  const enrolledMap = new Map(enrolled.map(e => [e.campaign_id, e.status]));
  const items = campaigns.map(withMilestones).map(c => ({
    ...c, enrolled_status: enrolledMap.get(c.id) || null,
    daily_requirement: c.daily_requirement ? JSON.parse(c.daily_requirement) : null,
  }));
  return ok(res, { items });
}));

router.get('/:id', authRequired, asyncHandler(async (req, res) => {
  const db = getDb();
  const c = db.prepare(`SELECT * FROM campaigns WHERE id = ? AND status = 'ACTIVE'`).get(req.params.id);
  if (!c) throw new ApiError(404, 'Campaign tidak ditemukan');
  const campaign = withMilestones(c);
  campaign.daily_requirement = campaign.daily_requirement ? JSON.parse(campaign.daily_requirement) : null;
  // attach enrollment if any
  const enroll = db.prepare(`
    SELECT * FROM campaign_users WHERE user_id = ? AND campaign_id = ?
      AND status IN ('CLICKED','INSTALLED','ACTIVE','COMPLETED','FAILED','EXPIRED','CANCELLED')
    ORDER BY created_at DESC LIMIT 1
  `).get(req.user.id, c.id);
  return ok(res, { campaign, enrollment: enroll || null });
}));

// CLICK / DOWNLOAD: create tracking session, redirect to tracking_url
router.post('/:id/click', authRequired, asyncHandler(async (req, res) => {
  const db = getDb();
  const c = db.prepare(`SELECT * FROM campaigns WHERE id = ? AND status = 'ACTIVE'`).get(req.params.id);
  if (!c) throw new ApiError(404, 'Campaign tidak ditemukan');

  // Prevent duplicate active enrollment (partial unique index enforces, but we also flag)
  checkDuplicateEnrollment({ userId: req.user.id, campaignId: c.id });

  const trackingSessionId = uid('ts_');
  const clickId = uid('clk_');
  let enrollmentId;
  try {
    const tx = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO campaign_users (id, user_id, campaign_id, tracking_session_id, click_id, status)
        VALUES (?,?,?,?,?, 'CLICKED')
      `).run(uid('cu_'), req.user.id, c.id, trackingSessionId, clickId);
      enrollmentId = info.lastInsertRowid;
    });
    tx();
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      throw new ApiError(409, 'Anda sudah terdaftar di campaign ini dan masih aktif.');
    }
    throw e;
  }

  audit({ actorType: 'user', actorId: req.user.id, action: 'CAMPAIGN_CLICK',
    targetType: 'campaign', targetId: c.id, details: { enrollmentId, trackingSessionId, clickId }, ip: req.ip });

  // Build tracking URL with our session identifiers so partner can echo them back in postback.
  const trackingUrl = new URL(c.tracking_url);
  trackingUrl.searchParams.set('danaplay_click_id', clickId);
  trackingUrl.searchParams.set('danaplay_session', trackingSessionId);
  trackingUrl.searchParams.set('danaplay_user', req.user.id);
  trackingUrl.searchParams.set('danaplay_campaign', c.id);

  return ok(res, {
    enrollmentId, trackingSessionId, clickId,
    redirectUrl: trackingUrl.toString(),
    storeUrl: c.store_url,
    status: 'CLICKED',
    note: 'Reward tidak diberikan hanya karena klik download. Install & aktivitas harus diverifikasi via attribution postback.'
  });
}));

// My active campaigns
router.get('/my/active', authRequired, asyncHandler(async (req, res) => {
  const db = getDb();
  const items = db.prepare(`
    SELECT cu.*, c.title, c.icon, c.package_name, c.store_url, c.required_days, c.reward_total
    FROM campaign_users cu
    JOIN campaigns c ON c.id = cu.campaign_id
    WHERE cu.user_id = ? AND cu.status IN ('CLICKED','INSTALLED','ACTIVE','COMPLETED','FAILED','EXPIRED')
    ORDER BY cu.updated_at DESC
  `).all(req.user.id);
  // attach milestones + rewards earned
  const enriched = items.map(it => {
    const milestones = db.prepare(`SELECT * FROM campaign_milestones WHERE campaign_id = ? ORDER BY sort_order, day`).all(it.campaign_id);
    const earned = db.prepare(`SELECT milestone_id, points_awarded FROM campaign_milestone_rewards WHERE campaign_user_id = ?`).all(it.id);
    const activeDays = db.prepare(`SELECT day_date, day_index FROM campaign_active_days WHERE campaign_user_id = ? ORDER BY day_index`).all(it.id);
    return { ...it, milestones, earnedRewards: earned, activeDays };
  });
  return ok(res, { items: enriched });
}));

// Progress detail for one enrollment
router.get('/my/:enrollmentId', authRequired, asyncHandler(async (req, res) => {
  const db = getDb();
  const cu = db.prepare(`SELECT * FROM campaign_users WHERE id = ? AND user_id = ?`).get(req.params.enrollmentId, req.user.id);
  if (!cu) throw new ApiError(404, 'Enrollment tidak ditemukan');
  const c = db.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(cu.campaign_id);
  const milestones = db.prepare(`SELECT * FROM campaign_milestones WHERE campaign_id = ? ORDER BY sort_order, day`).all(cu.campaign_id);
  const earned = db.prepare(`SELECT milestone_id, points_awarded, created_at FROM campaign_milestone_rewards WHERE campaign_user_id = ?`).all(cu.id);
  const activeDays = db.prepare(`SELECT day_date, day_index FROM campaign_active_days WHERE campaign_user_id = ? ORDER BY day_index`).all(cu.id);
  const events = db.prepare(`SELECT event_type, event_time, day_index, created_at FROM campaign_events WHERE campaign_user_id = ? ORDER BY created_at DESC LIMIT 50`).all(cu.id);
  return ok(res, {
    enrollment: cu, campaign: c, milestones, earnedRewards: earned, activeDays, recentEvents: events
  });
}));

export default router;
