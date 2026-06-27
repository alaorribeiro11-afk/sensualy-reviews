const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { getDB } = require('../db');

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas avaliações enviadas. Tente novamente em 1 hora.' }
});

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (jpg, png, webp, gif)'));
    }
  }
});

// GET /api/reviews?product_id=xxx&page=1&limit=10
router.get('/', async (req, res) => {
  try {
    const { product_id, page = 1, limit = 10 } = req.query;
    if (!product_id) return res.status(400).json({ error: 'product_id é obrigatório' });

    const db = getDB();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [reviewsRes, statsRes] = await Promise.all([
      db.execute({
        sql: `SELECT id, author_name, rating, comment, photo_url, created_at FROM reviews WHERE product_id = ? AND approved = 1 ORDER BY CASE WHEN photo_url IS NOT NULL AND photo_url != '' THEN 0 ELSE 1 END, created_at DESC LIMIT ? OFFSET ?`,
        args: [product_id, parseInt(limit), offset]
      }),
      db.execute({
        sql: `SELECT COUNT(*) as total, ROUND(AVG(rating),1) as average, SUM(CASE WHEN rating=5 THEN 1 ELSE 0 END) as r5, SUM(CASE WHEN rating=4 THEN 1 ELSE 0 END) as r4, SUM(CASE WHEN rating=3 THEN 1 ELSE 0 END) as r3, SUM(CASE WHEN rating=2 THEN 1 ELSE 0 END) as r2, SUM(CASE WHEN rating=1 THEN 1 ELSE 0 END) as r1 FROM reviews WHERE product_id = ? AND approved = 1`,
        args: [product_id]
      })
    ]);

    const BASE_URL = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const reviews = reviewsRes.rows.map(r => {
      let photos = [];
      if (r.photo_url) {
        try {
          const parsed = JSON.parse(r.photo_url);
          photos = Array.isArray(parsed) ? parsed.map(f => `${BASE_URL}/uploads/${f}`) : [`${BASE_URL}/uploads/${r.photo_url}`];
        } catch(e) {
          photos = [`${BASE_URL}/uploads/${r.photo_url}`];
        }
      }
      return { ...r, photo_url: photos[0] || null, photos };
    });

    const stats = statsRes.rows[0];
    res.json({
      reviews,
      stats: {
        total: Number(stats.total),
        average: Number(stats.average) || 0,
        breakdown: { 5: Number(stats.r5), 4: Number(stats.r4), 3: Number(stats.r3), 2: Number(stats.r2), 1: Number(stats.r1) }
      },
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/reviews/summary?product_ids=id1,id2,id3
router.get('/summary', async (req, res) => {
  try {
    const { product_ids } = req.query;
    if (!product_ids) return res.status(400).json({ error: 'product_ids é obrigatório' });

    const ids = product_ids.split(',').map(s => s.trim()).filter(Boolean).slice(0, 100);
    if (ids.length === 0) return res.json({});

    const db = getDB();
    const placeholders = ids.map(() => '?').join(',');
    const rowsRes = await db.execute({
      sql: `SELECT product_id, COUNT(*) as total, ROUND(AVG(rating),1) as average FROM reviews WHERE product_id IN (${placeholders}) AND approved = 1 GROUP BY product_id`,
      args: ids
    });

    const result = {};
    rowsRes.rows.forEach(r => {
      result[r.product_id] = { total: Number(r.total), average: Number(r.average) };
    });
    ids.forEach(id => { if (!result[id]) result[id] = { total: 0, average: 0 }; });
    res.json(result);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/reviews
router.post('/', (req, res) => {
  upload.single('photo')(req, res, function(err) {
    if (err) return res.status(400).json({ error: err.message || 'Erro no upload.' });
    submitLimiter(req, res, function() {
      handlePost(req, res);
    });
  });
});

async function handlePost(req, res) {
  const { product_id, author_name, rating, comment } = req.body;
  const file = req.file || null;

  if (!product_id || !author_name || !rating || !comment) {
    if (file) try { fs.unlinkSync(file.path); } catch(e) {}
    return res.status(400).json({ error: 'Campos obrigatórios: product_id, author_name, rating, comment' });
  }
  const ratingNum = parseInt(rating);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) { if (file) try { fs.unlinkSync(file.path); } catch(e) {} return res.status(400).json({ error: 'Rating deve ser entre 1 e 5' }); }
  if (author_name.trim().length < 2 || author_name.trim().length > 80) { if (file) try { fs.unlinkSync(file.path); } catch(e) {} return res.status(400).json({ error: 'Nome deve ter entre 2 e 80 caracteres' }); }
  if (comment.trim().length < 10 || comment.trim().length > 1000) { if (file) try { fs.unlinkSync(file.path); } catch(e) {} return res.status(400).json({ error: 'Depoimento deve ter entre 10 e 1000 caracteres' }); }

  const photoFilename = file ? file.filename : null;

  try {
    const db = getDB();
    const result = await db.execute({
      sql: `INSERT INTO reviews (product_id, author_name, rating, comment, photo_url) VALUES (?, ?, ?, ?, ?)`,
      args: [product_id.trim(), author_name.trim(), ratingNum, comment.trim(), photoFilename]
    });
    res.status(201).json({
      success: true,
      message: 'Avaliação enviada com sucesso! Ela será publicada após aprovação.',
      id: Number(result.lastInsertRowid)
    });
  } catch(err) {
    if (file) try { fs.unlinkSync(file.path); } catch(e) {}
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar avaliação.' });
  }
}

module.exports = router;
