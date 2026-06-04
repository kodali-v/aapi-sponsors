const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const BOARD_PASSWORD = process.env.BOARD_PASSWORD || 'aapi2026';

router.post('/login', (req, res) => {
  const { name, password } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  if (password !== BOARD_PASSWORD) return res.status(401).json({ error: 'Incorrect password' });

  const token = jwt.sign({ name: name.trim() }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('sponsors_token', token, {
    httpOnly: true, secure: false, sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.json({ name: name.trim() });
});

router.get('/me', (req, res) => {
  const token = req.cookies?.sponsors_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    res.json(jwt.verify(token, JWT_SECRET));
  } catch {
    res.status(401).json({ error: 'Invalid session' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('sponsors_token');
  res.json({ ok: true });
});

module.exports = router;
