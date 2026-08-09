import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { signAdminToken, adminRequired, asyncHandler } from '../middleware/auth.js';
import { ApiError, ok } from '../utils/http.js';
import { getDb } from '../db/index.js';
import { audit } from '../services/audit.js';

const router = Router();

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });
router.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Validation failed');
  const db = getDb();
  const admin = db.prepare(`SELECT * FROM admin_users WHERE username = ?`).get(parsed.data.username);
  if (!admin) throw new ApiError(401, 'Username atau password salah');
  const valid = await bcrypt.compare(parsed.data.password, admin.password_hash);
  if (!valid) throw new ApiError(401, 'Username atau password salah');
  db.prepare(`UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`).run(admin.id);
  audit({ actorType: 'admin', actorId: admin.id, action: 'ADMIN_LOGIN', ip: req.ip });
  const token = signAdminToken(admin);
  return ok(res, { admin: { id: admin.id, username: admin.username, role: admin.role }, token });
}));

router.get('/me', adminRequired, (req, res) => ok(res, { admin: req.admin }));

export default router;
