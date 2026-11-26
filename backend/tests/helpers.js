// Shared test setup. Tests run against a SEPARATE database so real data is never touched.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/helpdesk_test';
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const db = require('../db');
const app = require('../app');
const { initDb } = require('../scripts/initDb');

async function resetDb() {
  await db.query('DROP TABLE IF EXISTS ticket_history, comments, tickets, categories, users CASCADE');
  await initDb({ quiet: true });
}

const api = () => request(app);

async function login(email, password) {
  const res = await api().post('/api/auth/login').send({ email, password });
  return res.body.token;
}

let counter = 0;
async function newStudent() {
  counter += 1;
  const email = `student${counter}-${Date.now()}@campus.edu`;
  const res = await api().post('/api/auth/register').send({ name: `Student ${counter}`, email, password: 'password123' });
  return { token: res.body.token, user: res.body.user };
}

async function createTicket(token, overrides = {}) {
  const res = await api().post('/api/tickets').set('Authorization', `Bearer ${token}`)
    .send({ title: 'Wi-Fi not working', description: 'Drops every few minutes', category_id: 3, priority: 'High', ...overrides });
  return res.body;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { api, db, resetDb, login, newStudent, createTicket, auth };
