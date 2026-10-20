const path = require('path');
const dotenv = require('dotenv');

// Always load server/.env, no matter where the process was started from.
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

module.exports = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT, 10) || 5000,
  DATABASE_URL:
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/borrowbox',
  DB_SSL: String(process.env.DB_SSL).toLowerCase() === 'true',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  // Comma separated list of allowed browser origins
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};
