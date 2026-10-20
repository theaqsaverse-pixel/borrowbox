const router = require('express').Router();
const { register, login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.post(
  '/register',
  validate([
    { field: 'name', required: true, minLength: 2, maxLength: 100 },
    { field: 'email', type: 'email', required: true, maxLength: 150 },
    { field: 'password', required: true, minLength: 6, maxLength: 72 },
    { field: 'phone', maxLength: 30 },
    { field: 'area', maxLength: 120 },
  ]),
  register
);

router.post(
  '/login',
  validate([
    { field: 'email', type: 'email', required: true },
    { field: 'password', required: true },
  ]),
  login
);

router.get('/me', authenticate, me);

module.exports = router;
