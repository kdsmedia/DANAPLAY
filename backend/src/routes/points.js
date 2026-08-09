import { Router } from 'express';
import { authRequired, asyncHandler } from '../middleware/auth.js';
import { ok } from '../utils/http.js';
import { listTransactions, getBalance } from '../services/pointLedger.js';
import config from '../config/index.js';
import { pointsToRupiah, formatRupiah } from '../utils/index.js';

const router = Router();

router.get('/balance', authRequired, asyncHandler(async (req, res) => {
  const balance = getBalance(req.user.id);
  const rupiah = pointsToRupiah(balance, config.pointsPerRupiah);
  return ok(res, { points: balance, rupiah, pointsPerRupiah: config.pointsPerRupiah });
}));

router.get('/transactions', authRequired, asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const offset = Number(req.query.offset) || 0;
  const type = req.query.type || null;
  const items = listTransactions(req.user.id, { limit, offset, type });
  return ok(res, { items });
}));

export default router;
