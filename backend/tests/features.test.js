// Search, filters, editing, dashboards, and user management.
const { api, db, resetDb, login, newStudent, createTicket, auth } = require('./helpers');

let tech, admin, techId, s;

beforeAll(async () => {
  await resetDb();
  tech = await login('tech@campus.edu', 'tech123');
  admin = await login('admin@campus.edu', 'admin123');
  techId = (await db.query("SELECT user_id FROM users WHERE email = 'tech@campus.edu'")).rows[0].user_id;
  s = await newStudent();
  await createTicket(s.token, { title: 'Printer jam in library', category_id: 7, priority: 'Low' });
  await createTicket(s.token, { title: 'Projector dead in room 214', category_id: 6, priority: 'Urgent' });
  const t = await createTicket(s.token, { title: 'Outlook will not sync', category_id: 5, priority: 'Medium' });
  await api().put(`/api/tickets/${t.id}/assign`).set(auth(tech)).send({ technician_id: techId });
});
afterAll(() => db.pool.end());

const get = (token, url) => api().get(url).set(auth(token));

describe('ticket list filters', () => {
  test('staff default sort puts Urgent first', async () => {
    const res = await get(tech, '/api/tickets');
    expect(res.body.tickets[0].priority).toBe('Urgent');
    expect(res.body.total).toBe(3);
  });
  test('search by text, by #id, and by student name', async () => {
    expect((await get(tech, '/api/tickets?q=printer')).body.total).toBe(1);
    const first = (await get(tech, '/api/tickets?sort=oldest')).body.tickets[0];
    expect((await get(tech, `/api/tickets?q=%23${first.id}`)).body.tickets[0].id).toBe(first.id);
    expect((await get(tech, `/api/tickets?q=${encodeURIComponent(s.user.name)}`)).body.total).toBe(3);
  });
  test('filter by status, priority, category, technician, active', async () => {
    expect((await get(tech, '/api/tickets?status=Open')).body.total).toBe(2);
    expect((await get(tech, '/api/tickets?status=Open,In%20Progress')).body.total).toBe(3);
    expect((await get(tech, '/api/tickets?priority=Urgent,High')).body.total).toBe(1);
    expect((await get(tech, '/api/tickets?category_id=7')).body.total).toBe(1);
    expect((await get(tech, '/api/tickets?technician=none')).body.total).toBe(2);
    expect((await get(tech, '/api/tickets?technician=me')).body.total).toBe(1);
    expect((await get(tech, `/api/tickets?technician=${techId}`)).body.total).toBe(1);
    expect((await get(tech, '/api/tickets?active=true&sort=newest')).body.total).toBe(3);
  });
  test('paging with limit and offset', async () => {
    const res = await get(tech, '/api/tickets?limit=2&offset=2&sort=updated');
    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.total).toBe(3);
  });
  test('unknown ticket id returns 404', async () => {
    expect((await get(tech, '/api/tickets/99999')).status).toBe(404);
    expect((await get(tech, '/api/tickets/abc')).status).toBe(404);
  });
});

describe('editing tickets', () => {
  test('owner can edit while Open; change is logged', async () => {
    const t = await createTicket(s.token);
    const res = await api().put(`/api/tickets/${t.id}`).set(auth(s.token)).send({ title: 'Wi-Fi drops in dorm', description: 'More detail', priority: 'Urgent', category_id: 3 });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Wi-Fi drops in dorm');
    expect(res.body.history.map((h) => h.field)).toEqual(expect.arrayContaining(['title', 'priority', 'description']));
  });
  test('owner cannot edit once work has started; staff can', async () => {
    const t = await createTicket(s.token);
    await api().put(`/api/tickets/${t.id}/assign`).set(auth(tech)).send({ technician_id: techId });
    expect((await api().put(`/api/tickets/${t.id}`).set(auth(s.token)).send({ title: 'x' })).status).toBe(400);
    expect((await api().put(`/api/tickets/${t.id}`).set(auth(tech)).send({ priority: 'Low' })).body.priority).toBe('Low');
  });
  test('edit validation', async () => {
    const t = await createTicket(s.token);
    const put = (body) => api().put(`/api/tickets/${t.id}`).set(auth(tech)).send(body);
    expect((await put({ title: '' })).status).toBe(400);
    expect((await put({ description: '  ' })).status).toBe(400);
    expect((await put({ priority: 'Panic' })).status).toBe(400);
    expect((await put({ category_id: 999 })).status).toBe(400);
  });
  test('assigning rules: unassign, non-staff, bad id', async () => {
    const t = await createTicket(s.token);
    const assign = (body) => api().put(`/api/tickets/${t.id}/assign`).set(auth(admin)).send(body);
    expect((await assign({ technician_id: s.user.id })).status).toBe(400);
    expect((await assign({ technician_id: 'abc' })).status).toBe(400);
    await assign({ technician_id: techId });
    const res = await assign({ technician_id: null });
    expect(res.status).toBe(200);
    expect(res.body.technician).toBeNull();
    expect(res.body.history.filter((h) => h.field === 'technician').at(-1).old_value).toBe('Sam Rivera');
  });
  test('comment validation', async () => {
    const t = await createTicket(s.token);
    expect((await api().post(`/api/tickets/${t.id}/comments`).set(auth(s.token)).send({ body: '   ' })).status).toBe(400);
  });
});

describe('dashboards', () => {
  test('student stats only count their own tickets', async () => {
    const other = await newStudent();
    await createTicket(other.token);
    const res = await get(other.token, '/api/stats');
    expect(res.body.total).toBe(1);
    expect(res.body.unassigned).toBeUndefined();
  });
  test('staff stats include unassigned and mine', async () => {
    const res = await get(tech, '/api/stats');
    expect(res.body.unassigned).toBeGreaterThan(0);
    expect(res.body.mine).toBeGreaterThan(0);
  });
  test('categories list has 8 entries', async () => {
    expect((await get(s.token, '/api/categories')).body).toHaveLength(8);
  });
  test('reports can be limited to a date range', async () => {
    const res = await get(admin, '/api/reports/summary?days=30');
    expect(res.body.range).toBe('30 days');
    expect(res.body.overall.total).toBeGreaterThan(0);
  });
  test('GET /api/auth/me returns the current user', async () => {
    expect((await get(s.token, '/api/auth/me')).body.user.email).toBe(s.user.email);
  });
});

describe('user management', () => {
  test('staff can list and search users', async () => {
    const res = await get(tech, '/api/users?role=staff');
    expect(res.body.users.every((u) => u.role !== 'student')).toBe(true);
    expect((await get(tech, '/api/users?role=student&q=Student')).body.users.length).toBeGreaterThan(0);
  });
  test('admin creates a technician account that can log in', async () => {
    const res = await api().post('/api/users').set(auth(admin)).send({ name: 'New Tech', email: 'newtech@campus.edu', password: 'password123', role: 'technician' });
    expect(res.status).toBe(201);
    expect(await login('newtech@campus.edu', 'password123')).toBeTruthy();
    expect((await api().post('/api/users').set(auth(admin)).send({ name: 'Dup', email: 'newtech@campus.edu', password: 'password123' })).status).toBe(409);
    expect((await api().post('/api/users').set(auth(admin)).send({ name: 'Bad', email: 'b@campus.edu', password: 'password123', role: 'king' })).status).toBe(400);
  });
  test('admin cannot change own role; demoting a tech unassigns their tickets', async () => {
    const me = (await get(admin, '/api/auth/me')).body.user;
    expect((await api().put(`/api/users/${me.id}/role`).set(auth(admin)).send({ role: 'student' })).status).toBe(400);
    expect((await api().put('/api/users/99999/role').set(auth(admin)).send({ role: 'student' })).status).toBe(404);

    const t = await api().post('/api/users').set(auth(admin)).send({ name: 'Temp Tech', email: 'temp@campus.edu', password: 'password123' });
    const ticket = await createTicket(s.token);
    await api().put(`/api/tickets/${ticket.id}/assign`).set(auth(admin)).send({ technician_id: t.body.id });
    await api().put(`/api/users/${t.body.id}/role`).set(auth(admin)).send({ role: 'student' });
    expect((await get(admin, `/api/tickets/${ticket.id}`)).body.technician).toBeNull();
  });
  test('unknown API route returns 404 and bad JSON returns 400', async () => {
    expect((await api().get('/api/nope')).status).toBe(404);
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
  });
});
