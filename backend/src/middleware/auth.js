import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { ApiError, asyncHandler } from '../utils/http.js';
import { getDb } from '../db/index.js';

export function signUserToken(user) {
  return jwt.sign({ sub: user.id, role: 'user', phone: user.phone }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, role: admin.role, username: admin.username }, config.jwtSecret, { expiresIn: config.adminJwtExpiresIn });
}

export function authRequired(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== 'user') return next(new ApiError(403, 'User token required'));
    const db = getDb();
    const user = db.prepare(`SELECT id, name, phone, referral_code, points_balance, status, referred_by FROM users WHERE id = ?`).get(payload.sub);
    if (!user) return next(new ApiError(401, 'User not found'));
    if (user.status !== 'ACTIVE') return next(new ApiError(403, 'Account is ' + user.status));
    req.user = user;
    next();
  } catch (e) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

export function adminRequired(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Admin authentication required'));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') return next(new ApiError(403, 'Admin access required'));
    req.admin = payload;
    next();
  } catch (e) {
    next(new ApiError(401, 'Invalid or expired admin token'));
  }
}

// Optional auth: attaches user if token present, but doesn't fail
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role === 'user') {
      const db = getDb();
      const user = db.prepare(`SELECT id, name, phone, referral_code, points_balance, status FROM users WHERE id = ?`).get(payload.sub);
      if (user && user.status === 'ACTIVE') req.user = user;
    }
  } catch { /* ignore */ }
  next();
}

export { asyncHandler };
