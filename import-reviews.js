require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const TURSO_URL = process.env.TURSO_URL;
const TURSO_TOKEN = process.env.TURSO_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('❌ Defina TURSO_URL e TURSO_TOKEN no arquivo .env');
  process.exit(1);
}

const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

const CSV_FILE = path.join(__dirname, 'depoimentos.csv');

function parseCSVLine(line, sep) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

function parseCSV(content) {
  const lines = content.trim().split('\n').map(l => l.replace(/\r$/, ''));
  const firstLine = lines[0];
  const sep = firstLine.includes(';') ? ';' : ',';
  const headers = parseCSVLine(firstLine, sep).map(h => h.replace(/^"|"$/g, ''));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line, sep).map(v => v.replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || '');
    return obj;
  });
}

async function main() {
  if (!fs.existsSync(CSV_FILE)) {
    console.error('❌ Arquivo depoimentos.csv não encontrado na pasta do projeto.');
    process.exit(1);
  }

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
  `);
  console.log('✅ Tabela verificada/criada.\n');

  const content = fs.readFileSync(CSV_FILE, 'utf-8');
  const rows = parseCSV(content);

  console.log(`📋 ${rows.length} depoimento(s) encontrado(s) no CSV\n`);

  let ok = 0, err = 0;

  for (const row of rows) {
    const { product_id, author_name, rating, comment, approved } = row;

    if (!product_id || !author_name || !rating || !comment) {
      console.warn(`⚠️  Linha ignorada (campos vazios): ${JSON.stringify(row)}`);
      err++;
      continue;
    }

    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      console.warn(`⚠️  Rating inválido para "${author_name}": ${rating}`);
      err++;
      continue;
    }

    try {
      await db.execute({
        sql: `INSERT INTO reviews (product_id, author_name, rating, comment, photo_url, approved, created_at)
              VALUES (?, ?, ?, ?, NULL, ?, datetime('now','localtime'))`,
        args: [
          product_id.trim(),
          author_name.trim(),
          ratingNum,
          comment.trim(),
          approved === '0' ? 0 : 1
        ]
      });
      console.log(`✅ Inserido: ${author_name} (${ratingNum}★) — ${product_id}`);
      ok++;
    } catch (e) {
      console.error(`❌ Erro ao inserir "${author_name}":`, e.message);
      err++;
    }
  }

  console.log(`\n🏁 Concluído: ${ok} inserido(s), ${err} erro(s)/ignorado(s)`);
  process.exit(0);
}

main();
