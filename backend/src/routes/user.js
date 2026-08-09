import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authRequired, asyncHandler } from '../middleware/auth.js';
import { ApiError, ok } from '../utils/http.js';
import { getDb } from '../db/index.js';
import config from '../config/index.js';
import { audit } from '../services/audit.js';

const router = Router();

const editSchema = z.object({ name: z.string().min(1).max(80) });
router.put('/profile', authRequired, asyncHandler(async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Validation failed', parsed.error.flatten());
  const db = getDb();
  db.prepare(`UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?`).run(parsed.data.name, req.user.id);
  audit({ actorType: 'user', actorId: req.user.id, action: 'UPDATE_PROFILE', targetType: 'user', targetId: req.user.id, ip: req.ip });
  const user = db.prepare(`SELECT id, name, phone, referral_code, points_balance, referred_by FROM users WHERE id = ?`).get(req.user.id);
  return ok(res, { user });
}));

const changePwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(config.passwordMinLength).max(100),
});
router.post('/change-password', authRequired, asyncHandler(async (req, res) => {
  const parsed = changePwSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Validation failed. Password min ' + config.passwordMinLength + ' karakter', parsed.error.flatten());
  const db = getDb();
  const user = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(req.user.id);
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password_hash);
  if (!valid) throw new ApiError(401, 'Password saat ini salah');
  const hash = await bcrypt.hash(parsed.data.newPassword, config.bcryptRounds);
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, req.user.id);
  audit({ actorType: 'user', actorId: req.user.id, action: 'CHANGE_PASSWORD', targetType: 'user', targetId: req.user.id, ip: req.ip });
  return ok(res, { changed: true });
}));

export default router;
