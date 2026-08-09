// Referral service: conditional bonus only after invitee qualifies (completes first campaign).
import { getDb } from '../db/index.js';
import { applyPointTransaction } from './pointLedger.js';
import { notify } from './notifications.js';
import { audit } from './audit.js';
import { flagFraud } from './fraud.js';

/**
 * Qualify a referral when invitee completes first campaign.
 * - Only pays bonus ONCE (referral.status goes PENDING -> QUALIFIED -> BONUS_PAID).
 * - Prevents self-referral (inviter != invitee enforced at registration, double-check here).
 * - Awards both inviter & invitee bonus per settings.
 */
export function qualifyReferral(inviteeUserId) {
  const db = getDb();
  const tx = db.transaction(() => {
    const ref = db.prepare(`SELECT * FROM referrals WHERE invitee_id = ?`).get(inviteeUserId);
    if (!ref) return { qualified: false, reason: 'no referral' };
    if (ref.status === 'BONUS_PAID') return { qualified: false, reason: 'already paid' };
    if (ref.status === 'REJECTED') return { qualified: false, reason: 'rejected' };

    // Anti-fraud: self referral
    if (ref.inviter_id === ref.invitee_id) {
      db.prepare(`UPDATE referrals SET status='REJECTED' WHERE id=?`).run(ref.id);
      flagFraud({ userId: inviteeUserId, category: 'SELF_REFERRAL', severity: 'HIGH',
        details: { referralId: ref.id } });
      return { qualified: false, reason: 'self referral rejected' };
    }

    // Verify invitee actually completed a campaign (defense in depth — caller already ensures this)
    const completed = db.prepare(`SELECT COUNT(*) c FROM campaign_users WHERE user_id=? AND status='COMPLETED'`).get(inviteeUserId);
    if (completed.c === 0) return { qualified: false, reason: 'no completed campaign' };

    const inviterBonus = Number(db.prepare(`SELECT value FROM settings WHERE key='referral_bonus_inviter'`).get()?.value || 0);
    const inviteeBonus = Number(db.prepare(`SELECT value FROM settings WHERE key='referral_bonus_invitee'`).get()?.value || 0);

    db.prepare(`UPDATE referrals SET status='BONUS_PAID', qualified_at=datetime('now'), bonus_paid_at=datetime('now'),
      inviter_bonus=?, invitee_bonus=? WHERE id=?`).run(inviterBonus, inviteeBonus, ref.id);

    if (inviterBonus > 0) {
      applyPointTransaction({ userId: ref.inviter_id, type: 'REFERRAL', amount: inviterBonus,
        description: `Bonus referral - teman menyelesaikan campaign pertama`, referenceId: ref.id, referenceType: 'referral' });
      notify({ userId: ref.inviter_id, title: '🎁 Bonus referral!',
        body: `+${inviterBonus.toLocaleString('id-ID')} poin. Teman yang Anda referral menyelesaikan campaign pertama.`,
        type: 'REFERRAL', metadata: { referralId: ref.id } });
    }
    if (inviteeBonus > 0) {
      applyPointTransaction({ userId: ref.invitee_id, type: 'REFERRAL', amount: inviteeBonus,
        description: `Bonus referral diterima - campaign pertama selesai`, referenceId: ref.id, referenceType: 'referral' });
      notify({ userId: ref.invitee_id, title: '🎁 Bonus referral diterima!',
        body: `+${inviteeBonus.toLocaleString('id-ID')} poin bonus referral.`,
        type: 'REFERRAL', metadata: { referralId: ref.id } });
    }
    audit({ actorType: 'system', action: 'REFERRAL_BONUS_PAID', targetType: 'referral', targetId: ref.id,
      details: { inviterBonus, inviteeBonus } });
    return { qualified: true, paid: true, inviterBonus, inviteeBonus };
  });
  return tx();
}
