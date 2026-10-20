const app = require('./app');
const env = require('./config/env');
const { pool } = require('./config/db');

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connected');
  } catch (err) {
    console.error('Could not connect to PostgreSQL:', err.message);
    console.error('Check DATABASE_URL in server/.env and make sure the database server is running.');
    console.error('First time? Run:  npm run db:setup');
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`BorrowBox API running on http://localhost:${env.PORT}  (${env.NODE_ENV})`);
  });

  const shutdown = () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
