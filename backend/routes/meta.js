const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { STAFF } = require('../lib/lifecycle');

const router = express.Router();

// GET /api/categories
router.get('/categories', requireAuth, async (req, res) => {
  const { rows } = await db.query('SELECT category_id AS id, name FROM categories ORDER BY category_id');
  res.json(rows);
});

// GET /api/stats — small counts for the dashboards (students: own tickets only).
router.get('/stats', requireAuth, async (req, res) => {
  const staff = STAFF.includes(req.user.role);
  const scope = staff ? '' : 'WHERE user_id = $1';
  const args = staff ? [] : [req.user.id];

  const [byStatus, byPriority, extra] = await Promise.all([
    db.query(`SELECT status, COUNT(*)::int AS count FROM tickets ${scope} GROUP BY status`, args),
    db.query(`SELECT priority, COUNT(*)::int AS count FROM tickets ${scope ? scope + ' AND' : 'WHERE'} status NOT IN ('Resolved','Closed') GROUP BY priority`, args),
    staff
      ? db.query(`SELECT
          COUNT(*) FILTER (WHERE technician_id IS NULL AND status NOT IN ('Resolved','Closed'))::int AS unassigned,
          COUNT(*) FILTER (WHERE technician_id = $1 AND status NOT IN ('Resolved','Closed'))::int AS mine,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS last_24h,
          COUNT(*) FILTER (WHERE resolved_at > NOW() - INTERVAL '7 days')::int AS resolved_7d
         FROM tickets`, [req.user.id])
      : Promise.resolve({ rows: [{}] }),
  ]);

  const total = byStatus.rows.reduce((s, r) => s + r.count, 0);
  res.json({ total, byStatus: byStatus.rows, openByPriority: byPriority.rows, ...extra.rows[0] });
});

module.exports = router;
