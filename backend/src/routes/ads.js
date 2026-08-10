// Ad-watching daily task routes. All reward logic is server-side.
import { Router } from 'express';
import { authRequired, asyncHandler } from '../middleware/auth.js';
import { ok } from '../utils/http.js';
import { getDb } from '../db/index.js';
import config from '../config/index.js';
import { getDailyProgress, startAdView, completeAdView } from '../services/adEngine.js';

const router = Router();

// List active ads (dynamic inventory)
router.get('/', authRequired, asyncHandler(async (req, res) => {
  const db = getDb();
  const ads = db.prepare(`
    SELECT id, title, description, advertiser, duration_seconds, reward_points, weight, status
    FROM ads WHERE status = 'ACTIVE'
      AND (start_date IS NULL OR start_date <= datetime('now'))
      AND (end_date IS NULL OR end_date >= datetime('now'))
    ORDER BY weight DESC, created_at DESC
  `).all();
  return ok(res, { items: ads });
}));

// Daily progress + config for the daily ad task
router.get('/daily', authRequired, asyncHandler(async (req, res) => {
  const progress = getDailyProgress(req.user.id);
  return ok(res, {
    ...progress,
    dailyLimit: config.adDailyLimit,
    rewardPerView: config.adRewardPerView,
    minWatchSeconds: config.adMinWatchSeconds,
    cooldownSeconds: config.adCooldownSeconds,
  });
}));

// Start an ad view session — server picks a dynamic ad, enforces limit + cooldown.
router.post('/start', authRequired, asyncHandler(async (req, res) => {
  const session = startAdView(req.user.id, { ip: req.ip });
  return ok(res, session, 201);
}));

// Complete an ad view — server validates elapsed time (no-skip) and grants reward atomically.
router.post('/view/:viewToken/complete', authRequired, asyncHandler(async (req, res) => {
  const result = completeAdView(req.user.id, req.params.viewToken, { ip: req.ip });
  return ok(res, result);
}));

export default router;
