import { Router } from 'express';
import { authRequired, asyncHandler } from '../middleware/auth.js';
import { ok } from '../utils/http.js';
import { listNotifications, markRead, unreadCount } from '../services/notifications.js';

const router = Router();

router.get('/', authRequired, asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const items = listNotifications(req.user.id, { limit, offset });
  const unread = unreadCount(req.user.id);
  return ok(res, { items, unread });
}));

router.post('/:id/read', authRequired, asyncHandler(async (req, res) => {
  markRead(req.user.id, req.params.id);
  return ok(res, { read: true });
}));

export default router;
