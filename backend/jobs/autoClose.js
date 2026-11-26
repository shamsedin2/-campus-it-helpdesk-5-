// Closes tickets that have been Resolved for more than 7 days with no reply from the student.
// Runs once at startup and then every day at 2:00 AM (node-cron).
const cron = require('node-cron');
const db = require('../db');

async function autoCloseResolved(days = 7) {
  return db.withTransaction(async (c) => {
    const { rows } = await c.query(
      `UPDATE tickets SET status = 'Closed', closed_at = NOW(), updated_at = NOW()
       WHERE status = 'Resolved' AND resolved_at < NOW() - make_interval(days => $1)
       RETURNING ticket_id`,
      [days]
    );
    for (const r of rows) {
      await c.query(
        `INSERT INTO ticket_history (ticket_id, changed_by, field, old_value, new_value)
         VALUES ($1, NULL, 'status', 'Resolved', 'Closed')`,
        [r.ticket_id]
      );
    }
    return rows.length;
  });
}

function scheduleAutoClose() {
  const run = () => autoCloseResolved()
    .then((n) => n && console.log(`Auto-close: closed ${n} ticket(s) resolved more than 7 days ago`))
    .catch((err) => console.error('Auto-close failed:', err.message));
  run();
  cron.schedule('0 2 * * *', run);
}

module.exports = { autoCloseResolved, scheduleAutoClose };
