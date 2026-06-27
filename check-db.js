require('dotenv').config();
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

async function main() {
  const res = await db.execute('SELECT COUNT(*) as total FROM reviews');
  console.log('Total no Turso (com token local):', res.rows[0].total);

  const res2 = await db.execute('SELECT id, author_name, approved FROM reviews ORDER BY id DESC LIMIT 5');
  console.log('Últimos 5 registros:');
  res2.rows.forEach(r => console.log(' -', r.id, r.author_name, 'aprovado:', r.approved));
}

main().catch(console.error);
