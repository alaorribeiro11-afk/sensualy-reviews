const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

let _db = null;

function getDB() {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_URL,
      authToken: process.env.TURSO_TOKEN,
    });
  }
  return _db;
}

async function initDB() {
  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const db = getDB();

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id  TEXT    NOT NULL,
      author_name TEXT    NOT NULL,
      rating      INTEGER NOT NULL,
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

  console.log('Banco de dados Turso inicializado.');
}

module.exports = { initDB, getDB };
