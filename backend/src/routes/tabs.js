const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const auth = (req, res, next) => {
  try { jwt.verify(req.cookies?.sponsors_token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Not authenticated' }); }
};

const VALID_TYPES = ['schedule', 'deliverables', 'exhibits'];

// List tabs
router.get('/', auth, async (req, res) => {
  const r = await pool.query('SELECT * FROM tabs ORDER BY sort_order, created_at');
  res.json(r.rows);
});

// Create tab (type: 'schedule' | 'deliverables')
router.post('/', auth, async (req, res) => {
  const { name, type } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });
  const max = await pool.query('SELECT COALESCE(MAX(sort_order),0) as m FROM tabs');
  const r = await pool.query(
    'INSERT INTO tabs (name, type, sort_order) VALUES ($1,$2,$3) RETURNING *',
    [name.trim(), type, max.rows[0].m + 1]
  );
  const tab = r.rows[0];
  // Give a new deliverables tab a Notes column so the notes feature is available
  if (type === 'deliverables') {
    await pool.query('INSERT INTO deliverables (name, tab_id, sort_order) VALUES ($1,$2,0)', ['Notes', tab.id]);
  }
  res.json(tab);
});

// Reorder tabs (must be before /:id)
router.post('/reorder', auth, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < ids.length; i++) {
      await client.query('UPDATE tabs SET sort_order=$1 WHERE id=$2', [i, ids[i]]);
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

// Rename tab
router.put('/:id', auth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const r = await pool.query('UPDATE tabs SET name=$1 WHERE id=$2 RETURNING *', [name.trim(), req.params.id]);
  res.json(r.rows[0]);
});

// Delete tab (cascades its days/slots/assignments or deliverable columns)
router.delete('/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM tabs WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
