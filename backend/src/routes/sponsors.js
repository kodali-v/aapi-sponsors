const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const auth = (req, res, next) => {
  try { jwt.verify(req.cookies?.sponsors_token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Not authenticated' }); }
};

// Get all sponsors
router.get('/', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM sponsors ORDER BY sort_order, created_at');
  res.json(r.rows);
});

// Create sponsor
router.post('/', auth, async (req, res) => {
  const { name, status } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const max = await pool.query('SELECT COALESCE(MAX(sort_order),0) as m FROM sponsors');
  const r = await pool.query(
    'INSERT INTO sponsors (name, status, sort_order) VALUES ($1,$2,$3) RETURNING *',
    [name.trim(), status || 'probable', max.rows[0].m + 1]
  );
  res.json(r.rows[0]);
});

// Update sponsor
router.put('/:id', auth, async (req, res) => {
  const { name, status } = req.body;
  const r = await pool.query(
    'UPDATE sponsors SET name=COALESCE($1,name), status=COALESCE($2,status) WHERE id=$3 RETURNING *',
    [name?.trim() || null, status || null, req.params.id]
  );
  res.json(r.rows[0]);
});

// Delete sponsor
router.delete('/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM sponsors WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// Sync companies from a Sponsors table into the shared pool (matched by name, case-insensitive)
router.post('/sync', auth, async (req, res) => {
  const list = req.body?.sponsors;
  if (!Array.isArray(list)) return res.status(400).json({ error: 'sponsors must be an array' });
  const client = await pool.connect();
  let added = 0, updated = 0;
  try {
    await client.query('BEGIN');
    let max = (await client.query('SELECT COALESCE(MAX(sort_order),0) as m FROM sponsors')).rows[0].m;
    const seen = new Set();
    for (const s of list) {
      const name = (s?.name || '').trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const status = s.status === 'confirmed' ? 'confirmed' : 'probable';
      const existing = await client.query('SELECT id FROM sponsors WHERE LOWER(name)=LOWER($1) LIMIT 1', [name]);
      if (existing.rows.length) {
        await client.query('UPDATE sponsors SET status=$1 WHERE id=$2', [status, existing.rows[0].id]);
        updated++;
      } else {
        max++;
        await client.query('INSERT INTO sponsors (name, status, sort_order) VALUES ($1,$2,$3)', [name, status, max]);
        added++;
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'sync failed' });
  } finally {
    client.release();
  }
  const all = await pool.query('SELECT * FROM sponsors ORDER BY sort_order, created_at');
  res.json({ added, updated, sponsors: all.rows });
});

// Reorder sponsors
router.post('/reorder', auth, async (req, res) => {
  const { ids } = req.body;
  for (let i = 0; i < ids.length; i++) {
    await pool.query('UPDATE sponsors SET sort_order=$1 WHERE id=$2', [i, ids[i]]);
  }
  res.json({ ok: true });
});

module.exports = router;
