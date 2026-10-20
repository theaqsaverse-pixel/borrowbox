const router = require('express').Router();
const controller = require('../controllers/categoryController');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { validate } = require('../middleware/validate');

const nameRule = validate([{ field: 'name', required: true, minLength: 2, maxLength: 60 }]);

router.get('/', controller.list);
router.post('/', authenticate, requireRole('admin'), nameRule, controller.create);
router.put('/:id', authenticate, requireRole('admin'), nameRule, controller.rename);
router.delete('/:id', authenticate, requireRole('admin'), controller.remove);

module.exports = router;
