const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { tabUnlocked, rowTabId } = require('../tabAccess');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const auth = (req, res, next) => {
  try { jwt.verify(req.cookies?.sponsors_token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Not authenticated' }); }
};

const LOCKED = { error: 'locked', message: 'This tab is locked' };

// List rows for an exhibits tab
router.get('/', auth, async (req, res) => {
  const { tab_id } = req.query;
  if (!(await tabUnlocked(tab_id, req))) return res.status(403).json(LOCKED);
  const r = tab_id
    ? await pool.query('SELECT * FROM exhibit_rows WHERE tab_id=$1 ORDER BY sort_order, created_at', [tab_id])
    : await pool.query('SELECT * FROM exhibit_rows ORDER BY sort_order, created_at');
  res.json(r.rows);
});

// Add one row (goes to the TOP so it's easy to find)
router.post('/', auth, async (req, res) => {
  const { tab_id, data } = req.body;
  if (!(await tabUnlocked(tab_id, req))) return res.status(403).json(LOCKED);
  const min = await pool.query('SELECT COALESCE(MIN(sort_order),0) as m FROM exhibit_rows WHERE tab_id=$1', [tab_id || null]);
  const r = await pool.query(
    'INSERT INTO exhibit_rows (tab_id, data, sort_order) VALUES ($1,$2,$3) RETURNING *',
    [tab_id || null, JSON.stringify(data || {}), min.rows[0].m - 1]
  );
  res.json(r.rows[0]);
});

// Bulk import (from Excel/CSV upload) — must be before /:id
router.post('/bulk', auth, async (req, res) => {
  const { tab_id, rows, replace } = req.body;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array' });
  if (!(await tabUnlocked(tab_id, req))) return res.status(403).json(LOCKED);
  const client = await pool.connect();
  const inserted = [];
  try {
    await client.query('BEGIN');
    if (replace && tab_id) await client.query('DELETE FROM exhibit_rows WHERE tab_id=$1', [tab_id]);
    let max = replace ? 0 : (await client.query('SELECT COALESCE(MAX(sort_order),0) as m FROM exhibit_rows WHERE tab_id=$1', [tab_id || null])).rows[0].m;
    for (const data of rows) {
      max += 1;
      const r = await client.query(
        'INSERT INTO exhibit_rows (tab_id, data, sort_order) VALUES ($1,$2,$3) RETURNING *',
        [tab_id || null, JSON.stringify(data || {}), max]
      );
      inserted.push(r.rows[0]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'bulk insert failed' });
  } finally {
    client.release();
  }
  res.json(inserted);
});

// Reorder rows (must be before /:id)
router.post('/reorder', auth, async (req, res) => {
  const { order, tab_id } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
  if (!(await tabUnlocked(tab_id, req))) return res.status(403).json(LOCKED);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < order.length; i++) {
      await client.query('UPDATE exhibit_rows SET sort_order=$1 WHERE id=$2', [i, order[i]]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'reorder failed' });
  } finally {
    client.release();
  }
  res.json({ ok: true });
});

// Update a row: data and/or struck (only provided fields change)
router.put('/:id', auth, async (req, res) => {
  if (!(await tabUnlocked(await rowTabId(req.params.id), req))) return res.status(403).json(LOCKED);
  const { data, struck } = req.body;
  const r = await pool.query(
    `UPDATE exhibit_rows
       SET data   = COALESCE($1::jsonb, data),
           struck = COALESCE($2, struck)
     WHERE id=$3 RETURNING *`,
    [data !== undefined ? JSON.stringify(data) : null,
     typeof struck === 'boolean' ? struck : null,
     req.params.id]
  );
  res.json(r.rows[0]);
});

// Delete a row
router.delete('/:id', auth, async (req, res) => {
  if (!(await tabUnlocked(await rowTabId(req.params.id), req))) return res.status(403).json(LOCKED);
  await pool.query('DELETE FROM exhibit_rows WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
