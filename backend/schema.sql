-- Campus IT Help Desk — PostgreSQL schema
-- Five tables: users, categories, tickets, comments, ticket_history.
-- Safe to run more than once (IF NOT EXISTS everywhere).

CREATE TABLE IF NOT EXISTS users (
  user_id       SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'student'
                CHECK (role IN ('student', 'technician', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categories must exist before tickets can reference them (fix #4 from the Oct update).
CREATE TABLE IF NOT EXISTS categories (
  category_id SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  ticket_id     SERIAL PRIMARY KEY,
  user_id       INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  technician_id INT REFERENCES users(user_id) ON DELETE SET NULL,
  category_id   INT NOT NULL REFERENCES categories(category_id),
  title         VARCHAR(150) NOT NULL,
  description   TEXT NOT NULL,
  priority      VARCHAR(10) NOT NULL DEFAULT 'Medium'
                CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status        VARCHAR(25) NOT NULL DEFAULT 'Open'
                CHECK (status IN ('Open', 'In Progress', 'Waiting for Student', 'Resolved', 'Closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,   -- set when a ticket reaches Resolved; used for resolution-time stats
  closed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS comments (
  comment_id SERIAL PRIMARY KEY,
  ticket_id  INT NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
  user_id    INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log: one row for every change made to a ticket.
CREATE TABLE IF NOT EXISTS ticket_history (
  history_id SERIAL PRIMARY KEY,
  ticket_id  INT NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
  changed_by INT REFERENCES users(user_id) ON DELETE SET NULL,  -- NULL = system (auto-close job)
  field      VARCHAR(30) NOT NULL,
  old_value  TEXT,
  new_value  TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes on the busiest lookups.
CREATE INDEX IF NOT EXISTS idx_tickets_user_id       ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status        ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_technician_id ON tickets(technician_id);
CREATE INDEX IF NOT EXISTS idx_comments_ticket_id    ON comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_history_ticket_id     ON ticket_history(ticket_id);
