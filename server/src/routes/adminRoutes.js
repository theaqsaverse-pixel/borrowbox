const router = require('express').Router();
const controller = require('../controllers/adminController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');

router.use(authenticate, requireRole('admin'));

router.get('/stats', controller.stats);
router.get('/users', controller.listUsers);
router.get('/items', controller.listItems);
router.patch(
  '/users/:id/status',
  validate([{ field: 'is_active', type: 'boolean', required: true }]),
  controller.setUserStatus
);

module.exports = router;
