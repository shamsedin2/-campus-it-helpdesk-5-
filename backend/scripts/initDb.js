// Creates all tables and indexes, then adds the 8 categories and the demo staff accounts.
// Usage: npm run db:init
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../db');

const CATEGORIES = [
  'Computer Hardware', 'Software', 'Wi-Fi/Internet', 'Password/Account',
  'Email', 'Classroom Technology', 'Printer', 'Other',
];

const DEMO_USERS = [
  { name: 'Dana Admin', email: 'admin@campus.edu', password: 'admin123', role: 'admin' },
  { name: 'Sam Rivera', email: 'tech@campus.edu', password: 'tech123', role: 'technician' },
  { name: 'Jordan Student', email: 'student@campus.edu', password: 'student123', role: 'student' },
];

async function initDb({ quiet = false } = {}) {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  await db.query(schema);

  for (const name of CATEGORIES) {
    await db.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }
  for (const u of DEMO_USERS) {
    const hash = await bcrypt.hash(u.password, 10);
    await db.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [u.name, u.email, hash, u.role]
    );
  }
  if (!quiet) console.log('Database ready: tables, indexes, 8 categories, demo accounts.');
}

module.exports = { initDb, CATEGORIES, DEMO_USERS };

if (require.main === module) {
  initDb()
    .then(() => db.pool.end())
    .catch((err) => { console.error(err); process.exit(1); });
}
