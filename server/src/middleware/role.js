const { forbidden, unauthorized } = require('../utils/ApiError');

/** Usage: router.get('/x', authenticate, requireRole('admin'), handler) */
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden('Access denied for your role'));
    next();
  };

module.exports = { requireRole };
