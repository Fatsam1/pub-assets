import Database from 'better-sqlite3';

const db = new Database('data.sqlite');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  headline TEXT,
  subheadline TEXT,
  body TEXT,
  button_text TEXT DEFAULT 'سجل الآن',
  fields TEXT DEFAULT '["name","phone"]',
  theme TEXT DEFAULT 'dark',
  pixel TEXT,
  active INTEGER DEFAULT 1,
  views INTEGER DEFAULT 0,
  template_id TEXT DEFAULT 't001',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id INTEGER NOT NULL,
  data TEXT NOT NULL,
  ip TEXT,
  ua TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires INTEGER NOT NULL
);
`);

// تنضيف الجلسات المنتهية كل ساعة
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(now);
}, 60 * 60 * 1000);

export default db;
