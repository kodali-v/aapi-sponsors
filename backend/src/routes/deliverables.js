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
  const deliverables = await pool.query('SELECT * FROM deliverables ORDER BY sort_order');
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
  const { name } = req.body;
  const max = await pool.query('SELECT COALESCE(MAX(sort_order),0) as m FROM deliverables');
  const r = await pool.query(
    'INSERT INTO deliverables (name, sort_order) VALUES ($1,$2) RETURNING *',
    [name.trim(), max.rows[0].m + 1]
  );
  res.json(r.rows[0]);
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
