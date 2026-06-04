const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const auth = (req, res, next) => {
  try { jwt.verify(req.cookies?.sponsors_token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Not authenticated' }); }
};

// Get all deliverables + all sponsor_deliverables
router.get('/', auth, async (req, res) => {
  const { tab_id } = req.query;
  const deliverables = tab_id
    ? await pool.query('SELECT * FROM deliverables WHERE tab_id=$1 ORDER BY sort_order', [tab_id])
    : await pool.query('SELECT * FROM deliverables ORDER BY sort_order');
  const sponsors = await pool.query('SELECT * FROM sponsors ORDER BY sort_order, created_at');
  const sd = await pool.query('SELECT * FROM sponsor_deliverables');

  // Build matrix: sponsor -> deliverable -> { checked, notes }
  const matrix = {};
  sponsors.rows.forEach(s => {
    matrix[s.id] = {};
    deliverables.rows.forEach(d => { matrix[s.id][d.id] = { checked: false, notes: [] }; });
  });
  sd.rows.forEach(row => {
    if (matrix[row.sponsor_id]) {
      matrix[row.sponsor_id][row.deliverable_id] = { checked: row.checked, notes: row.notes || [] };
    }
  });

  res.json({ deliverables: deliverables.rows, sponsors: sponsors.rows, matrix });
});

// Add deliverable column
router.post('/columns', auth, async (req, res) => {
  const { name, tab_id } = req.body;
  const max = await pool.query('SELECT COALESCE(MAX(sort_order),0) as m FROM deliverables WHERE tab_id=$1', [tab_id || null]);
  const r = await pool.query(
    'INSERT INTO deliverables (name, tab_id, sort_order) VALUES ($1,$2,$3) RETURNING *',
    [name.trim(), tab_id || null, max.rows[0].m + 1]
  );
  res.json(r.rows[0]);
});

// Reorder deliverable columns (must be before /:sponsorId/:deliverableId)
router.put('/columns/reorder', auth, async (req, res) => {
  const { order } = req.body; // array of deliverable ids in new left-to-right order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < order.length; i++) {
      await client.query('UPDATE deliverables SET sort_order=$1 WHERE id=$2', [i, order[i]]);
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

// Delete deliverable column
router.delete('/columns/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM deliverables WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// Update sponsor deliverable (check/uncheck + notes)
router.put('/:sponsorId/:deliverableId', auth, async (req, res) => {
  const { checked, notes } = req.body;
  const r = await pool.query(
    `INSERT INTO sponsor_deliverables (sponsor_id, deliverable_id, checked, notes, updated_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (sponsor_id, deliverable_id)
     DO UPDATE SET checked=EXCLUDED.checked, notes=EXCLUDED.notes, updated_at=NOW()
     RETURNING *`,
    [req.params.sponsorId, req.params.deliverableId,
     typeof checked === 'boolean' ? checked : false,
     JSON.stringify(notes || [])]
  );
  res.json(r.rows[0]);
});

module.exports = router;
