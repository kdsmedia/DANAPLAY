import { getDb } from '../db/index.js';
import { uid } from '../utils/index.js';
import { audit } from './audit.js';

export function flagFraud({ userId = null, category, severity = 'MEDIUM', details = null }) {
  const db = getDb();
  const id = uid('fraud_');
  db.prepare(`
    INSERT INTO fraud_flags (id, user_id, category, severity, details, status)
    VALUES (?,?,?,?,?, 'OPEN')
  `).run(id, userId, category, severity, details ? JSON.stringify(details) : null);
  audit({ actorType: 'system', action: 'FRAUD_FLAG', targetType: 'user', targetId: userId, details: { category, severity, details } });
  return id;
}

// Detect self-referral and same-device multi-account at registration time.
export function checkRegistrationFraud({ phone, referralCodeUsed, inviterId, inviteeId, deviceFingerprint }) {
  const db = getDb();
  const flags = [];
  // Self-referral: invitee uses their own code (shouldn't happen pre-create, but check inviter==invitee)
  if (inviterId && inviteeId && inviterId === inviteeId) {
    flags.push(flagFraud({ userId: inviteeId, category: 'SELF_REFERRAL', severity: 'HIGH',
      details: { phone, referralCodeUsed } }));
  }
  // Same device multi-account
  if (deviceFingerprint) {
    const existing = db.prepare(`
      SELECT id, phone FROM users WHERE device_fingerprint = ? AND id != ?
    `).all(deviceFingerprint, inviteeId || '');
    if (existing.length) {
      flags.push(flagFraud({ userId: inviteeId, category: 'MULTI_ACCOUNT',
        severity: existing.length >= 3 ? 'HIGH' : 'MEDIUM',
        details: { deviceFingerprint, existingAccounts: existing } }));
    }
  }
  // Duplicate phone is enforced by UNIQUE constraint at registration.
  return flags;
}

// Detect duplicate enrollment of same campaign (prevented by partial unique index, but log attempts)
export function checkDuplicateEnrollment({ userId, campaignId }) {
  const db = getDb();
  const existing = db.prepare(`
    SELECT id, status FROM campaign_users WHERE user_id = ? AND campaign_id = ?
      AND status IN ('CLICKED','INSTALLED','ACTIVE')
  `).get(userId, campaignId);
  if (existing) {
    flagFraud({ userId, category: 'DUPLICATE_ENROLLMENT', severity: 'LOW',
      details: { campaignId, existingId: existing.id, status: existing.status } });
  }
  return existing;
}

// Detect withdrawal velocity abuse
export function checkWithdrawalAbuse({ userId }) {
  const db = getDb();
  const recent = db.prepare(`
    SELECT COUNT(*) c FROM withdrawals WHERE user_id = ? AND created_at > datetime('now','-1 hour')
  `).get(userId);
  if (recent.c >= 3) {
    flagFraud({ userId, category: 'WITHDRAWAL_ABUSE', severity: 'HIGH',
      details: { countInLastHour: recent.c } });
    return true;
  }
  return false;
}

export function listFlags({ limit = 100, offset = 0, status = null, category = null } = {}) {
  const db = getDb();
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (category) { where.push('category = ?'); params.push(category); }
  return db.prepare(`
    SELECT * FROM fraud_flags ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
}

export function updateFlag(id, status) {
  const db = getDb();
  return db.prepare(`UPDATE fraud_flags SET status = ? WHERE id = ?`).run(status, id);
}
