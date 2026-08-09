import { getDb } from '../db/index.js';
import { uid } from '../utils/index.js';

export function audit({ actorType = 'system', actorId = null, action, targetType = null, targetId = null, details = null, ip = null }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_logs (id, actor_type, actor_id, action, target_type, target_id, details, ip)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(uid('audit_'), actorType, actorId, action, targetType, targetId,
    details ? JSON.stringify(details) : null, ip);
}

export function listAudit({ limit = 100, offset = 0, actorId = null, targetType = null, action = null } = {}) {
  const db = getDb();
  const where = [];
  const params = [];
  if (actorId) { where.push('actor_id = ?'); params.push(actorId); }
  if (targetType) { where.push('target_type = ?'); params.push(targetType); }
  if (action) { where.push('action = ?'); params.push(action); }
  const sql = `SELECT * FROM audit_logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  return db.prepare(sql).all(...params, limit, offset);
}
