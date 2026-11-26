const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { ROLES, STAFF } = require('../lib/lifecycle');

const router = express.Router();
const toInt = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);

const USER_SELECT = `
  SELECT u.user_id AS id, u.name, u.email, u.role, u.created_at,
         (SELECT COUNT(*)::int FROM tickets t WHERE t.user_id = u.user_id) AS tickets_submitted,
         (SELECT COUNT(*)::int FROM tickets t WHERE t.technician_id = u.user_id
             AND t.status NOT IN ('Resolved','Closed')) AS open_assigned
  FROM users u`;

// GET /api/users — staff. ?role=technician|staff|student, ?q=search
router.get('/', requireRole(...STAFF), async (req, res) => {
  const where = [];
  const params = [];
  if (req.query.role === 'staff') where.push(`u.role IN ('technician','admin')`);
  else if (ROLES.includes(req.query.role)) { params.push(req.query.role); where.push(`u.role = $${params.length}`); }
  if (req.query.q) { params.push(`%${req.query.q}%`); where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`); }
  const limit = Math.min(toInt(req.query.limit) || 100, 500);
  const { rows } = await db.query(
    `${USER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'technician' THEN 1 ELSE 2 END, u.name LIMIT ${limit}`,
    params
  );
  const counts = await db.query('SELECT role, COUNT(*)::int AS n FROM users GROUP BY role');
  res.json({ users: rows, counts: Object.fromEntries(counts.rows.map((r) => [r.role, r.n])) });
});

// POST /api/users — admin creates any kind of account (e.g. a new technician).
router.post('/', requireRole('admin'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = req.body.role || 'technician';
  if (!name || !email || password.length < 8) return res.status(400).json({ error: 'Name, email, and a password of at least 8 characters are required' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const exists = await db.query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount) return res.status(409).json({ error: 'An account with that email already exists' });
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING user_id AS id, name, email, role, created_at',
    [name, email, hash, role]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/users/:id/role — admin changes someone's role.
router.put('/:id/role', requireRole('admin'), async (req, res) => {
  const id = toInt(req.params.id);
  const { role } = req.body;
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role' });
  const { rows } = await db.query(
    'UPDATE users SET role = $1 WHERE user_id = $2 RETURNING user_id AS id, name, email, role, created_at',
    [role, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  // A user who is no longer staff should not keep assigned tickets.
  if (role === 'student') await db.query('UPDATE tickets SET technician_id = NULL WHERE technician_id = $1', [id]);
  res.json(rows[0]);
});

module.exports = router;
