import { getDb } from '../db/index.js';
import { uid } from '../utils/index.js';

export function notify({ userId, title, body, type = 'INFO', metadata = null }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, body, type, metadata)
    VALUES (?,?,?,?,?,?)
  `).run(uid('notif_'), userId, title, body, type, metadata ? JSON.stringify(metadata) : null);
}

export function listNotifications(userId, { limit = 50, offset = 0 } = {}) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(userId, limit, offset);
}

export function markRead(userId, notifId) {
  const db = getDb();
  return db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(notifId, userId);
}

export function unreadCount(userId) {
  const db = getDb();
  const r = db.prepare(`SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND is_read = 0`).get(userId);
  return r?.c || 0;
}
