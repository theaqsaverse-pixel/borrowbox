const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const { unauthorized, forbidden } = require('../utils/ApiError');
const { asyncHandler } = require('../utils/helpers');

const USER_COLUMNS = 'id, name, email, phone, area, role, is_active, created_at';

function readToken(req) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

async function loadUser(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    throw unauthorized('Invalid or expired token');
  }
  const { rows } = await query(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [payload.id]
  );
  if (!rows[0]) throw unauthorized('User no longer exists');
  if (!rows[0].is_active) throw forbidden('Your account has been deactivated');
  return rows[0];
}

/** Requires a valid Bearer token. Sets req.user. */
const authenticate = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw unauthorized('Authentication required');
  req.user = await loadUser(token);
  next();
});

/** Sets req.user when a valid token is sent, otherwise req.user = null. */
const optionalAuth = asyncHandler(async (req, res, next) => {
  req.user = null;
  const token = readToken(req);
  if (token) {
    try {
      req.user = await loadUser(token);
    } catch (err) {
      req.user = null;
    }
  }
  next();
});

module.exports = { authenticate, optionalAuth };
