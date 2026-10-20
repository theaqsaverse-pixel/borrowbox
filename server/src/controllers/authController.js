const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const { unauthorized, forbidden, conflict } = require('../utils/ApiError');
const { asyncHandler, send } = require('../utils/helpers');

const PUBLIC_COLUMNS = 'id, name, email, phone, area, role, is_active, created_at';

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

/** POST /api/auth/register */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, area } = req.body;

  const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount) throw conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 10);
  // role is ALWAYS "member" here - admins are created in the database only.
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, phone, area)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, phone || null, area || null]
  );
  const user = rows[0];
  return send(res, { user, token: signToken(user) }, 'Account created', 201);
});

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
  const row = rows[0];

  // same message for "no such user" and "wrong password" - do not leak which one
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    throw unauthorized('Invalid email or password');
  }
  if (!row.is_active) throw forbidden('Your account has been deactivated. Please contact an administrator.');

  const { password_hash, deleted_at, ...user } = row;
  return send(res, { user, token: signToken(user) }, 'Logged in');
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => send(res, { user: req.user }));

module.exports = { register, login, me };
