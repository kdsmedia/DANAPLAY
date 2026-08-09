import { Router } from 'express';
import { authRequired, asyncHandler } from '../middleware/auth.js';
import { ok } from '../utils/http.js';
import { getDb } from '../db/index.js';

const router = Router();

// Get my referral info + list of referrals
router.get('/', authRequired, asyncHandler(async (req, res) => {
  const db = getDb();
  const me = db.prepare(`SELECT id, name, referral_code, referred_by FROM users WHERE id = ?`).get(req.user.id);
  const referrals = db.prepare(`
    SELECT r.id, r.status, r.invitee_id, r.bonus_paid_at, r.created_at,
           u.name AS invitee_name, u.points_balance AS invitee_points,
           u.status AS invitee_status
    FROM referrals r
    JOIN users u ON u.id = r.invitee_id
    WHERE r.inviter_id = ?
    ORDER BY r.created_at DESC
  `).all(req.user.id);
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'BONUS_PAID' THEN 1 ELSE 0 END) AS paid,
      SUM(CASE WHEN status = 'QUALIFIED' THEN 1 ELSE 0 END) AS qualified,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending
    FROM referrals WHERE inviter_id = ?
  `).get(req.user.id);
  return ok(res, { referralCode: me.referral_code, referredBy: me.referred_by, referrals, stats });
}));

export default router;
