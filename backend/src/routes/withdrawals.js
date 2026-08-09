import { Router } from 'express';
import { z } from 'zod';
import { authRequired, asyncHandler } from '../middleware/auth.js';
import { ApiError, ok } from '../utils/http.js';
import { getDb } from '../db/index.js';
import { uid, isValidDanaNumber, rupiahToPoints } from '../utils/index.js';
import config from '../config/index.js';
import { applyPointTransaction, reverseTransaction } from '../services/pointLedger.js';
import { getPayoutProvider } from '../providers/payout.js';
import { checkWithdrawalAbuse } from '../services/fraud.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notifications.js';

const router = Router();

// Available denominations (server-side config; client cannot invent nominal)
router.get('/denominations', authRequired, asyncHandler(async (req, res) => {
  const db = getDb();
  const user = db.prepare(`SELECT points_balance FROM users WHERE id = ?`).get(req.user.id);
  const denom = config.withdrawalDenominations.map(amount => {
    const points = rupiahToPoints(amount, config.pointsPerRupiah);
    const enabled = user.points_balance >= points;
    return { amount, points, enabled, pointsPerRupiah: config.pointsPerRupiah };
  });
  return ok(res, { denominations: denom, balance: user.points_balance, pointsPerRupiah: config.pointsPerRupiah });
}));

const redeemSchema = z.object({
  amount: z.number().int().positive(),
  destination: z.string().min(8).max(15),
});
router.post('/', authRequired, asyncHandler(async (req, res) => {
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, 'Validation failed', parsed.error.flatten());
  const { amount, destination } = parsed.data;

  // Nominal must be one of fixed denominations — NO custom amount allowed
  if (!config.withdrawalDenominations.includes(amount)) {
    throw new ApiError(400, 'Nominal tidak valid. Pilih dari daftar yang tersedia.');
  }
  if (!isValidDanaNumber(destination)) {
    throw new ApiError(400, 'Nomor DANA tidak valid. Gunakan format 08xxxxxxxxxx');
  }

  const pointsNeeded = rupiahToPoints(amount, config.pointsPerRupiah);
  const db = getDb();
  const user = db.prepare(`SELECT points_balance FROM users WHERE id = ?`).get(req.user.id);
  if (user.points_balance < pointsNeeded) {
    throw new ApiError(400, 'Saldo poin tidak mencukupi');
  }

  checkWithdrawalAbuse({ userId: req.user.id });

  // Atomic: lock points (REDEEM) then create withdrawal row.
  const withdrawalId = uid('wd_');
  const tx = db.transaction(() => {
    // Debit points atomically (throws if insufficient under concurrency)
    const txResult = applyPointTransaction({
      userId: req.user.id,
      type: 'REDEEM',
      amount: -pointsNeeded,
      description: `Penukaran DANA Rp${amount.toLocaleString('id-ID')}`,
      referenceId: withdrawalId,
      referenceType: 'withdrawal',
    });
    const info = db.prepare(`
      INSERT INTO withdrawals (id, user_id, points, amount, method, destination, status, point_transaction_id)
      VALUES (?,?,?,?, 'DANA', ?, 'PENDING', ?)
    `).run(withdrawalId, req.user.id, pointsNeeded, amount, destination, txResult.id);
    return { txId: txResult.id, withdrawalRowId: info.lastInsertRowid };
  });
  const { txId } = tx();

  audit({ actorType: 'user', actorId: req.user.id, action: 'WITHDRAWAL_REQUEST',
    targetType: 'withdrawal', targetId: withdrawalId,
    details: { amount, points: pointsNeeded, destination }, ip: req.ip });

  // Attempt payout via provider (async-ish; here we call synchronously for mock, real provider would queue).
  const provider = getPayoutProvider();
  db.prepare(`UPDATE withdrawals SET status = 'PROCESSING' WHERE id = ?`).run(withdrawalId);

  let payoutResult;
  try {
    payoutResult = await provider.send({ amount, destination, reference: withdrawalId });
  } catch (e) {
    payoutResult = { status: 'FAILED', failureReason: 'Provider error: ' + e.message };
  }

  if (payoutResult.status === 'COMPLETED') {
    db.prepare(`
      UPDATE withdrawals SET status = 'COMPLETED', provider_reference = ?, processed_at = datetime('now') WHERE id = ?
    `).run(payoutResult.providerReference || null, withdrawalId);
    notify({ userId: req.user.id, title: '✅ Withdrawal berhasil',
      body: `Penukaran Rp${amount.toLocaleString('id-ID')} ke DANA ${destination} berhasil.`,
      type: 'WITHDRAWAL_COMPLETED', metadata: { withdrawalId } });
    return ok(res, { withdrawalId, status: 'COMPLETED', provider: provider.name, mode: provider.mode });
  } else if (payoutResult.status === 'PROCESSING') {
    notify({ userId: req.user.id, title: '⏳ Withdrawal diproses',
      body: `Penukaran Rp${amount.toLocaleString('id-ID')} sedang diproses.`,
      type: 'WITHDRAWAL_PROCESSING', metadata: { withdrawalId } });
    return ok(res, { withdrawalId, status: 'PROCESSING', provider: provider.name, mode: provider.mode });
  } else {
    // FAILED -> refund points atomically
    const refund = reverseTransaction(txId, 'payout failed: ' + (payoutResult.failureReason || 'unknown'));
    db.prepare(`
      UPDATE withdrawals SET status = 'FAILED', failure_reason = ?, refund_transaction_id = ?, processed_at = datetime('now') WHERE id = ?
    `).run(payoutResult.failureReason || 'Payout failed', refund.id, withdrawalId);
    notify({ userId: req.user.id, title: '❌ Withdrawal gagal',
      body: `Penukaran Rp${amount.toLocaleString('id-ID')} gagal. ${pointsNeeded.toLocaleString('id-ID')} poin telah dikembalikan.`,
      type: 'WITHDRAWAL_FAILED', metadata: { withdrawalId, refundTxId: refund.id } });
    audit({ actorType: 'system', action: 'WITHDRAWAL_FAILED_REFUNDED',
      targetType: 'withdrawal', targetId: withdrawalId,
      details: { reason: payoutResult.failureReason, refundTxId: refund.id } });
    return ok(res, { withdrawalId, status: 'FAILED', reason: payoutResult.failureReason, refunded: true, provider: provider.name, mode: provider.mode });
  }
}));

router.get('/', authRequired, asyncHandler(async (req, res) => {
  const db = getDb();
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const items = db.prepare(`
    SELECT id, points, amount, method, destination, status, failure_reason, created_at, processed_at
    FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(req.user.id, limit, offset);
  return ok(res, { items });
}));

export default router;
