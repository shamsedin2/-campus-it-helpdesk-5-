// State-transition tests: tickets may only move between allowed lifecycle stages,
// and every change writes a ticket_history row.
const { api, db, resetDb, login, newStudent, createTicket, auth } = require('./helpers');
const { canTransition, STATUSES } = require('../lib/lifecycle');
const { autoCloseResolved } = require('../jobs/autoClose');

let tech, admin, techId;

beforeAll(async () => {
  await resetDb();
  tech = await login('tech@campus.edu', 'tech123');
  admin = await login('admin@campus.edu', 'admin123');
  techId = (await db.query("SELECT user_id FROM users WHERE email = 'tech@campus.edu'")).rows[0].user_id;
});
afterAll(() => db.pool.end());

const setStatus = (token, id, status) => api().put(`/api/tickets/${id}/status`).set(auth(token)).send({ status });

describe('lifecycle rules (unit)', () => {
  const staff = { isStaff: true, isOwner: false };
  const owner = { isStaff: false, isOwner: true };
  test('staff follow the five-stage path', () => {
    expect(canTransition('Open', 'In Progress', staff)).toBe(true);
    expect(canTransition('In Progress', 'Waiting for Student', staff)).toBe(true);
    expect(canTransition('Waiting for Student', 'Resolved', staff)).toBe(true);
    expect(canTransition('Resolved', 'Closed', staff)).toBe(true);
  });
  test('no skipping steps or leaving Closed', () => {
    expect(canTransition('Open', 'Resolved', staff)).toBe(false);
    expect(canTransition('Open', 'Closed', staff)).toBe(false);
    for (const s of STATUSES) expect(canTransition('Closed', s, staff)).toBe(false);
  });
  test('owners may only close or reopen a Resolved ticket', () => {
    expect(canTransition('Resolved', 'Closed', owner)).toBe(true);
    expect(canTransition('Resolved', 'In Progress', owner)).toBe(true);
    expect(canTransition('Open', 'Closed', owner)).toBe(false);
    expect(canTransition('In Progress', 'Resolved', owner)).toBe(false);
  });
});

describe('a ticket from open to closed (API)', () => {
  test('full happy path with history', async () => {
    const s = await newStudent();
    const t = await createTicket(s.token);
    expect(t.status).toBe('Open');

    // Cannot start work before a technician is assigned.
    expect((await setStatus(tech, t.id, 'In Progress')).status).toBe(400);

    // Assigning moves it to In Progress automatically.
    let res = await api().put(`/api/tickets/${t.id}/assign`).set(auth(tech)).send({ technician_id: techId });
    expect(res.body.status).toBe('In Progress');
    expect(res.body.technician.id).toBe(techId);

    res = await setStatus(tech, t.id, 'Waiting for Student');
    expect(res.body.status).toBe('Waiting for Student');

    // The student's reply sends it back to In Progress.
    res = await api().post(`/api/tickets/${t.id}/comments`).set(auth(s.token)).send({ body: 'I am in the library' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('In Progress');

    res = await setStatus(tech, t.id, 'Resolved');
    expect(res.body.status).toBe('Resolved');
    expect(res.body.resolved_at).toBeTruthy();
    expect(res.body.allowed_transitions).toEqual(['In Progress', 'Closed']);

    res = await setStatus(s.token, t.id, 'Closed');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Closed');

    const statusRows = res.body.history.filter((h) => h.field === 'status').map((h) => `${h.old_value}>${h.new_value}`);
    expect(statusRows).toEqual([
      'Open>In Progress', 'In Progress>Waiting for Student', 'Waiting for Student>In Progress',
      'In Progress>Resolved', 'Resolved>Closed',
    ]);
    expect(res.body.history[0].field).toBe('created');

    // Closed tickets are locked.
    expect((await api().post(`/api/tickets/${t.id}/comments`).set(auth(s.token)).send({ body: 'x' })).status).toBe(400);
    expect((await setStatus(admin, t.id, 'In Progress')).status).toBe(400);
  });

  test('a student can reopen a Resolved ticket if it is still broken', async () => {
    const s = await newStudent();
    const t = await createTicket(s.token);
    await api().put(`/api/tickets/${t.id}/assign`).set(auth(tech)).send({ technician_id: techId });
    await setStatus(tech, t.id, 'Resolved');
    const res = await setStatus(s.token, t.id, 'In Progress');
    expect(res.body.status).toBe('In Progress');
    expect(res.body.resolved_at).toBeNull();
  });

  test('invalid moves are rejected with 400', async () => {
    const s = await newStudent();
    const t = await createTicket(s.token);
    await api().put(`/api/tickets/${t.id}/assign`).set(auth(tech)).send({ technician_id: techId });
    expect((await setStatus(tech, t.id, 'Closed')).status).toBe(400);
    expect((await setStatus(tech, t.id, 'Nonsense')).status).toBe(400);
  });
});

describe('auto-close job', () => {
  test('closes tickets resolved more than 7 days ago and logs it as System', async () => {
    const s = await newStudent();
    const oldT = await createTicket(s.token);
    const newT = await createTicket(s.token);
    for (const t of [oldT, newT]) {
      await api().put(`/api/tickets/${t.id}/assign`).set(auth(tech)).send({ technician_id: techId });
      await setStatus(tech, t.id, 'Resolved');
    }
    await db.query("UPDATE tickets SET resolved_at = NOW() - INTERVAL '8 days' WHERE ticket_id = $1", [oldT.id]);

    const closed = await autoCloseResolved();
    expect(closed).toBe(1);
    const res = await api().get(`/api/tickets/${oldT.id}`).set(auth(s.token));
    expect(res.body.status).toBe('Closed');
    expect(res.body.history.at(-1).changed_by).toBe('System');
    expect((await api().get(`/api/tickets/${newT.id}`).set(auth(s.token))).body.status).toBe('Resolved');
  });
});

describe('validation', () => {
  test('ticket needs title, description, and a real category', async () => {
    const s = await newStudent();
    const post = (body) => api().post('/api/tickets').set(auth(s.token)).send(body);
    expect((await post({ description: 'd', category_id: 1 })).status).toBe(400);
    expect((await post({ title: 't', category_id: 1 })).status).toBe(400);
    expect((await post({ title: 't', description: 'd' })).status).toBe(400);
    expect((await post({ title: 't', description: 'd', category_id: 999 })).status).toBe(400);
    expect((await post({ title: 't', description: 'd', category_id: 1, priority: 'Panic' })).status).toBe(400);
  });
  test('register rejects bad email, short password, duplicate email', async () => {
    const reg = (body) => api().post('/api/auth/register').send(body);
    expect((await reg({ name: 'A', email: 'nope', password: 'password123' })).status).toBe(400);
    expect((await reg({ name: 'A', email: 'a@campus.edu', password: 'short' })).status).toBe(400);
    expect((await reg({ name: 'A', email: 'admin@campus.edu', password: 'password123' })).status).toBe(409);
  });
  test('wrong password is refused', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'admin@campus.edu', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});

describe('reports and admin', () => {
  test('reports summary has every section', async () => {
    const res = await api().get('/api/reports/summary').set(auth(tech));
    expect(res.status).toBe(200);
    for (const k of ['overall', 'byCategory', 'byPriority', 'byStatus', 'byTechnician', 'weekly', 'unresolvedAfter']) {
      expect(res.body).toHaveProperty(k);
    }
    expect(res.body.byCategory).toHaveLength(8);
  });
  test('admin can promote a student to technician; technicians cannot', async () => {
    const s = await newStudent();
    expect((await api().put(`/api/users/${s.user.id}/role`).set(auth(tech)).send({ role: 'technician' })).status).toBe(403);
    const res = await api().put(`/api/users/${s.user.id}/role`).set(auth(admin)).send({ role: 'technician' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('technician');
  });
});
