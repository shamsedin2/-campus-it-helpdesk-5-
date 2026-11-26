// Synthetic test data for the help desk (no real student data — FERPA).
// Fixed random seed 439 so every run produces the same data set.
//
// Usage:
//   npm run seed                 -> 200 students, 6 technicians, 600 tickets
//   npm run seed -- --tickets=1200   -> larger set for load testing
//
// WARNING: this wipes all existing tickets and users, then rebuilds them.
const bcrypt = require('bcryptjs');
const db = require('../db');
const { initDb, CATEGORIES } = require('./initDb');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, '').split('='))
);
const N_TICKETS = Number(args.tickets || 600);
const N_STUDENTS = Number(args.students || 200);
const SEED = Number(args.seed || 439);

// ---------- deterministic random helpers ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of entries) { if ((r -= w) <= 0) return value; }
  return entries[entries.length - 1][0];
}
function normal() { // Box–Muller
  let u = 0; while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
const logNormal = (median, sigma) => Math.exp(Math.log(median) + sigma * normal());

// ---------- shapes of the data ----------
const CATEGORY_WEIGHTS = [
  ['Password/Account', 26], ['Wi-Fi/Internet', 22], ['Software', 13], ['Email', 10],
  ['Printer', 10], ['Computer Hardware', 8], ['Classroom Technology', 7], ['Other', 4],
];
const PRIORITY_WEIGHTS = [['Low', 30], ['Medium', 37], ['High', 23], ['Urgent', 10]];
// Median hours to resolve, by priority (log-normal service times).
const MEDIAN_HOURS = { Urgent: 3.3, High: 10, Medium: 23, Low: 34 };

const TITLES = {
  'Password/Account': ['Locked out of my student portal', 'Password reset link not arriving', 'MFA app not accepting my code', 'Cannot log in to Canvas', 'Account says it is disabled'],
  'Wi-Fi/Internet': ['Wi-Fi keeps dropping in the library', 'Cannot connect to campus Wi-Fi', 'Very slow internet in my dorm', 'Ethernet port not working in my room', 'Wi-Fi outage in the Science Center'],
  'Software': ['Microsoft Office says unlicensed', 'Cannot install SPSS for my stats class', 'Zoom crashes when I share my screen', 'Adobe Acrobat will not open PDFs', 'Lab computer missing required software'],
  'Email': ['Not receiving emails from professors', 'Outlook will not sync on my phone', 'Mailbox is full', 'Emails going straight to junk', 'Cannot send attachments'],
  'Printer': ['Library printer jammed', 'Print job stuck in the queue', 'Printer says out of toner', 'Cannot add the campus printer', 'Prints are coming out blank'],
  'Computer Hardware': ['Laptop screen flickering', 'Keyboard keys not working', 'Laptop will not turn on', 'Lab PC making a loud noise', 'Charging port is loose'],
  'Classroom Technology': ['Projector not turning on in room 214', 'No sound from classroom speakers', 'HDMI connection not working at podium', 'Smart board not responding', 'Document camera is blurry'],
  'Other': ['Question about student software discounts', 'Need help setting up a new device', 'Request for a loaner laptop', 'Where do I report a phishing email?', 'General tech question'],
};
const STAFF_REPLIES = [
  'Thanks for reporting this. I am looking into it now.',
  'Can you tell me which building and room you are in?',
  'Could you send a screenshot of the error message?',
  'I have reset this on our end. Please try again and let me know.',
  'This should be fixed now. Let us know if it happens again.',
];
const STUDENT_REPLIES = [
  'Thank you! It is working now.',
  'It happened again this morning.',
  'I am in the library, second floor.',
  'Here is what the error says: "Access denied".',
  'Tried that, still not working.',
];
const FIRST = ['Ava', 'Liam', 'Mia', 'Noah', 'Emma', 'Ethan', 'Sofia', 'Lucas', 'Chloe', 'Mason', 'Zara', 'Omar', 'Grace', 'Isaac', 'Nina', 'Leo', 'Hana', 'Caleb', 'Aaliyah', 'Diego', 'Priya', 'Jamal', 'Elena', 'Kai', 'Maya'];
const LAST = ['Johnson', 'Patel', 'Nguyen', 'Garcia', 'Smith', 'Kim', 'Brown', 'Lopez', 'Davis', 'Martin', 'Okafor', 'Rossi', 'Chen', 'Walsh', 'Hughes', 'Ali', 'Murphy', 'Reyes', 'Cohen', 'Bennett'];
const TECHS = ['Sam Rivera', 'Alex Morgan', 'Priya Shah', 'Marcus Lee', 'Tasha Green', 'Ben Carter'];

const HOUR = 3600 * 1000;

async function seed() {
  console.log(`Seeding ${N_STUDENTS} students, ${TECHS.length} technicians, ${N_TICKETS} tickets (seed ${SEED})…`);
  await db.query('DROP TABLE IF EXISTS ticket_history, comments, tickets, categories, users CASCADE');
  await initDb({ quiet: true }); // recreates tables + categories + demo accounts

  const studentHash = await bcrypt.hash('student123', 10);
  const techHash = await bcrypt.hash('tech123', 10);

  await db.withTransaction(async (c) => {
    const cats = (await c.query('SELECT category_id, name FROM categories')).rows;
    const catId = Object.fromEntries(cats.map((r) => [r.name, r.category_id]));

    // Technicians: the demo tech (Sam Rivera) already exists; add the other five.
    for (let i = 1; i < TECHS.length; i++) {
      const email = TECHS[i].toLowerCase().replace(' ', '.') + '@campus.edu';
      await c.query('INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [TECHS[i], email, techHash, 'technician']);
    }
    const techIds = (await c.query("SELECT user_id FROM users WHERE role='technician' ORDER BY user_id")).rows.map((r) => r.user_id);

    // Students (the demo student already exists and is included in the pool).
    const used = new Set();
    for (let i = 0; i < N_STUDENTS - 1; i++) {
      let name, email;
      do {
        name = `${pick(FIRST)} ${pick(LAST)}`;
        email = `${name.toLowerCase().replace(' ', '.')}${Math.floor(rand() * 90 + 10)}@campus.edu`;
      } while (used.has(email));
      used.add(email);
      await c.query('INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)', [name, email, studentHash, 'student']);
    }
    const studentIds = (await c.query("SELECT user_id FROM users WHERE role='student' ORDER BY user_id")).rows.map((r) => r.user_id);

    // Tickets spread from the first day of the fall semester until now.
    const start = new Date('2026-08-24T08:00:00Z').getTime();
    const now = Date.now();

    for (let i = 0; i < N_TICKETS; i++) {
      const category = weighted(CATEGORY_WEIGHTS);
      let priority = weighted(PRIORITY_WEIGHTS);
      if (category === 'Classroom Technology' && rand() < 0.25) priority = 'Urgent';
      const title = pick(TITLES[category]);
      if (/outage/i.test(title)) priority = 'Urgent';

      // Busier on weekdays during the day.
      // Most tickets are spread over the semester; a busier recent stretch keeps a live queue.
      const zone = rand();
      let created = zone < 0.82 ? start + rand() * (now - start)
        : zone < 0.92 ? now - (3 + rand() * 11) * 24 * HOUR
        : now - rand() * 3 * 24 * HOUR;
      const d = new Date(created);
      if ((d.getUTCDay() === 0 || d.getUTCDay() === 6) && rand() < 0.6) created -= 2 * 24 * HOUR;
      d.setTime(Math.max(created, start));
      d.setUTCHours(12 + Math.floor(rand() * 10), Math.floor(rand() * 60));
      if (d.getTime() > now - HOUR) d.setTime(d.getTime() - 24 * HOUR);
      created = Math.max(d.getTime(), start);

      const studentId = rand() < 0.03 ? studentIds[0] : pick(studentIds);
      const techId = pick(techIds);
      const hours = Math.min(logNormal(MEDIAN_HOURS[priority], 0.85), 400);
      const resolvedAt = created + hours * HOUR;

      let status, assigned = techId, resolved = null, closed = null;
      if (resolvedAt <= now) {
        resolved = resolvedAt;
        const age = now - resolvedAt;
        if (age > 7 * 24 * HOUR || rand() < 0.45) { status = 'Closed'; closed = Math.min(resolvedAt + (age > 7 * 24 * HOUR ? 7 * 24 * HOUR * rand() : age * rand()), now); }
        else status = 'Resolved';
      } else {
        const r = rand();
        if (r < 0.35) { status = 'Open'; assigned = rand() < 0.7 ? null : techId; }
        else if (r < 0.75) status = 'In Progress';
        else status = 'Waiting for Student';
        if (status === 'Open' && assigned) status = 'In Progress';
      }

      const ts = (ms) => new Date(ms).toISOString();
      const updated = closed || resolved || Math.min(created + rand() * (now - created), now);
      const description = `${title}. ${pick(['It started yesterday.', 'This has been happening all week.', 'It started this morning.', 'I need this fixed for an assignment due soon.', 'Other students are having the same problem.'])}`;

      const t = await c.query(
        `INSERT INTO tickets (user_id, technician_id, category_id, title, description, priority, status, created_at, updated_at, resolved_at, closed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ticket_id`,
        [studentId, assigned, catId[category], title, description, priority, status, ts(created), ts(updated), resolved && ts(resolved), closed && ts(closed)]
      );
      const id = t.rows[0].ticket_id;

      // History + comments that tell the ticket's story.
      const hist = [];
      const comments = [];
      const firstTouch = created + Math.min(hours * 0.2, 4) * HOUR;
      hist.push([id, studentId, 'created', null, 'Open', ts(created)]);
      if (assigned) {
        hist.push([id, assigned, 'technician', null, String(assigned), ts(firstTouch)]);
        if (status !== 'Open') hist.push([id, assigned, 'status', 'Open', 'In Progress', ts(firstTouch)]);
        comments.push([id, assigned, pick(STAFF_REPLIES.slice(0, 3)), ts(firstTouch + 0.1 * HOUR)]);
      }
      if (status === 'Waiting for Student') {
        hist.push([id, assigned, 'status', 'In Progress', 'Waiting for Student', ts(Math.min(firstTouch + HOUR, now))]);
      }
      if (resolved) {
        if (rand() < 0.5) comments.push([id, studentId, pick(STUDENT_REPLIES.slice(2)), ts(firstTouch + (resolved - firstTouch) / 2)]);
        hist.push([id, assigned, 'status', 'In Progress', 'Resolved', ts(resolved)]);
        comments.push([id, assigned, STAFF_REPLIES[4], ts(resolved)]);
      }
      if (closed) {
        const byStudent = closed - resolved < 7 * 24 * HOUR - HOUR;
        hist.push([id, byStudent ? studentId : null, 'status', 'Resolved', 'Closed', ts(closed)]);
        if (byStudent) comments.push([id, studentId, STUDENT_REPLIES[0], ts(closed)]);
      }

      for (const h of hist) {
        await c.query('INSERT INTO ticket_history (ticket_id, changed_by, field, old_value, new_value, changed_at) VALUES ($1,$2,$3,$4,$5,$6)', h);
      }
      for (const cm of comments) {
        await c.query('INSERT INTO comments (ticket_id, user_id, body, created_at) VALUES ($1,$2,$3,$4)', cm);
      }
    }
  });

  const { rows } = await db.query('SELECT status, COUNT(*)::int AS n FROM tickets GROUP BY status ORDER BY n DESC');
  console.log('Done. Tickets by status:', rows.map((r) => `${r.status}: ${r.n}`).join(', '));
  console.log('Every seeded student password is student123; every technician password is tech123.');
}

seed()
  .then(() => db.pool.end())
  .catch((err) => { console.error(err); process.exit(1); });
