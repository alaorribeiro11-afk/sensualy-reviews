const express = require('express');
const { getDB } = require('../db');
const path = require('path');
const fs = require('fs');

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

    const BASE_URL = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const reviews = reviewsRes.rows.map(r => {
      let photos = [];
      if (r.photo_url) {
        try {
          const parsed = JSON.parse(r.photo_url);
          photos = Array.isArray(parsed) ? parsed.map(f => `${BASE_URL}/uploads/${f}`) : [`${BASE_URL}/uploads/${r.photo_url}`];
        } catch(e) { photos = [`${BASE_URL}/uploads/${r.photo_url}`]; }
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
