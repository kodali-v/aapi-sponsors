const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const auth = (req, res, next) => {
  try { jwt.verify(req.cookies?.sponsors_token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Not authenticated' }); }
};

// Get full schedule (days + slots + assignments)
router.get('/', auth, async (req, res) => {
  const days = await pool.query('SELECT * FROM days ORDER BY sort_order');
  const slots = await pool.query('SELECT * FROM time_slots ORDER BY sort_order');
  const assignments = await pool.query(
    `SELECT sa.*, s.name as sponsor_name, s.status as sponsor_status
     FROM slot_assignments sa JOIN sponsors s ON s.id = sa.sponsor_id`
  );

  const result = days.rows.map(day => ({
    ...day,
    slots: slots.rows
      .filter(s => s.day_id === day.id)
      .map(slot => ({
        ...slot,
        assignments: assignments.rows.filter(a => a.slot_id === slot.id),
      })),
  }));
  res.json(result);
});

// Add day
router.post('/days', auth, async (req, res) => {
  const { name, date } = req.body;
  const max = await pool.query('SELECT COALESCE(MAX(sort_order),0) as m FROM days');
  const r = await pool.query(
    'INSERT INTO days (name, date, sort_order) VALUES ($1,$2,$3) RETURNING *',
    [name.trim(), date || null, max.rows[0].m + 1]
  );
  res.json({ ...r.rows[0], slots: [] });
});

// Delete day
router.delete('/days/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM days WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// Add time slot to a day
router.post('/days/:dayId/slots', auth, async (req, res) => {
  const { start_time, end_time } = req.body;
  const max = await pool.query(
    'SELECT COALESCE(MAX(sort_order),0) as m FROM time_slots WHERE day_id=$1',
    [req.params.dayId]
  );
  const r = await pool.query(
    'INSERT INTO time_slots (day_id, start_time, end_time, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.params.dayId, start_time.trim(), end_time.trim(), max.rows[0].m + 1]
  );
  res.json({ ...r.rows[0], assignments: [] });
});

// Delete slot
router.delete('/slots/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM time_slots WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// Assign sponsor to slot
router.post('/slots/:slotId/assign', auth, async (req, res) => {
  const { sponsor_id } = req.body;
  const r = await pool.query(
    `INSERT INTO slot_assignments (slot_id, sponsor_id)
     VALUES ($1,$2)
     ON CONFLICT (slot_id, sponsor_id) DO NOTHING
     RETURNING *`,
    [req.params.slotId, sponsor_id]
  );
  if (!r.rows.length) return res.json({ ok: true });
  const s = await pool.query('SELECT name, status FROM sponsors WHERE id=$1', [sponsor_id]);
  res.json({ ...r.rows[0], sponsor_name: s.rows[0]?.name, sponsor_status: s.rows[0]?.status });
});

// Remove sponsor from slot
router.delete('/slots/:slotId/assign/:sponsorId', auth, async (req, res) => {
  await pool.query(
    'DELETE FROM slot_assignments WHERE slot_id=$1 AND sponsor_id=$2',
    [req.params.slotId, req.params.sponsorId]
  );
  res.json({ ok: true });
});

module.exports = router;
