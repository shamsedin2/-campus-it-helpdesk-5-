const express = require('express');
const db = require('../db');
const { requireRole, requireAuth } = require('../middleware/auth');
const { STATUSES, PRIORITIES, STAFF, allowedTransitions, canTransition } = require('../lib/lifecycle');

const router = express.Router();

const isStaff = (user) => STAFF.includes(user.role);
const toInt = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);

// One SELECT used by list + detail so every ticket has the same shape.
const TICKET_SELECT = `
  SELECT t.ticket_id AS id, t.title, t.description, t.priority, t.status,
         t.category_id, c.name AS category,
         t.created_at, t.updated_at, t.resolved_at, t.closed_at,
         json_build_object('id', s.user_id, 'name', s.name, 'email', s.email) AS student,
         CASE WHEN tech.user_id IS NULL THEN NULL
              ELSE json_build_object('id', tech.user_id, 'name', tech.name) END AS technician,
         (SELECT COUNT(*)::int FROM comments cm WHERE cm.ticket_id = t.ticket_id) AS comment_count
  FROM tickets t
  JOIN categories c ON c.category_id = t.category_id
  JOIN users s ON s.user_id = t.user_id
  LEFT JOIN users tech ON tech.user_id = t.technician_id`;

const PRIORITY_ORDER = `CASE t.priority WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END`;
const SORTS = {
  priority: `${PRIORITY_ORDER}, t.created_at ASC`,
  newest: 't.created_at DESC',
  oldest: 't.created_at ASC',
  updated: 't.updated_at DESC',
};

async function loadTicketRow(id) {
  const { rows } = await db.query('SELECT * FROM tickets WHERE ticket_id = $1', [id]);
  return rows[0] || null;
}

// Loads the raw ticket, returns 404/403 if needed, and attaches it to req.ticket.
async function loadTicketForUser(req, res, next) {
  const id = toInt(req.params.id);
  if (!id) return res.status(404).json({ error: 'Ticket not found' });
  const ticket = await loadTicketRow(id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const owner = ticket.user_id === req.user.id;
  if (!owner && !isStaff(req.user)) return res.status(403).json({ error: 'You can only view your own tickets' });
  req.ticket = ticket;
  req.isOwner = owner;
  next();
}

async function ticketDetail(id, user) {
  const { rows } = await db.query(`${TICKET_SELECT} WHERE t.ticket_id = $1`, [id]);
  const ticket = rows[0];
  if (!ticket) return null;

  const comments = await db.query(
    `SELECT cm.comment_id AS id, cm.body, cm.created_at,
            u.user_id AS author_id, u.name AS author, u.role AS author_role
     FROM comments cm JOIN users u ON u.user_id = cm.user_id
     WHERE cm.ticket_id = $1 ORDER BY cm.created_at ASC, cm.comment_id ASC`,
    [id]
  );
  const history = await db.query(
    `SELECT h.history_id AS id, h.field, h.old_value, h.new_value, h.changed_at,
            COALESCE(u.name, 'System') AS changed_by,
            old_t.name AS old_name, new_t.name AS new_name
     FROM ticket_history h
     LEFT JOIN users u ON u.user_id = h.changed_by
     LEFT JOIN users old_t ON h.field = 'technician' AND old_t.user_id::text = h.old_value
     LEFT JOIN users new_t ON h.field = 'technician' AND new_t.user_id::text = h.new_value
     WHERE h.ticket_id = $1 ORDER BY h.changed_at ASC, h.history_id ASC`,
    [id]
  );

  const owner = ticket.student.id === user.id;
  return {
    ...ticket,
    comments: comments.rows,
    history: history.rows.map(({ old_name, new_name, ...h }) =>
      h.field === 'technician'
        ? { ...h, old_value: old_name || (h.old_value ? 'a technician' : null), new_value: new_name || (h.new_value ? 'a technician' : null) }
        : h),
    allowed_transitions: allowedTransitions(ticket.status, { isStaff: isStaff(user), isOwner: owner }),
  };
}

const logChange = (client, ticketId, userId, field, oldValue, newValue) =>
  client.query(
    'INSERT INTO ticket_history (ticket_id, changed_by, field, old_value, new_value) VALUES ($1,$2,$3,$4,$5)',
    [ticketId, userId, field, oldValue == null ? null : String(oldValue), newValue == null ? null : String(newValue)]
  );

// Applies a status change inside a transaction and records it.
async function applyStatus(client, ticket, newStatus, userId) {
  const sets = ['status = $1', 'updated_at = NOW()'];
  if (newStatus === 'Resolved') sets.push('resolved_at = NOW()', 'closed_at = NULL');
  if (newStatus === 'Closed') sets.push('closed_at = NOW()');
  if (newStatus === 'In Progress' && ticket.status === 'Resolved') sets.push('resolved_at = NULL');
  await client.query(`UPDATE tickets SET ${sets.join(', ')} WHERE ticket_id = $2`, [newStatus, ticket.ticket_id]);
  await logChange(client, ticket.ticket_id, userId, 'status', ticket.status, newStatus);
}

// ---------------------------------------------------------------------------
// GET /api/tickets — students get their own tickets; staff get every ticket.
// Filters: status, priority, category_id, q, technician (me|none|<id>), active=true
// Paging: limit (default 25, max 200), offset.  Sort: priority|newest|oldest|updated
router.get('/', requireAuth, async (req, res) => {
  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };

  if (!isStaff(req.user)) add('t.user_id = ?', req.user.id);

  const { status, priority, category_id, q, technician, active, sort } = req.query;
  if (status) {
    const list = String(status).split(',').filter((s) => STATUSES.includes(s));
    if (list.length) add('t.status = ANY(?)', list);
  }
  if (priority) {
    const list = String(priority).split(',').filter((p) => PRIORITIES.includes(p));
    if (list.length) add('t.priority = ANY(?)', list);
  }
  if (toInt(category_id)) add('t.category_id = ?', toInt(category_id));
  if (active === 'true') where.push(`t.status NOT IN ('Resolved', 'Closed')`);
  if (q && String(q).trim()) {
    const term = String(q).trim();
    if (toInt(term.replace(/^#/, ''))) add('t.ticket_id = ?', toInt(term.replace(/^#/, '')));
    else {
      params.push(`%${term}%`);
      const p = `$${params.length}`;
      where.push(`(t.title ILIKE ${p} OR t.description ILIKE ${p} OR s.name ILIKE ${p})`);
    }
  }
  if (isStaff(req.user) && technician) {
    if (technician === 'none') where.push('t.technician_id IS NULL');
    else if (technician === 'me') add('t.technician_id = ?', req.user.id);
    else if (toInt(technician)) add('t.technician_id = ?', toInt(technician));
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderSql = SORTS[sort] || (isStaff(req.user) ? SORTS.priority : SORTS.newest);
  const limit = Math.min(toInt(req.query.limit) || 25, 200);
  const offset = toInt(req.query.offset) || 0;

  const countSql = `SELECT COUNT(*)::int AS total FROM tickets t JOIN users s ON s.user_id = t.user_id ${whereSql}`;
  const [list, count] = await Promise.all([
    db.query(`${TICKET_SELECT} ${whereSql} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}`, params),
    db.query(countSql, params),
  ]);
  res.json({ tickets: list.rows, total: count.rows[0].total, limit, offset });
});

// GET /api/tickets/:id — owner or staff. Includes comments and history.
router.get('/:id', requireAuth, loadTicketForUser, async (req, res) => {
  res.json(await ticketDetail(req.ticket.ticket_id, req.user));
});

// POST /api/tickets — students submit a new ticket.
router.post('/', requireRole('student'), async (req, res) => {
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const category_id = toInt(req.body.category_id);
  const priority = req.body.priority || 'Medium';

  if (!title || !description) return res.status(400).json({ error: 'Title and description are required' });
  if (title.length > 150) return res.status(400).json({ error: 'Title must be 150 characters or fewer' });
  if (!category_id) return res.status(400).json({ error: 'Please choose a category' });
  if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
  const cat = await db.query('SELECT 1 FROM categories WHERE category_id = $1', [category_id]);
  if (!cat.rowCount) return res.status(400).json({ error: 'Invalid category' });

  const id = await db.withTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO tickets (user_id, title, description, category_id, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING ticket_id`,
      [req.user.id, title, description, category_id, priority]
    );
    await logChange(c, rows[0].ticket_id, req.user.id, 'created', null, 'Open');
    return rows[0].ticket_id;
  });
  res.status(201).json(await ticketDetail(id, req.user));
});

// PUT /api/tickets/:id — edit details. Owner while Open; staff until Closed.
router.put('/:id', requireAuth, loadTicketForUser, async (req, res) => {
  const t = req.ticket;
  const staff = isStaff(req.user);
  if (t.status === 'Closed') return res.status(400).json({ error: 'Closed tickets cannot be edited' });
  if (!staff && t.status !== 'Open') return res.status(400).json({ error: 'You can only edit a ticket while it is still Open' });

  const changes = {};
  if (req.body.title !== undefined) {
    const v = String(req.body.title).trim();
    if (!v || v.length > 150) return res.status(400).json({ error: 'Title must be 1–150 characters' });
    changes.title = v;
  }
  if (req.body.description !== undefined) {
    const v = String(req.body.description).trim();
    if (!v) return res.status(400).json({ error: 'Description cannot be empty' });
    changes.description = v;
  }
  if (req.body.priority !== undefined) {
    if (!PRIORITIES.includes(req.body.priority)) return res.status(400).json({ error: 'Invalid priority' });
    changes.priority = req.body.priority;
  }
  if (req.body.category_id !== undefined) {
    const v = toInt(req.body.category_id);
    const cat = v && (await db.query('SELECT 1 FROM categories WHERE category_id = $1', [v]));
    if (!cat || !cat.rowCount) return res.status(400).json({ error: 'Invalid category' });
    changes.category_id = v;
  }

  const fields = Object.keys(changes).filter((f) => String(changes[f]) !== String(t[f]));
  if (fields.length) {
    await db.withTransaction(async (c) => {
      const sets = fields.map((f, i) => `${f} = $${i + 1}`);
      await c.query(`UPDATE tickets SET ${sets.join(', ')}, updated_at = NOW() WHERE ticket_id = $${fields.length + 1}`,
        [...fields.map((f) => changes[f]), t.ticket_id]);
      for (const f of fields) {
        // Title/description edits are logged without the full text to keep history readable.
        const long = f === 'description';
        await logChange(c, t.ticket_id, req.user.id, f, long ? null : t[f], long ? 'edited' : changes[f]);
      }
    });
  }
  res.json(await ticketDetail(t.ticket_id, req.user));
});

// PUT /api/tickets/:id/status — staff move it through the lifecycle;
// the owner can close a Resolved ticket or reopen it.
router.put('/:id/status', requireAuth, loadTicketForUser, async (req, res) => {
  const t = req.ticket;
  const { status } = req.body;
  const note = String(req.body.note || '').trim();
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const who = { isStaff: isStaff(req.user), isOwner: req.isOwner };
  if (!who.isStaff && !(req.isOwner && allowedTransitions(t.status, who).length)) {
    return res.status(403).json({ error: 'Only IT staff can change this ticket’s status right now' });
  }
  if (!canTransition(t.status, status, who)) {
    return res.status(400).json({ error: `A ticket cannot move from “${t.status}” to “${status}”` });
  }
  if (who.isStaff && status !== 'Open' && !t.technician_id && t.status === 'Open') {
    return res.status(400).json({ error: 'Assign a technician before starting work on this ticket' });
  }

  await db.withTransaction(async (c) => {
    await applyStatus(c, t, status, req.user.id);
    if (note) await c.query('INSERT INTO comments (ticket_id, user_id, body) VALUES ($1,$2,$3)', [t.ticket_id, req.user.id, note]);
  });
  res.json(await ticketDetail(t.ticket_id, req.user));
});

// PUT /api/tickets/:id/assign — staff assign (or unassign with null) a technician.
// Assigning an Open ticket moves it to In Progress automatically.
router.put('/:id/assign', requireRole(...STAFF), loadTicketForUser, async (req, res) => {
  const t = req.ticket;
  if (t.status === 'Closed') return res.status(400).json({ error: 'Closed tickets cannot be reassigned' });
  const techId = req.body.technician_id === null || req.body.technician_id === '' ? null : toInt(req.body.technician_id);
  if (req.body.technician_id !== null && req.body.technician_id !== '' && !techId) {
    return res.status(400).json({ error: 'technician_id must be a user id or null' });
  }
  if (techId) {
    const tech = await db.query("SELECT 1 FROM users WHERE user_id = $1 AND role IN ('technician','admin')", [techId]);
    if (!tech.rowCount) return res.status(400).json({ error: 'That user is not IT staff' });
  }
  if (techId === t.technician_id) return res.json(await ticketDetail(t.ticket_id, req.user));

  await db.withTransaction(async (c) => {
    await c.query('UPDATE tickets SET technician_id = $1, updated_at = NOW() WHERE ticket_id = $2', [techId, t.ticket_id]);
    await logChange(c, t.ticket_id, req.user.id, 'technician', t.technician_id, techId);
    if (techId && t.status === 'Open') await applyStatus(c, t, 'In Progress', req.user.id);
  });
  res.json(await ticketDetail(t.ticket_id, req.user));
});

// POST /api/tickets/:id/comments — owner or staff.
// A student reply on a "Waiting for Student" ticket moves it back to In Progress.
router.post('/:id/comments', requireAuth, loadTicketForUser, async (req, res) => {
  const t = req.ticket;
  const body = String(req.body.body ?? req.body.comment ?? '').trim();
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty' });
  if (body.length > 5000) return res.status(400).json({ error: 'Comment is too long' });
  if (t.status === 'Closed') return res.status(400).json({ error: 'This ticket is closed. Please open a new ticket.' });

  await db.withTransaction(async (c) => {
    await c.query('INSERT INTO comments (ticket_id, user_id, body) VALUES ($1,$2,$3)', [t.ticket_id, req.user.id, body]);
    await c.query('UPDATE tickets SET updated_at = NOW() WHERE ticket_id = $1', [t.ticket_id]);
    if (req.isOwner && !isStaff(req.user) && t.status === 'Waiting for Student') {
      await applyStatus(c, t, 'In Progress', req.user.id);
    }
  });
  res.status(201).json(await ticketDetail(t.ticket_id, req.user));
});

// DELETE /api/tickets/:id — admin only.
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = toInt(req.params.id);
  const result = id ? await db.query('DELETE FROM tickets WHERE ticket_id = $1', [id]) : { rowCount: 0 };
  if (!result.rowCount) return res.status(404).json({ error: 'Ticket not found' });
  res.status(204).end();
});

module.exports = router;
