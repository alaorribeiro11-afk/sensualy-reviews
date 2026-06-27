require('dotenv').config();
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

async function main() {
  const before = await db.execute('SELECT COUNT(*) as total FROM reviews');
  console.log('Total antes:', before.rows[0].total);

  await db.execute(`
    DELETE FROM reviews WHERE id NOT IN (
      SELECT MIN(id) FROM reviews
      GROUP BY product_id, author_name, comment
    )
  `);

  const after = await db.execute('SELECT COUNT(*) as total FROM reviews');
  console.log('Total depois:', after.rows[0].total);
  console.log('✅ Duplicatas removidas.');
}

main().catch(console.error);
