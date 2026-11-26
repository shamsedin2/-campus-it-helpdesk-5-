# Campus IT Help Desk

A full-stack ticketing app where students report technology problems and IT staff track and fix them.
Built for BUIN-439 (Holy Family University) with **React + Vite**, **Node.js + Express**, and **PostgreSQL**.

| Role | What they can do |
|---|---|
| **Student** | Register, submit tickets, see only their own tickets, reply, confirm a fix or reopen |
| **Technician** | See, search, and filter all tickets; assign; move tickets through the lifecycle; reply |
| **Admin** | Everything a technician can do, plus delete tickets, manage user roles, and create staff accounts |

**Ticket lifecycle:** Open → In Progress → Waiting for Student → Resolved → Closed.
The server enforces the allowed moves, and every change is written to `ticket_history`.
Resolved tickets close automatically after 7 days (daily `node-cron` job).

## Project structure

```
campus-it-helpdesk/
├── backend/                 Express API
│   ├── app.js               routes + middleware (imported by tests)
│   ├── server.js            starts the server, creates tables, schedules auto-close
│   ├── db.js                PostgreSQL connection pool (pg)
│   ├── schema.sql           5 tables: users, categories, tickets, comments, ticket_history
│   ├── lib/lifecycle.js     allowed status moves
│   ├── middleware/auth.js   JWT check + requireRole()
│   ├── routes/              auth, tickets, users, reports, meta
│   ├── jobs/autoClose.js    closes Resolved tickets after 7 days
│   ├── scripts/             initDb, seed (600 synthetic tickets, seed 439), loadtest
│   └── tests/               Jest + Supertest (75 tests, incl. the 30-case access matrix)
├── frontend/                React app (Vite)
│   └── src/  pages/ components/ context/ lib/ api.js
├── render.yaml              one-click Render setup for the API
└── DEPLOY.md                step-by-step hosting guide
```

## Run it on your computer

You need **Node.js 18+** and **PostgreSQL** installed.

```bash
# 1. Create the database (once)
createdb helpdesk            # or in psql: CREATE DATABASE helpdesk;

# 2. Backend
cd backend
cp .env.example .env         # then edit DATABASE_URL with your Postgres password
npm install
npm run seed                 # creates tables + 600 test tickets
npm run dev                  # API on http://localhost:4000

# 3. Frontend (second terminal)
cd frontend
npm install
npm run dev                  # app on http://localhost:5173
```

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Student | student@campus.edu | student123 |
| Technician | tech@campus.edu | tech123 |
| Admin | admin@campus.edu | admin123 |

The sign-in page also has one-click demo buttons. Every seeded student uses `student123`; every technician uses `tech123`.

## Tests and measurements

```bash
cd backend
createdb helpdesk_test       # tests use a separate database, never your real data
npm test                     # 75 tests
npm run test:coverage        # ~95% line coverage (target was 80%)
npm run seed -- --tickets=1200 && npm start   # then, in another terminal:
npm run loadtest             # 50 users for 15 s against GET /api/tickets
```

Measured locally with 1,200 tickets: median ≈ 60 ms, 97.5th percentile ≈ 94 ms, 0 errors (target: p95 < 300 ms).

## API

| Method | Endpoint | What it does | Who |
|---|---|---|---|
| POST | /api/auth/register | Create a student account | Anyone |
| POST | /api/auth/login | Log in, get a token | Anyone |
| GET | /api/auth/me | Current user | Logged in |
| GET | /api/tickets | List tickets (`status, priority, category_id, q, technician=me\|none\|id, active, sort, limit, offset`) | Students (own) / Staff (all) |
| GET | /api/tickets/:id | One ticket with comments, history, allowed moves | Owner or staff |
| POST | /api/tickets | Create a ticket | Student |
| PUT | /api/tickets/:id | Edit title, description, category, priority | Owner while Open / staff |
| PUT | /api/tickets/:id/status | Change status (optional `note`) | Staff; owner can close or reopen a Resolved ticket |
| PUT | /api/tickets/:id/assign | Assign or unassign a technician | Staff |
| POST | /api/tickets/:id/comments | Add a comment | Owner or staff |
| DELETE | /api/tickets/:id | Delete a ticket | Admin |
| GET | /api/reports/summary?days= | Counts, shares, mean/median/p90 times, weekly volume, workload | Staff |
| GET | /api/users | List users | Staff |
| POST | /api/users | Create an account with any role | Admin |
| PUT | /api/users/:id/role | Change a role | Admin |
| GET | /api/categories, /api/stats | Categories; dashboard counts | Logged in |

## Security notes

- Passwords are hashed with bcrypt; tokens are JWTs that expire after 8 hours.
- Every ticket query filters by `user_id` for students; the access-control tests check all 3 roles × 10 routes.
- Secrets live in `.env` (git-ignored) locally and in environment variables when hosted.
- CORS only allows the frontend's own address (`CORS_ORIGIN`).
- All test data is synthetic. No real student data (FERPA).

## Deploying

See **[DEPLOY.md](DEPLOY.md)**: database on Neon, API on Render, frontend on Vercel, all on free plans.
