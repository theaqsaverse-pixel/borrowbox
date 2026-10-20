/** Wrap an async route handler so rejected promises reach the error handler. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Standard JSON envelope: { success, data, message } (+ optional meta). */
function send(res, data, message = 'OK', status = 200, meta) {
  const body = { success: true, data, message };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

/** Parse an integer route/query param; returns null when it is not a positive int. */
function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

module.exports = { asyncHandler, send, toId };
