require('dotenv').config();
const app = require('./app');
const { initDb } = require('./scripts/initDb');
const { scheduleAutoClose } = require('./jobs/autoClose');

const PORT = process.env.PORT || 4000;

// Make sure tables exist (safe to run every start), then start listening.
initDb({ quiet: true })
  .then(() => {
    scheduleAutoClose();
    app.listen(PORT, () => console.log(`Campus IT Help Desk API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Could not connect to the database:', err.message);
    process.exit(1);
  });
