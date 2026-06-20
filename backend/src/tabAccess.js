const jwt = require('jsonwebtoken');
const { pool } = require('./db');
const JWT_SECRET = process.env.JWT_SECRET || 'change-me';

// True if the tab is unlocked, or the request carries a valid unlock token for it.
async function tabUnlocked(tabId, req) {
  if (!tabId) return true;
  const r = await pool.query('SELECT passcode_hash FROM tabs WHERE id=$1', [tabId]);
  const h = r.rows[0]?.passcode_hash;
  if (!h) return true; // not locked
  const token = req.headers['x-tab-token'];
  if (!token) return false;
  try {
    const d = jwt.verify(token, JWT_SECRET);
    return d.scope === 'tab' && d.tab === tabId;
  } catch { return false; }
}

async function rowTabId(rowId) {
  const r = await pool.query('SELECT tab_id FROM exhibit_rows WHERE id=$1', [rowId]);
  return r.rows[0]?.tab_id || null;
}

module.exports = { tabUnlocked, rowTabId };
