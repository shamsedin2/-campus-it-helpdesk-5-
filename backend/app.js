// The Express app (without .listen) so tests can import it with Supertest.
const express = require('express');
const cors = require('cors');

const app = express();

// Only the deployed frontend (and local dev) may call the API from a browser.
const allowed = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
    // Allow Vercel preview URLs for the same project, e.g. campus-helpdesk-git-main-you.vercel.app
    if (allowed.some((a) => a.endsWith('.vercel.app')) && /\.vercel\.app$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
}));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api', require('./routes/meta')); // /api/categories, /api/stats

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 passes errors from async routes here.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

module.exports = app;
