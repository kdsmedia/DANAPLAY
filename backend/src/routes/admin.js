import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { adminRequired, asyncHandler } from '../middleware/auth.js';
import { ApiError, ok } from '../utils/http.js';
import { getDb } from '../db/index.js';
import { uid, generateReferralCode } from '../utils/index.js';
import config from '../config/index.js';
import { audit } from '../services/audit.js';
import { applyPointTransaction } from '../services/pointLedger.js';
import { listAudit } from '../services/audit.js';
import { listFlags, updateFlag } from '../services/fraud.js';
import { getPayoutProvider, getAttributionProvider } from '../providers/index.js';

const router = Router();
router.use(adminRequired);

// ============ Dashboard ============
router.get('/dashboard', asyncHandler(async (req, res) => {
  const db = getDb();
  const q = (sql) => db.prepare(sql).get();
  const totalUsers = q(`SELECT COUNT(*) c FROM users`).c;
  const activeUsers = q(`SELECT COUNT(*) c FROM users WHERE status='ACTIVE'`).c;
  const activeCampaigns = q(`SELECT COUNT(*) c FROM campaigns WHERE status='ACTIVE'`).c;
  const completedCampaigns = q(`SELECT COUNT(*) c FROM campaign_users WHERE status='COMPLETED'`).c;
  const pointsInCirculation = q(`SELECT COALESCE(SUM(points_balance),0) s FROM users`).s;
  const pointsEarned = q(`SELECT COALESCE(SUM(amount),0) s FROM point_transactions WHERE amount > 0 AND status='CONFIRMED'`).s;
  const pointsRedeemed = q(`SELECT COALESCE(SUM(-amount),0) s FROM point_transactions WHERE amount < 0 AND type='REDEEM' AND status='CONFIRMED'`).s;
  const totalWithdrawals = q(`SELECT COUNT(*) c FROM withdrawals`).c;
  const withdrawalsPending = q(`SELECT COUNT(*) c FROM withdrawals WHERE status IN ('PENDING','PROCESSING')`).c;
  const withdrawalsCompleted = q(`SELECT COUNT(*) c FROM withdrawals WHERE status='COMPLETED'`).c;
  const withdrawalsFailed = q(`SELECT COUNT(*) c FROM withdrawals WHERE status='FAILED'`).c;
  const fraudOpen = q(`SELECT COUNT(*) c FROM fraud_flags WHERE status='OPEN'`).c;

  return ok(res, {
    totalUsers, activeUsers, activeCampaigns, completedCampaigns,
    pointsInCirculation, pointsEarned, pointsRedeemed,
    totalWithdrawals, withdrawalsPending, withdrawalsCompleted, withdrawalsFailed, fraudOpen,
    pointsPerRupiah: config.pointsPerRupiah,
    attributionProvider: getAttributionProvider().mode,
    payoutProvider: getPayoutProvider().mode,
  });
}));

// ============ Users ============
router.get('/users', asyncHandler(async (req, res) => {
  const db = getDb();
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const offset = Number(req.query.offset) || 0;
  const items = db.prepare(`
    SELECT u.id, u.name, u.phone, u.referral_code, u.referred_by, u.points_balance, u.status, u.created_at, u.last_login_at,
      (SELECT COUNT(*) FROM campaign_users cu WHERE cu.user_id=u.id AND cu.status='COMPLETED') AS completed_campaigns,
      (SELECT COUNT(*) FROM campaign_users cu WHERE cu.user_id=u.id AND cu.status IN ('CLICKED','INSTALLED','ACTIVE')) AS active_campaigns,
      (SELECT COUNT(*) FROM withdrawals w WHERE w.user_id=u.id) AS withdrawals_count
    FROM users u ORDER BY u.created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
  return ok(res, { items });
}));

router.get('/users/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  const u = db.prepare(`SELECT id, name, phone, referral_code, referred_by, points_balance, status, device_fingerprint, created_at, last_login_at FROM users WHERE id = ?`).get(req.params.id);
  if (!u) throw new ApiError(404, 'User not found');
  const txs = db.prepare(`SELECT * FROM point_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`).all(u.id);
  const campaigns = db.prepare(`SELECT cu.*, c.title FROM campaign_users cu JOIN campaigns c ON c.id=cu.campaign_id WHERE cu.user_id = ? ORDER BY cu.created_at DESC`).all(u.id);
  const withdrawals = db.prepare(`SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC`).all(u.id);
  return ok(res, { user: u, transactions: txs, campaigns, withdrawals });
}));

const userStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']) });
router.patch('/users/:id/status', asyncHandler(async (req, res) => {
  const parsed = userStatusSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid status');
  const db = getDb();
  db.prepare(`UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(parsed.data.status, req.params.id);
  audit({ actorType: 'admin', actorId: req.admin.sub, action: 'USER_STATUS_CHANGE',
    targetType: 'user', targetId: req.params.id, details: { status: parsed.data.status }, ip: req.ip });
  return ok(res, { updated: true });
}));

// Admin manual point adjustment (with audit)
const adjustSchema = z.object({ amount: z.number().int(), description: z.string().min(1).max(200) });
router.post('/users/:id/adjust-points', asyncHandler(async (req, res) => {
  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Validation failed');
  const result = applyPointTransaction({
    userId: req.params.id, type: 'ADJUSTMENT', amount: parsed.data.amount,
    description: parsed.data.description, referenceId: req.admin.sub, referenceType: 'admin'
  });
  audit({ actorType: 'admin', actorId: req.admin.sub, action: 'POINT_ADJUSTMENT',
    targetType: 'user', targetId: req.params.id,
    details: { amount: parsed.data.amount, description: parsed.data.description, txId: result.id }, ip: req.ip });
  return ok(res, { txId: result.id, balanceAfter: result.balanceAfter });
}));

// ============ Campaigns ============
const campaignSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  icon: z.string().default(''),
  package_name: z.string().min(1),
  store_url: z.string().url(),
  tracking_url: z.string().url(),
  reward_total: z.number().int().nonnegative().default(0),
  required_days: z.number().int().positive().default(15),
  daily_requirement: z.any().optional().nullable(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DRAFT']).default('ACTIVE'),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  milestones: z.array(z.object({
    milestone_id: z.string().min(1),
    label: z.string().min(1),
    day: z.number().int().nonnegative(),
    reward_points: z.number().int().nonnegative(),
    sort_order: z.number().int().default(0),
  })).default([]),
});

router.get('/campaigns', asyncHandler(async (req, res) => {
  const db = getDb();
  const items = db.prepare(`SELECT * FROM campaigns ORDER BY created_at DESC`).all();
  const enriched = items.map(c => ({
    ...c,
    milestones: db.prepare(`SELECT * FROM campaign_milestones WHERE campaign_id = ? ORDER BY sort_order, day`).all(c.id),
    daily_requirement: c.daily_requirement ? JSON.parse(c.daily_requirement) : null,
  }));
  return ok(res, { items: enriched });
}));

router.post('/campaigns', asyncHandler(async (req, res) => {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Validation failed', parsed.error.flatten());
  const c = parsed.data;
  const db = getDb();
  const id = uid('cmp_');
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO campaigns (id, title, description, icon, package_name, store_url, tracking_url,
        reward_total, required_days, daily_requirement, status, start_date, end_date)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(id, c.title, c.description, c.icon, c.package_name, c.store_url, c.tracking_url,
      c.reward_total, c.required_days, c.daily_requirement ? JSON.stringify(c.daily_requirement) : null,
      c.status, c.start_date || null, c.end_date || null);
    for (const m of c.milestones) {
      db.prepare(`
        INSERT INTO campaign_milestones (id, campaign_id, milestone_id, label, day, reward_points, sort_order)
        VALUES (?,?,?,?,?,?,?)
      `).run(uid('cm_'), id, m.milestone_id, m.label, m.day, m.reward_points, m.sort_order);
    }
  });
  tx();
  audit({ actorType: 'admin', actorId: req.admin.sub, action: 'CAMPAIGN_CREATE',
    targetType: 'campaign', targetId: id, details: c, ip: req.ip });
  return ok(res, { id }, 201);
}));

router.put('/campaigns/:id', asyncHandler(async (req, res) => {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Validation failed', parsed.error.flatten());
  const c = parsed.data;
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE campaigns SET title=?, description=?, icon=?, package_name=?, store_url=?, tracking_url=?,
        reward_total=?, required_days=?, daily_requirement=?, status=?, start_date=?, end_date=?, updated_at=datetime('now')
      WHERE id=?
    `).run(c.title, c.description, c.icon, c.package_name, c.store_url, c.tracking_url,
      c.reward_total, c.required_days, c.daily_requirement ? JSON.stringify(c.daily_requirement) : null,
      c.status, c.start_date || null, c.end_date || null, req.params.id);
    // Replace milestones
    db.prepare(`DELETE FROM campaign_milestones WHERE campaign_id = ?`).run(req.params.id);
    for (const m of c.milestones) {
      db.prepare(`
        INSERT INTO campaign_milestones (id, campaign_id, milestone_id, label, day, reward_points, sort_order)
        VALUES (?,?,?,?,?,?,?)
      `).run(uid('cm_'), req.params.id, m.milestone_id, m.label, m.day, m.reward_points, m.sort_order);
    }
  });
  tx();
  audit({ actorType: 'admin', actorId: req.admin.sub, action: 'CAMPAIGN_UPDATE',
    targetType: 'campaign', targetId: req.params.id, details: c, ip: req.ip });
  return ok(res, { updated: true });
}));

const campaignStatusSchema = z.object({ status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DRAFT']) });
router.patch('/campaigns/:id/status', asyncHandler(async (req, res) => {
  const parsed = campaignStatusSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid status');
  const db = getDb();
  db.prepare(`UPDATE campaigns SET status=?, updated_at=datetime('now') WHERE id=?`).run(parsed.data.status, req.params.id);
  audit({ actorType: 'admin', actorId: req.admin.sub, action: 'CAMPAIGN_STATUS',
    targetType: 'campaign', targetId: req.params.id, details: { status: parsed.data.status }, ip: req.ip });
  return ok(res, { updated: true });
}));

// ============ Campaign Users ============
router.get('/campaign-users', asyncHandler(async (req, res) => {
  const db = getDb();
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const offset = Number(req.query.offset) || 0;
  const items = db.prepare(`
    SELECT cu.*, c.title AS campaign_title, u.name AS user_name, u.phone AS user_phone
    FROM campaign_users cu
    JOIN campaigns c ON c.id = cu.campaign_id
    JOIN users u ON u.id = cu.user_id
    ORDER BY cu.created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
  return ok(res, { items });
}));

// ============ Point Transactions ============
router.get('/points', asyncHandler(async (req, res) => {
  const db = getDb();
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  const items = db.prepare(`
    SELECT pt.*, u.name AS user_name, u.phone AS user_phone
    FROM point_transactions pt JOIN users u ON u.id = pt.user_id
    ORDER BY pt.created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
  return ok(res, { items });
}));

// ============ Withdrawals ============
router.get('/withdrawals', asyncHandler(async (req, res) => {
  const db = getDb();
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  const items = db.prepare(`
    SELECT w.*, u.name AS user_name, u.phone AS user_phone
    FROM withdrawals w JOIN users u ON u.id = w.user_id
    ORDER BY w.created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
  return ok(res, { items });
}));

const wdStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  failureReason: z.string().optional().nullable(),
});
router.patch('/withdrawals/:id/status', asyncHandler(async (req, res) => {
  const parsed = wdStatusSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid status');
  const db = getDb();
  const w = db.prepare(`SELECT * FROM withdrawals WHERE id = ?`).get(req.params.id);
  if (!w) throw new ApiError(404, 'Withdrawal not found');
  // If marking FAILED and not yet refunded, refund.
  if (parsed.data.status === 'FAILED' && w.status !== 'FAILED' && !w.refund_transaction_id) {
    const { reverseTransaction } = await import('../services/pointLedger.js');
    const refund = reverseTransaction(w.point_transaction_id, 'admin marked failed: ' + (parsed.data.failureReason || ''));
    db.prepare(`UPDATE withdrawals SET status='FAILED', failure_reason=?, refund_transaction_id=?, processed_at=datetime('now') WHERE id=?`)
      .run(parsed.data.failureReason || 'Marked failed by admin', refund.id, w.id);
  } else {
    db.prepare(`UPDATE withdrawals SET status=?, failure_reason=?, processed_at=CASE WHEN ? IN ('COMPLETED','FAILED','CANCELLED') THEN datetime('now') ELSE processed_at END WHERE id=?`)
      .run(parsed.data.status, parsed.data.failureReason || null, parsed.data.status, w.id);
  }
  audit({ actorType: 'admin', actorId: req.admin.sub, action: 'WITHDRAWAL_STATUS_CHANGE',
    targetType: 'withdrawal', targetId: w.id, details: parsed.data, ip: req.ip });
  return ok(res, { updated: true });
}));

// ============ Referrals ============
router.get('/referrals', asyncHandler(async (req, res) => {
  const db = getDb();
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  const items = db.prepare(`
    SELECT r.*, i.name AS inviter_name, i.phone AS inviter_phone,
           e.name AS invitee_name, e.phone AS invitee_phone
    FROM referrals r
    JOIN users i ON i.id = r.inviter_id
    JOIN users e ON e.id = r.invitee_id
    ORDER BY r.created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
  return ok(res, { items });
}));

// ============ Fraud ============
router.get('/fraud', asyncHandler(async (req, res) => {
  const items = listFlags({ limit: 200, offset: 0, status: req.query.status, category: req.query.category });
  return ok(res, { items });
}));
const fraudStatusSchema = z.object({ status: z.enum(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED']) });
router.patch('/fraud/:id', asyncHandler(async (req, res) => {
  const parsed = fraudStatusSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Invalid status');
  updateFlag(req.params.id, parsed.data.status);
  audit({ actorType: 'admin', actorId: req.admin.sub, action: 'FRAUD_STATUS', targetType: 'fraud', targetId: req.params.id, details: parsed.data, ip: req.ip });
  return ok(res, { updated: true });
}));

// ============ Audit logs ============
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const items = listAudit({ limit: 200, offset: 0, action: req.query.action, targetType: req.query.targetType, actorId: req.query.actorId });
  return ok(res, { items });
}));

// ============ Settings ============
router.get('/settings', asyncHandler(async (req, res) => {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM settings`).all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return ok(res, { settings, withdrawalDenominations: config.withdrawalDenominations, pointsPerRupiah: config.pointsPerRupiah });
}));
const setSchema = z.object({ key: z.string().min(1), value: z.string() });
router.put('/settings', asyncHandler(async (req, res) => {
  const parsed = setSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Validation failed');
  const db = getDb();
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?,?,datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`).run(parsed.data.key, parsed.data.value);
  audit({ actorType: 'admin', actorId: req.admin.sub, action: 'SETTING_UPDATE', targetType: 'setting', targetId: parsed.data.key, details: parsed.data, ip: req.ip });
  return ok(res, { updated: true });
}));

// ============ Providers info ============
router.get('/providers', asyncHandler(async (req, res) => {
  const attr = getAttributionProvider();
  const pay = getPayoutProvider();
  return ok(res, {
    attribution: { name: attr.name, mode: attr.mode, description: attr.description() },
    payout: { name: pay.name, mode: pay.mode, description: pay.description() },
  });
}));

export default router;
