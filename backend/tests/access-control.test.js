// The 30-case access-control matrix: 3 roles × 10 routes.
// Unauthorized requests must be refused with 401 or 403.
const { api, db, resetDb, login, newStudent, createTicket, auth } = require('./helpers');

let tokens; // { student, technician, admin }
let otherStudent; // owns the tickets the "student" role tries to reach
let techId;

beforeAll(async () => {
  await resetDb();
  const me = await newStudent();
  otherStudent = await newStudent();
  tokens = {
    student: me.token,
    technician: await login('tech@campus.edu', 'tech123'),
    admin: await login('admin@campus.edu', 'admin123'),
  };
  techId = (await db.query("SELECT user_id FROM users WHERE email = 'tech@campus.edu'")).rows[0].user_id;
});

afterAll(() => db.pool.end());

// A fresh ticket owned by the OTHER student, already assigned (so status changes are legal for staff).
async function freshTicket() {
  const t = await createTicket(otherStudent.token);
  await api().put(`/api/tickets/${t.id}/assign`).set(auth(tokens.admin)).send({ technician_id: techId });
  return t.id;
}

let n = 0;
const ROUTES = [
  { name: 'POST /api/auth/register', expect: { student: 201, technician: 201, admin: 201 },
    run: (tok) => api().post('/api/auth/register').set(auth(tok)).send({ name: 'X', email: `matrix${++n}@campus.edu`, password: 'password123' }) },
  { name: 'POST /api/auth/login', expect: { student: 200, technician: 200, admin: 200 },
    run: () => api().post('/api/auth/login').send({ email: 'admin@campus.edu', password: 'admin123' }) },
  { name: 'GET /api/tickets', expect: { student: 200, technician: 200, admin: 200 },
    run: (tok) => api().get('/api/tickets').set(auth(tok)) },
  { name: 'GET /api/tickets/:id (someone else’s)', expect: { student: 403, technician: 200, admin: 200 },
    run: async (tok) => api().get(`/api/tickets/${await freshTicket()}`).set(auth(tok)) },
  { name: 'POST /api/tickets', expect: { student: 201, technician: 403, admin: 403 },
    run: (tok) => api().post('/api/tickets').set(auth(tok)).send({ title: 'T', description: 'D', category_id: 1 }) },
  { name: 'PUT /api/tickets/:id/status', expect: { student: 403, technician: 200, admin: 200 },
    run: async (tok) => api().put(`/api/tickets/${await freshTicket()}/status`).set(auth(tok)).send({ status: 'Resolved' }) },
  { name: 'PUT /api/tickets/:id/assign', expect: { student: 403, technician: 200, admin: 200 },
    run: async (tok) => api().put(`/api/tickets/${(await createTicket(otherStudent.token)).id}/assign`).set(auth(tok)).send({ technician_id: techId }) },
  { name: 'POST /api/tickets/:id/comments (someone else’s)', expect: { student: 403, technician: 201, admin: 201 },
    run: async (tok) => api().post(`/api/tickets/${await freshTicket()}/comments`).set(auth(tok)).send({ body: 'hi' }) },
  { name: 'DELETE /api/tickets/:id', expect: { student: 403, technician: 403, admin: 204 },
    run: async (tok) => api().delete(`/api/tickets/${await freshTicket()}`).set(auth(tok)) },
  { name: 'GET /api/reports/summary', expect: { student: 403, technician: 200, admin: 200 },
    run: (tok) => api().get('/api/reports/summary').set(auth(tok)) },
];

describe.each(ROUTES)('$name', (route) => {
  test.each(['student', 'technician', 'admin'])('as %s', async (role) => {
    const res = await route.run(tokens[role]);
    expect(res.status).toBe(route.expect[role]);
  });
});

describe('requests with no token or a bad token', () => {
  const protectedCalls = [
    () => api().get('/api/tickets'),
    () => api().get('/api/tickets/1'),
    () => api().post('/api/tickets').send({}),
    () => api().put('/api/tickets/1/status').send({ status: 'Closed' }),
    () => api().put('/api/tickets/1/assign').send({}),
    () => api().post('/api/tickets/1/comments').send({ body: 'x' }),
    () => api().delete('/api/tickets/1'),
    () => api().get('/api/reports/summary'),
    () => api().get('/api/users'),
  ];
  test.each(protectedCalls.map((fn, i) => [i, fn]))('call %i without a token returns 401', async (_, fn) => {
    expect((await fn()).status).toBe(401);
  });
  test('a forged token returns 401', async () => {
    const res = await api().get('/api/tickets').set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

describe('students only ever see their own tickets', () => {
  test('GET /api/tickets returns only the caller’s tickets', async () => {
    const a = await newStudent();
    const b = await newStudent();
    await createTicket(a.token, { title: 'A ticket' });
    await createTicket(b.token, { title: 'B ticket' });
    const res = await api().get('/api/tickets?limit=200').set(auth(a.token));
    expect(res.body.tickets.length).toBe(1);
    expect(res.body.tickets.every((t) => t.student.id === a.user.id)).toBe(true);
  });
  test('a student cannot comment on, edit, or close another student’s ticket', async () => {
    const a = await newStudent();
    const b = await newStudent();
    const t = await createTicket(b.token);
    expect((await api().post(`/api/tickets/${t.id}/comments`).set(auth(a.token)).send({ body: 'x' })).status).toBe(403);
    expect((await api().put(`/api/tickets/${t.id}`).set(auth(a.token)).send({ title: 'hacked' })).status).toBe(403);
    expect((await api().put(`/api/tickets/${t.id}/status`).set(auth(a.token)).send({ status: 'Closed' })).status).toBe(403);
  });
  test('students cannot list users or change roles', async () => {
    const a = await newStudent();
    expect((await api().get('/api/users').set(auth(a.token))).status).toBe(403);
    expect((await api().put(`/api/users/${a.user.id}/role`).set(auth(a.token)).send({ role: 'admin' })).status).toBe(403);
  });
  test('registering always creates a student, even if a role is sent', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'Sneaky', email: 'sneaky@campus.edu', password: 'password123', role: 'admin' });
    expect(res.body.user.role).toBe('student');
  });
});
