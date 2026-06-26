const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'reviews.db');

function initDB() {
  const dataDir = DATA_DIR;
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  TEXT    NOT NULL,
      author_name TEXT    NOT NULL,
      rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment     TEXT    NOT NULL,
      photo_url   TEXT,
      approved    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, approved);

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token      TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  const adminExists = db.prepare("SELECT COUNT(*) as c FROM admin_sessions").get();
  console.log('Banco de dados inicializado.');
}

function getDB() {
  return new Database(DB_PATH);
}

module.exports = { initDB, getDB };
