const express = require('express');
const { getDB } = require('../db');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sensualy2024';

function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Token obrigatório' });

  const db = getDB();
  const session = db.prepare('SELECT token FROM admin_sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: 'Token inválido ou expirado' });

  next();
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }

  const token = require('crypto').randomBytes(32).toString('hex');
  const db = getDB();
  db.prepare('INSERT INTO admin_sessions (token) VALUES (?)').run(token);

  db.prepare(`DELETE FROM admin_sessions WHERE created_at < datetime('now', '-7 days', 'localtime')`).run();

  res.json({ token });
});

// GET /api/admin/reviews?status=pending|approved|all&page=1
router.get('/reviews', authMiddleware, (req, res) => {
  const { status = 'pending', page = 1, limit = 20, product_id } = req.query;
  const db = getDB();
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereClause = '';
  const params = [];

  if (status === 'pending') { whereClause = 'WHERE approved = 0'; }
  else if (status === 'approved') { whereClause = 'WHERE approved = 1'; }

  if (product_id) {
    whereClause += (whereClause ? ' AND' : 'WHERE') + ' product_id = ?';
    params.push(product_id);
  }

  const reviews = db.prepare(`
    SELECT * FROM reviews ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  const count = db.prepare(`SELECT COUNT(*) as c FROM reviews ${whereClause}`).get(...params);

  const BASE_URL = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const reviewsWithUrls = reviews.map(r => ({
    ...r,
    photo_url: r.photo_url ? `${BASE_URL}/uploads/${r.photo_url}` : null
  }));

  res.json({ reviews: reviewsWithUrls, total: count.c, page: parseInt(page) });
});

// PUT /api/admin/reviews/:id/approve
router.put('/reviews/:id/approve', authMiddleware, (req, res) => {
  const db = getDB();
  const result = db.prepare('UPDATE reviews SET approved = 1 WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Avaliação não encontrada' });
  res.json({ success: true });
});

// PUT /api/admin/reviews/:id/reject
router.put('/reviews/:id/reject', authMiddleware, (req, res) => {
  const db = getDB();
  const review = db.prepare('SELECT photo_url FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Avaliação não encontrada' });

  if (review.photo_url) {
    const photoPath = path.join(__dirname, '../uploads', review.photo_url);
    if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
  }

  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/admin/reviews/:id
router.delete('/reviews/:id', authMiddleware, (req, res) => {
  const db = getDB();
  const review = db.prepare('SELECT photo_url FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Avaliação não encontrada' });

  if (review.photo_url) {
    const photoPath = path.join(__dirname, '../uploads', review.photo_url);
    if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
  }

  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/admin/stats
router.get('/stats', authMiddleware, (req, res) => {
  const db = getDB();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN approved = 0 THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN approved = 1 THEN 1 ELSE 0 END) as approved,
      ROUND(AVG(CASE WHEN approved = 1 THEN rating END), 1) as avg_rating
    FROM reviews
  `).get();

  res.json(stats);
});

module.exports = router;
