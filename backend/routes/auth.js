const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, signToken } = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({ id: u.user_id, name: u.name, email: u.email, role: u.role });

// POST /api/auth/register — anyone can create a STUDENT account.
router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
  if (name.length > 100) return res.status(400).json({ error: 'Name is too long' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const exists = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount) return res.status(409).json({ error: 'An account with that email already exists' });

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'student')
     RETURNING user_id, name, email, role`,
    [name, email, hash]
  );
  res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me — who am I (used to check a saved token is still valid)
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT user_id, name, email, role FROM users WHERE user_id = $1', [req.user.id]);
  if (!rows[0]) return res.status(401).json({ error: 'Please log in' });
  res.json({ user: publicUser(rows[0]) });
});

module.exports = router;
