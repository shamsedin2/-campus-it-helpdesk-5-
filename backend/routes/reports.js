const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { STAFF } = require('../lib/lifecycle');

const router = express.Router();

const HOURS = `EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600.0`;
const round1 = (v) => (v == null ? null : Math.round(Number(v) * 10) / 10);

// GET /api/reports/summary?days=30|90|all — staff only.
router.get('/summary', requireRole(...STAFF), async (req, res) => {
  const days = /^\d+$/.test(String(req.query.days)) ? Number(req.query.days) : null;
  const range = days ? `WHERE t.created_at > NOW() - make_interval(days => ${days})` : '';
  const and = range ? `${range} AND` : 'WHERE';

  const [overall, byCategory, byPriority, byStatus, byTechnician, weekly, survival] = await Promise.all([
    db.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(t.resolved_at)::int AS resolved,
             COUNT(*) FILTER (WHERE t.status NOT IN ('Resolved','Closed'))::int AS open,
             COUNT(*) FILTER (WHERE t.status NOT IN ('Resolved','Closed') AND t.technician_id IS NULL)::int AS unassigned,
             AVG(${HOURS}) AS mean_hours,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${HOURS}) AS median_hours,
             PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ${HOURS}) AS p90_hours
      FROM tickets t ${range}`),
    db.query(`
      SELECT c.name AS category, COUNT(t.ticket_id)::int AS tickets,
             ROUND(100.0 * COUNT(t.ticket_id) / NULLIF(SUM(COUNT(t.ticket_id)) OVER (), 0), 1)::float AS pct,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${HOURS}) AS median_hours
      FROM categories c LEFT JOIN tickets t ON t.category_id = c.category_id ${range ? range.replace('WHERE', 'AND') : ''}
      GROUP BY c.name ORDER BY tickets DESC`),
    db.query(`
      SELECT t.priority, COUNT(*)::int AS tickets,
             ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)::float AS pct,
             COUNT(t.resolved_at)::int AS resolved,
             AVG(${HOURS}) AS mean_hours,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${HOURS}) AS median_hours
      FROM tickets t ${range}
      GROUP BY t.priority
      ORDER BY CASE t.priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END`),
    db.query(`
      SELECT t.status, COUNT(*)::int AS tickets FROM tickets t ${range} GROUP BY t.status
      ORDER BY array_position(ARRAY['Open','In Progress','Waiting for Student','Resolved','Closed'], t.status::text)`),
    db.query(`
      SELECT u.name,
             COUNT(t.ticket_id) FILTER (WHERE t.status NOT IN ('Resolved','Closed'))::int AS open_assigned,
             COUNT(t.resolved_at)::int AS resolved,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${HOURS}) AS median_hours
      FROM users u LEFT JOIN tickets t ON t.technician_id = u.user_id ${range ? range.replace('WHERE', 'AND') : ''}
      WHERE u.role IN ('technician','admin')
      GROUP BY u.user_id, u.name
      HAVING COUNT(t.ticket_id) > 0 OR bool_or(u.role = 'technician')
      ORDER BY resolved DESC`),
    db.query(`
      SELECT to_char(date_trunc('week', d), 'YYYY-MM-DD') AS week,
             (SELECT COUNT(*)::int FROM tickets t WHERE date_trunc('week', t.created_at) = date_trunc('week', d)) AS created,
             (SELECT COUNT(*)::int FROM tickets t WHERE date_trunc('week', t.resolved_at) = date_trunc('week', d)) AS resolved
      FROM generate_series(
        date_trunc('week', COALESCE(${days ? `NOW() - make_interval(days => ${days})` : '(SELECT MIN(created_at) FROM tickets)'}, NOW())),
        date_trunc('week', NOW()), INTERVAL '1 week') AS d
      ORDER BY week`),
    // Share of tickets still unresolved after N hours (only tickets old enough to have reached N hours count).
    db.query(`
      SELECT h AS hours,
             COUNT(*) FILTER (WHERE t.created_at <= NOW() - make_interval(hours => h))::int AS eligible,
             COUNT(*) FILTER (WHERE t.created_at <= NOW() - make_interval(hours => h)
                              AND (t.resolved_at IS NULL OR ${HOURS} > h))::int AS still_open
      FROM unnest(ARRAY[24, 48, 72]) AS h CROSS JOIN tickets t ${range}
      GROUP BY h ORDER BY h`),
  ]);

  const o = overall.rows[0];
  res.json({
    range: days ? `${days} days` : 'all time',
    generated_at: new Date().toISOString(),
    overall: {
      total: o.total, resolved: o.resolved, open: o.open, unassigned: o.unassigned,
      pct_resolved: o.total ? round1((100 * o.resolved) / o.total) : 0,
      mean_hours: round1(o.mean_hours), median_hours: round1(o.median_hours), p90_hours: round1(o.p90_hours),
    },
    byCategory: byCategory.rows.map((r) => ({ ...r, pct: r.pct || 0, median_hours: round1(r.median_hours) })),
    byPriority: byPriority.rows.map((r) => ({ ...r, mean_hours: round1(r.mean_hours), median_hours: round1(r.median_hours) })),
    byStatus: byStatus.rows,
    byTechnician: byTechnician.rows.map((r) => ({ ...r, median_hours: round1(r.median_hours) })),
    weekly: weekly.rows,
    unresolvedAfter: survival.rows.map((r) => ({
      hours: r.hours, eligible: r.eligible,
      pct: r.eligible ? round1((100 * r.still_open) / r.eligible) : 0,
    })),
  });
});

module.exports = router;
