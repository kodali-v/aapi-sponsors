const express = require('express');
const { pool } = require('../db');
const router = express.Router();

// NOTE: these endpoints are intentionally UNAUTHENTICATED (shared via a public link).
// They are strictly limited to rows belonging to souvenir-type, non-deleted tabs.

const SOUVENIR_TYPES = ['souvenir', 'toc', 'vipads'];

const isSouvenirTab = async (tabId) => {
  const r = await pool.query(`SELECT 1 FROM tabs WHERE id=$1 AND type = ANY($2) AND deleted_at IS NULL`, [tabId, SOUVENIR_TYPES]);
  return r.rows.length > 0;
};
const rowInSouvenir = async (rowId) => {
  const r = await pool.query(
    `SELECT er.id FROM exhibit_rows er
     JOIN tabs t ON t.id = er.tab_id
     WHERE er.id=$1 AND t.type = ANY($2) AND t.deleted_at IS NULL`, [rowId, SOUVENIR_TYPES]);
  return r.rows.length > 0;
};

// All souvenir-family tabs (Souvenir, TOC, VIP Ads) + their rows
router.get('/souvenir', async (req, res) => {
  const tabs = await pool.query(
    `SELECT id, name, type, sort_order FROM tabs WHERE type = ANY($1) AND deleted_at IS NULL ORDER BY sort_order, created_at`,
    [SOUVENIR_TYPES]
  );
  const ids = tabs.rows.map(t => t.id);
  let rowsByTab = {};
  tabs.rows.forEach(t => { rowsByTab[t.id] = []; });
  if (ids.length) {
    const rows = await pool.query(
      `SELECT * FROM exhibit_rows WHERE tab_id = ANY($1) ORDER BY sort_order, created_at`, [ids]);
    rows.rows.forEach(r => { (rowsByTab[r.tab_id] || (rowsByTab[r.tab_id] = [])).push(r); });
  }
  res.json({ tabs: tabs.rows, rowsByTab });
});

// Add a row (souvenir tab only)
router.post('/souvenir', async (req, res) => {
  const { tab_id, data } = req.body;
  if (!(await isSouvenirTab(tab_id))) return res.status(403).json({ error: 'Not a souvenir tab' });
  const max = await pool.query('SELECT COALESCE(MAX(sort_order),0) as m FROM exhibit_rows WHERE tab_id=$1', [tab_id]);
  const r = await pool.query(
    'INSERT INTO exhibit_rows (tab_id, data, sort_order) VALUES ($1,$2,$3) RETURNING *',
    [tab_id, JSON.stringify(data || {}), max.rows[0].m + 1]
  );
  res.json(r.rows[0]);
});

// Bulk import (souvenir tab only)
router.post('/souvenir/bulk', async (req, res) => {
  const { tab_id, rows, replace } = req.body;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array' });
  if (!(await isSouvenirTab(tab_id))) return res.status(403).json({ error: 'Not a souvenir tab' });
  const client = await pool.connect();
  const inserted = [];
  try {
    await client.query('BEGIN');
    if (replace) await client.query('DELETE FROM exhibit_rows WHERE tab_id=$1', [tab_id]);
    let max = replace ? 0 : (await client.query('SELECT COALESCE(MAX(sort_order),0) as m FROM exhibit_rows WHERE tab_id=$1', [tab_id])).rows[0].m;
    for (const data of rows) {
      max++;
      const r = await client.query('INSERT INTO exhibit_rows (tab_id, data, sort_order) VALUES ($1,$2,$3) RETURNING *',
        [tab_id, JSON.stringify(data || {}), max]);
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

// Update a row: data and/or struck (souvenir row only)
router.put('/souvenir/:id', async (req, res) => {
  if (!(await rowInSouvenir(req.params.id))) return res.status(403).json({ error: 'Not a souvenir row' });
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

module.exports = router;
