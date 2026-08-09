// Point ledger service. ALL point changes must go through here (atomic, with balance_before/after).
import { getDb } from '../db/index.js';
import { uid } from '../utils/index.js';

/**
 * Atomically credit/debit a user's points and append a ledger row.
 * Must be called inside a transaction (we open one ourselves here).
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {string} args.type - EARN|BONUS|REFERRAL|REDEEM|REFUND|ADJUSTMENT|EXPIRED
 * @param {number} args.amount - signed integer (+ credit / - debit)
 * @param {string} args.description
 * @param {string|null} args.referenceId
 * @param {string|null} args.referenceType
 * @returns {{tx: object, balanceAfter: number}}
 */
export function applyPointTransaction({ userId, type, amount, description, referenceId = null, referenceType = null }) {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error('amount must be a non-zero integer');
  }
  const db = getDb();
  const tx = db.transaction(() => {
    // Lock the user row by updating it; SELECT then UPDATE under the same tx is safe in WAL+busy_timeout.
    const user = db.prepare(`SELECT points_balance FROM users WHERE id = ?`).get(userId);
    if (!user) throw new Error('user not found');
    const balanceBefore = user.points_balance;
    const balanceAfter = balanceBefore + amount;
    if (balanceAfter < 0) {
      const err = new Error('Insufficient points');
      err.code = 'INSUFFICIENT_BALANCE';
      err.balanceBefore = balanceBefore;
      err.amount = amount;
      throw err;
    }
    db.prepare(`UPDATE users SET points_balance = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(balanceAfter, userId);
    const id = uid('ptx_');
    db.prepare(`
      INSERT INTO point_transactions
        (id, user_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, status)
      VALUES (?,?,?,?,?,?,?,?,?, 'CONFIRMED')
    `).run(id, userId, type, amount, balanceBefore, balanceAfter, description, referenceId, referenceType);
    return { id, balanceBefore, balanceAfter };
  });
  return tx();
}

export function listTransactions(userId, { limit = 100, offset = 0, type = null } = {}) {
  const db = getDb();
  const where = ['user_id = ?'];
  const params = [userId];
  if (type) { where.push('type = ?'); params.push(type); }
  return db.prepare(`
    SELECT * FROM point_transactions WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
}

export function getBalance(userId) {
  const db = getDb();
  const u = db.prepare(`SELECT points_balance FROM users WHERE id = ?`).get(userId);
  return u?.points_balance ?? 0;
}

export function reverseTransaction(transactionId, reason = 'reversal') {
  const db = getDb();
  const tx = db.transaction(() => {
    const orig = db.prepare(`SELECT * FROM point_transactions WHERE id = ?`).get(transactionId);
    if (!orig) throw new Error('transaction not found');
    if (orig.status === 'REVERSED') throw new Error('already reversed');
    db.prepare(`UPDATE point_transactions SET status = 'REVERSED' WHERE id = ?`).run(transactionId);
    // Apply opposite amount
    const user = db.prepare(`SELECT points_balance FROM users WHERE id = ?`).get(orig.user_id);
    const balanceBefore = user.points_balance;
    const balanceAfter = balanceBefore + (-orig.amount);
    if (balanceAfter < 0) throw new Error('cannot reverse: would go negative');
    db.prepare(`UPDATE users SET points_balance = ?, updated_at = datetime('now') WHERE id = ?`).run(balanceAfter, orig.user_id);
    const id = uid('ptx_');
    db.prepare(`
      INSERT INTO point_transactions
        (id, user_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, status)
      VALUES (?,?,?,?,?,?,?,?,?, 'CONFIRMED')
    `).run(id, orig.user_id, 'REFUND', -orig.amount, balanceBefore, balanceAfter,
      `Reversal of ${transactionId}: ${reason}`, orig.id, 'reversal');
    return { id, balanceAfter };
  });
  return tx();
}
