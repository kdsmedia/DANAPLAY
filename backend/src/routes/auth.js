import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { authRequired, signUserToken, asyncHandler } from '../middleware/auth.js';
import { ApiError, ok } from '../utils/http.js';
import { uid, generateReferralCode, isValidPhone } from '../utils/index.js';
import { audit } from '../services/audit.js';
import { checkRegistrationFraud } from '../services/fraud.js';
import config from '../config/index.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(80),
  phone: z.string().min(8).max(15),
  password: z.string().min(config.passwordMinLength).max(100),
  referralCode: z.string().max(10).optional().nullable(),
  deviceFingerprint: z.string().max(200).optional().nullable(),
});

router.post('/register', asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Validation failed', parsed.error.flatten());
  const { name, phone, password, referralCode, deviceFingerprint } = parsed.data;

  if (!isValidPhone(phone)) throw new ApiError(400, 'Nomor HP tidak valid. Gunakan format 08xxxxxxxxxx');

  const db = getDb();
  const existing = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
  if (existing) throw new ApiError(409, 'Nomor HP sudah terdaftar');

  // Validate referral code if provided
  let inviter = null;
  if (referralCode) {
    inviter = db.prepare(`SELECT id, referral_code FROM users WHERE referral_code = ?`).get(referralCode);
    if (!inviter) throw new ApiError(400, 'Kode referral tidak valid');
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const id = uid('usr_');
  let referralCodeOwn = generateReferralCode();
  // ensure uniqueness
  while (db.prepare(`SELECT 1 FROM users WHERE referral_code = ?`).get(referralCodeOwn)) {
    referralCodeOwn = generateReferralCode();
  }

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, name, phone, password_hash, referral_code, referred_by, device_fingerprint, status)
      VALUES (?,?,?,?,?,?,?, 'ACTIVE')
    `).run(id, name, phone, passwordHash, referralCodeOwn, inviter ? inviter.referral_code : null, deviceFingerprint || null);

    if (inviter) {
      db.prepare(`
        INSERT INTO referrals (id, inviter_id, invitee_id, referral_code_used, status)
        VALUES (?,?,?,?, 'PENDING')
      `).run(uid('ref_'), inviter.id, id, inviter.referral_code);
    }
  });
  tx();

  // Fraud checks (post-insert). We log but do NOT block; admin can review.
  checkRegistrationFraud({ phone, referralCodeUsed: referralCode || null, inviterId: inviter?.id, inviteeId: id, deviceFingerprint });

  audit({ actorType: 'user', actorId: id, action: 'REGISTER', targetType: 'user', targetId: id, ip: req.ip });

  const user = db.prepare(`SELECT id, name, phone, referral_code, points_balance, referred_by FROM users WHERE id = ?`).get(id);
  const token = signUserToken(user);
  return ok(res, { user, token }, 201);
}));

const loginSchema = z.object({
  phone: z.string().min(8).max(15),
  password: z.string().min(1).max(100),
  deviceFingerprint: z.string().max(200).optional().nullable(),
});

router.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Validation failed', parsed.error.flatten());
  const { phone, password, deviceFingerprint } = parsed.data;

  const db = getDb();
  const user = db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone);
  if (!user) throw new ApiError(401, 'Nomor HP atau password salah');
  if (user.status !== 'ACTIVE') throw new ApiError(403, 'Akun ' + user.status);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new ApiError(401, 'Nomor HP atau password salah');

  db.prepare(`UPDATE users SET last_login_at = datetime('now'), device_fingerprint = COALESCE(?, device_fingerprint) WHERE id = ?`)
    .run(deviceFingerprint || null, user.id);

  audit({ actorType: 'user', actorId: user.id, action: 'LOGIN', ip: req.ip });

  const safe = { id: user.id, name: user.name, phone: user.phone, referral_code: user.referral_code, points_balance: user.points_balance, referred_by: user.referred_by };
  const token = signUserToken(safe);
  return ok(res, { user: safe, token });
}));

router.get('/me', authRequired, (req, res) => ok(res, { user: req.user }));

router.post('/logout', authRequired, asyncHandler(async (req, res) => {
  audit({ actorType: 'user', actorId: req.user.id, action: 'LOGOUT', ip: req.ip });
  return ok(res, { loggedOut: true });
}));

export default router;
