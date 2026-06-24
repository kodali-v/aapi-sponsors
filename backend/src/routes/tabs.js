const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

const auth = (req, res, next) => {
  try { jwt.verify(req.cookies?.sponsors_token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Not authenticated' }); }
};

// Passcode hashing (salt:hash via scrypt) — shared with the data-access guard
function hashPasscode(pc) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(String(pc), salt, 32).toString('hex')}`;
}
function verifyPasscode(pc, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(pc), salt, 32).toString('hex');
  const a = Buffer.from(hash, 'hex'), b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const VALID_TYPES = ['schedule', 'deliverables', 'exhibits', 'sponsorlist', 'souvenir', 'toc', 'vipads', 'rooming', 'attendees'];

// item_count per tab: days (schedule), columns (deliverables), or rows (exhibits/sponsorlist)
const COUNT_SELECT = `
  CASE t.type
    WHEN 'schedule' THEN (SELECT COUNT(*) FROM days d WHERE d.tab_id = t.id)
    WHEN 'deliverables' THEN (SELECT COUNT(*) FROM deliverables dl WHERE dl.tab_id = t.id)
    ELSE (SELECT COUNT(*) FROM exhibit_rows er WHERE er.tab_id = t.id)
  END AS item_count`;

// Strip the secret hash; expose only a `locked` boolean
const sanitize = t => { const { passcode_hash, ...rest } = t; return { ...rest, locked: !!passcode_hash }; };

// List active (non-deleted) tabs
router.get('/', auth, async (req, res) => {
  const r = await pool.query(
    `SELECT t.*, ${COUNT_SELECT} FROM tabs t WHERE t.deleted_at IS NULL ORDER BY t.sort_order, t.created_at`
  );
  res.json(r.rows.map(sanitize));
});

// List trashed tabs (restorable)
router.get('/trash', auth, async (req, res) => {
  const r = await pool.query(
    `SELECT t.*, ${COUNT_SELECT} FROM tabs t WHERE t.deleted_at IS NOT NULL ORDER BY t.deleted_at DESC`
  );
  res.json(r.rows.map(sanitize));
});

// Set / change / remove a tab's passcode. Changing or removing requires the current passcode.
router.put('/:id/passcode', auth, async (req, res) => {
  const { passcode, current } = req.body;
  const r = await pool.query('SELECT passcode_hash FROM tabs WHERE id=$1', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Tab not found' });
  const existing = r.rows[0].passcode_hash;
  if (existing && !verifyPasscode(current || '', existing)) {
    return res.status(403).json({ error: 'Current passcode is incorrect' });
  }
  const newHash = (passcode && String(passcode).trim()) ? hashPasscode(String(passcode).trim()) : null;
  await pool.query('UPDATE tabs SET passcode_hash=$1 WHERE id=$2', [newHash, req.params.id]);
  res.json({ ok: true, locked: !!newHash });
});

// Unlock: verify the passcode, return a short-lived token scoped to this tab
router.post('/:id/unlock', auth, async (req, res) => {
  const { passcode } = req.body;
  const r = await pool.query('SELECT passcode_hash FROM tabs WHERE id=$1', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Tab not found' });
  const h = r.rows[0].passcode_hash;
  if (!h) return res.json({ token: null }); // not locked
  if (!verifyPasscode(passcode || '', h)) return res.status(403).json({ error: 'Incorrect passcode' });
  const token = jwt.sign({ tab: req.params.id, scope: 'tab' }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
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

// Restore a trashed tab (must be before /:id)
router.post('/:id/restore', auth, async (req, res) => {
  await pool.query('UPDATE tabs SET deleted_at=NULL WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// Permanently delete a tab and all its contents (must be before /:id)
router.delete('/:id/permanent', auth, async (req, res) => {
  await pool.query('DELETE FROM tabs WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// Save per-tab column order and/or hidden columns — must be before /:id
router.put('/:id/columns', auth, async (req, res) => {
  const { order, hidden } = req.body;
  await pool.query(
    `UPDATE tabs SET col_order = COALESCE($1::jsonb, col_order),
                     col_hidden = COALESCE($2::jsonb, col_hidden)
     WHERE id=$3`,
    [order !== undefined ? JSON.stringify(order) : null,
     hidden !== undefined ? JSON.stringify(hidden) : null,
     req.params.id]
  );
  res.json({ ok: true });
});

// Rename tab
router.put('/:id', auth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const r = await pool.query('UPDATE tabs SET name=$1 WHERE id=$2 RETURNING *', [name.trim(), req.params.id]);
  res.json(r.rows[0]);
});

// Soft-delete: move tab to Trash (keeps its rows; restorable for 30 days)
router.delete('/:id', auth, async (req, res) => {
  await pool.query('UPDATE tabs SET deleted_at=NOW() WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
