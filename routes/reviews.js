const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
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
router.get('/', (req, res) => {
  const { product_id, page = 1, limit = 10 } = req.query;
  if (!product_id) return res.status(400).json({ error: 'product_id é obrigatório' });

  const db = getDB();
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const reviews = db.prepare(`
    SELECT id, author_name, rating, comment, photo_url, created_at
    FROM reviews
    WHERE product_id = ? AND approved = 1
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(product_id, parseInt(limit), offset);

  const stats = db.prepare(`
    SELECT COUNT(*) as total,
           ROUND(AVG(rating), 1) as average,
           SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as r5,
           SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as r4,
           SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as r3,
           SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as r2,
           SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as r1
    FROM reviews
    WHERE product_id = ? AND approved = 1
  `).get(product_id);

  const BASE_URL = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

  const reviewsWithUrls = reviews.map(r => {
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

  res.json({
    reviews: reviewsWithUrls,
    stats: {
      total: stats.total,
      average: stats.average || 0,
      breakdown: { 5: stats.r5, 4: stats.r4, 3: stats.r3, 2: stats.r2, 1: stats.r1 }
    },
    page: parseInt(page),
    limit: parseInt(limit)
  });
});

// GET /api/reviews/summary?product_ids=id1,id2,id3
router.get('/summary', (req, res) => {
  const { product_ids } = req.query;
  if (!product_ids) return res.status(400).json({ error: 'product_ids é obrigatório' });

  const ids = product_ids.split(',').map(s => s.trim()).filter(Boolean).slice(0, 100);
  if (ids.length === 0) return res.json({});

  const db = getDB();
  const placeholders = ids.map(() => '?').join(',');

  const rows = db.prepare(`
    SELECT product_id,
           COUNT(*) as total,
           ROUND(AVG(rating), 1) as average
    FROM reviews
    WHERE product_id IN (${placeholders}) AND approved = 1
    GROUP BY product_id
  `).all(...ids);

  const result = {};
  rows.forEach(r => {
    result[r.product_id] = { total: r.total, average: r.average };
  });

  ids.forEach(id => {
    if (!result[id]) result[id] = { total: 0, average: 0 };
  });

  res.json(result);
});

// POST /api/reviews
router.post('/', (req, res) => {
  upload.array('photos', 5)(req, res, function(err) {
    if (err) {
      return res.status(400).json({ error: err.message || 'Erro no upload.' });
    }
    handlePost(req, res);
  });
});

function handlePost(req, res) {
  const { product_id, author_name, rating, comment } = req.body;
  const files = req.files || [];

  const cleanup = () => files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e){} });

  if (!product_id || !author_name || !rating || !comment) {
    cleanup();
    return res.status(400).json({ error: 'Campos obrigatórios: product_id, author_name, rating, comment' });
  }

  const ratingNum = parseInt(rating);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    cleanup();
    return res.status(400).json({ error: 'Rating deve ser entre 1 e 5' });
  }

  if (author_name.trim().length < 2 || author_name.trim().length > 80) {
    cleanup();
    return res.status(400).json({ error: 'Nome deve ter entre 2 e 80 caracteres' });
  }

  if (comment.trim().length < 10 || comment.trim().length > 1000) {
    cleanup();
    return res.status(400).json({ error: 'Depoimento deve ter entre 10 e 1000 caracteres' });
  }

  const photoJson = files.length > 0 ? JSON.stringify(files.map(f => f.filename)) : null;

  const db = getDB();
  const result = db.prepare(`
    INSERT INTO reviews (product_id, author_name, rating, comment, photo_url)
    VALUES (?, ?, ?, ?, ?)
  `).run(product_id.trim(), author_name.trim(), ratingNum, comment.trim(), photoJson);

  res.status(201).json({
    success: true,
    message: 'Avaliação enviada com sucesso! Ela será publicada após aprovação.',
    id: result.lastInsertRowid
  });
}

module.exports = router;
