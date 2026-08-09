import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/index.js';

let db = null;

export function getDb() {
  if (db) return db;
  const dbPath = config.dbPath;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
