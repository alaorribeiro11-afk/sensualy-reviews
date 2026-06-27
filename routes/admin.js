const express = require('express');
const { getDB } = require('../db');
const { upload } = require('../cloudinary');

const router = express.Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sensualy2024';

async function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Token obrigatório' });
  try {
    const db = getDB();
    const r = await db.execute({ sql: 'SELECT token FROM admin_sessions WHERE token = ?', args: [token] });
    if (!r.rows.length) return res.status(401).json({ error: 'Token inválido ou expirado' });
    next();
  } catch(e) { res.status(500).json({ error: 'Erro interno' }); }
}

// POST /api/admin/login
router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Senha incorreta' });
  try {
    const token = require('crypto').randomBytes(32).toString('hex');
    const db = getDB();
    await db.execute({ sql: 'INSERT INTO admin_sessions (token) VALUES (?)', args: [token] });
    await db.execute({ sql: `DELETE FROM admin_sessions WHERE created_at < datetime('now', '-7 days', 'localtime')`, args: [] });
    res.json({ token });
  } catch(e) { res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/admin/reviews
router.get('/reviews', authMiddleware, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20, product_id } = req.query;
    const db = getDB();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = '';
    const args = [];
    if (status === 'pending') where = 'WHERE approved = 0';
    else if (status === 'approved') where = 'WHERE approved = 1';
    if (product_id) {
      where += (where ? ' AND' : 'WHERE') + ' product_id = ?';
      args.push(product_id);
    }

    const [reviewsRes, countRes] = await Promise.all([
      db.execute({ sql: `SELECT * FROM reviews ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, args: [...args, parseInt(limit), offset] }),
      db.execute({ sql: `SELECT COUNT(*) as c FROM reviews ${where}`, args })
    ]);

    const reviews = reviewsRes.rows.map(r => {
      let photos = [];
      if (r.photo_url) {
        try {
          const parsed = JSON.parse(r.photo_url);
          photos = Array.isArray(parsed) ? parsed : [r.photo_url];
        } catch(e) { photos = [r.photo_url]; }
      }
      return { ...r, photo_url: photos[0] || null, photos };
    });

    res.json({ reviews, total: Number(countRes.rows[0].c), page: parseInt(page) });
  } catch(e) { console.error(e); res.status(500).json({ error: 'Erro interno' }); }
});

// PUT /api/admin/reviews/:id/approve
router.put('/reviews/:id/approve', authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const r = await db.execute({ sql: 'UPDATE reviews SET approved = 1 WHERE id = ?', args: [req.params.id] });
    if (!r.rowsAffected) return res.status(404).json({ error: 'Avaliação não encontrada' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'Erro interno' }); }
});

// PUT /api/admin/reviews/:id/reject
router.put('/reviews/:id/reject', authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const rev = await db.execute({ sql: 'SELECT photo_url FROM reviews WHERE id = ?', args: [req.params.id] });
    if (!rev.rows.length) return res.status(404).json({ error: 'Avaliação não encontrada' });
    await db.execute({ sql: 'DELETE FROM reviews WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'Erro interno' }); }
});

// DELETE /api/admin/reviews/:id
router.delete('/reviews/:id', authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const rev = await db.execute({ sql: 'SELECT photo_url FROM reviews WHERE id = ?', args: [req.params.id] });
    if (!rev.rows.length) return res.status(404).json({ error: 'Avaliação não encontrada' });
    await db.execute({ sql: 'DELETE FROM reviews WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'Erro interno' }); }
});

// PUT /api/admin/reviews/:id/photo
router.put('/reviews/:id/photo', authMiddleware, (req, res) => {
  upload.single('photo')(req, res, async function(err) {
    if (err) return res.status(400).json({ error: err.message || 'Erro no upload.' });
    if (!req.file) return res.status(400).json({ error: 'Nenhuma foto enviada.' });
    try {
      const db = getDB();
      const rev = await db.execute({ sql: 'SELECT photo_url FROM reviews WHERE id = ?', args: [req.params.id] });
      if (!rev.rows.length) return res.status(404).json({ error: 'Avaliação não encontrada' });
      const photoUrl = req.file.path || req.file.secure_url;
      await db.execute({ sql: 'UPDATE reviews SET photo_url = ? WHERE id = ?', args: [photoUrl, req.params.id] });
      res.json({ success: true, photo_url: photoUrl });
    } catch(e) { console.error(e); res.status(500).json({ error: 'Erro interno' }); }
  });
});

// POST /api/admin/import-csv
const multerMemory = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.post('/import-csv', authMiddleware, (req, res) => {
  multerMemory.single('csv')(req, res, async function(err) {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    try {
      const content = req.file.buffer.toString('utf-8').replace(/\r/g, '');
      const lines = content.trim().split('\n').filter(l => l.trim());
      const firstLine = lines[0];
      const sep = firstLine.includes(';') ? ';' : ',';

      function parseLine(line) {
        const vals = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQ = !inQ; }
          else if (ch === sep && !inQ) { vals.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        vals.push(cur.trim());
        return vals.map(v => v.replace(/^"|"$/g, ''));
      }

      const headers = parseLine(firstLine);
      const rows = lines.slice(1).filter(l => l.trim()).map(l => {
        const vals = parseLine(l);
        const obj = {};
        headers.forEach((h, i) => obj[h] = vals[i] || '');
        return obj;
      });

      const db = getDB();
      let inserted = 0, ignored = 0;
      for (const r of rows) {
        const pid = (r.product_id || '').trim();
        const name = (r.author_name || '').trim();
        const rating = parseInt(r.rating);
        const comment = (r.comment || '').trim();
        const approved = r.approved !== undefined ? parseInt(r.approved) : 1;
        if (!pid || !name || !comment || isNaN(rating)) { ignored++; continue; }
        try {
          await db.execute({
            sql: 'INSERT INTO reviews (product_id, author_name, rating, comment, approved) VALUES (?, ?, ?, ?, ?)',
            args: [pid, name, rating, comment, approved]
          });
          inserted++;
        } catch(e) { ignored++; }
      }
      res.json({ success: true, inserted, ignored });
    } catch(e) { console.error(e); res.status(500).json({ error: 'Erro ao processar CSV.' }); }
  });
});

// POST /api/admin/generate-reviews
router.post('/generate-reviews', authMiddleware, async (req, res) => {
  try {
    const { product_id, product_name, quantity = 5 } = req.body;
    if (!product_id || !product_name) return res.status(400).json({ error: 'product_id e product_name são obrigatórios.' });
    const qty = Math.min(Math.max(parseInt(quantity) || 5, 1), 20);

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Gere ${qty} depoimentos realistas de clientes brasileiros para o produto "${product_name}" de uma loja de produtos íntimos adultos chamada Sensualy Shop.
Regras:
- Cada depoimento deve ter nome feminino brasileiro, nota de 4 ou 5 estrelas e um comentário natural de 1 a 3 frases
- Os comentários devem mencionar aspectos como: qualidade, entrega discreta, embalagem, facilidade de uso, custo-benefício, satisfação
- Use linguagem natural, variada, sem repetição
- Responda APENAS com um array JSON válido no formato:
[{"author_name":"Nome","rating":5,"comment":"Texto do depoimento."}]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
    });

    const raw = completion.choices[0].message.content.trim();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'Resposta inválida da IA.' });
    const reviews = JSON.parse(jsonMatch[0]);

    const db = getDB();
    let inserted = 0;
    for (const r of reviews) {
      if (!r.author_name || !r.comment || !r.rating) continue;
      await db.execute({
        sql: 'INSERT INTO reviews (product_id, author_name, rating, comment, approved) VALUES (?, ?, ?, ?, 1)',
        args: [product_id.trim(), r.author_name.trim(), parseInt(r.rating), r.comment.trim()]
      });
      inserted++;
    }
    res.json({ success: true, inserted, reviews });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao gerar depoimentos: ' + e.message });
  }
});

// GET /api/admin/products
router.get('/products', authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const r = await db.execute({ sql: 'SELECT DISTINCT product_id FROM reviews ORDER BY product_id', args: [] });
    res.json({ products: r.rows.map(row => row.product_id) });
  } catch(e) { res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/admin/stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const db = getDB();
    const r = await db.execute({ sql: `SELECT COUNT(*) as total, SUM(CASE WHEN approved=0 THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN approved=1 THEN 1 ELSE 0 END) as approved, ROUND(AVG(CASE WHEN approved=1 THEN rating END),1) as avg_rating FROM reviews`, args: [] });
    const s = r.rows[0];
    res.json({ total: Number(s.total), pending: Number(s.pending), approved: Number(s.approved), avg_rating: Number(s.avg_rating) });
  } catch(e) { res.status(500).json({ error: 'Erro interno' }); }
});

module.exports = router;
