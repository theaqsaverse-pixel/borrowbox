/**
 * Database setup helper - works on Windows/Mac/Linux without needing psql.
 *
 *   npm run db:setup      -> creates the database if missing, runs schema.sql + seed.sql
 *   npm run db:schema     -> creates the database if missing, runs schema.sql only
 *
 * Reads DATABASE_URL from server/.env
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const env = require('../config/env');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');
const SEED_FILE = path.join(__dirname, 'seed.sql');

const sslOption = () => (env.DB_SSL ? { rejectUnauthorized: false } : false);

/** Create the target database when it does not exist yet. */
async function ensureDatabase(databaseUrl = env.DATABASE_URL) {
  const url = new URL(databaseUrl);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    throw new Error(`Unsupported database name "${dbName}" (use letters, numbers and underscores)`);
  }

  // Connect to the default maintenance database to look for / create ours.
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString(), ssl: sslOption() });
  try {
    await admin.connect();
  } catch (err) {
    // Hosted databases (Neon, Render ...) often forbid this - assume DB already exists.
    return { created: false, skipped: true };
  }
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`); // name validated above
      return { created: true };
    }
    return { created: false };
  } finally {
    await admin.end();
  }
}

/** Execute a whole .sql file (multiple statements) on the given database. */
async function runSqlFile(databaseUrl, file) {
  const sql = fs.readFileSync(file, 'utf8');
  const client = new Client({ connectionString: databaseUrl, ssl: sslOption() });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function setup({ withSeed = true, databaseUrl = env.DATABASE_URL } = {}) {
  const dbResult = await ensureDatabase(databaseUrl);
  if (dbResult.created) console.log('Created database.');
  await runSqlFile(databaseUrl, SCHEMA_FILE);
  console.log('Schema applied (schema.sql).');
  if (withSeed) {
    await runSqlFile(databaseUrl, SEED_FILE);
    console.log('Sample data loaded (seed.sql).');
  }
}

module.exports = { setup, ensureDatabase, runSqlFile, SCHEMA_FILE, SEED_FILE };

if (require.main === module) {
  const schemaOnly = process.argv.includes('--schema-only');
  setup({ withSeed: !schemaOnly })
    .then(() => {
      console.log('Database is ready.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database setup failed:', err.message);
      if (err.code === 'ECONNREFUSED') {
        console.error('PostgreSQL is not reachable. Is it running, and is DATABASE_URL in server/.env correct?');
      } else if (err.code === '28P01') {
        console.error('Wrong PostgreSQL username or password in DATABASE_URL.');
      }
      process.exit(1);
    });
}
