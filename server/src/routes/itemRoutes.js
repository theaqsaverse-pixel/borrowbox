const router = require('express').Router();
const controller = require('../controllers/itemController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadItemImage } = require('../middleware/upload');

const CONDITIONS = ['new', 'good', 'fair'];

const createRules = validate([
  { field: 'title', required: true, minLength: 3, maxLength: 120 },
  { field: 'description', maxLength: 2000 },
  { field: 'category_id', type: 'int', required: true, min: 1, label: 'Category' },
  { field: 'condition', type: 'enum', values: CONDITIONS },
  { field: 'max_days', type: 'int', required: true, min: 1, max: 90, label: 'Maximum lending days' },
  { field: 'pickup_area', maxLength: 120 },
  { field: 'image_url', type: 'image', label: 'Image URL' },
  { field: 'is_active', type: 'boolean' },
]);

const updateRules = validate([
  { field: 'title', minLength: 3, maxLength: 120 },
  { field: 'description', maxLength: 2000 },
  { field: 'category_id', type: 'int', min: 1, label: 'Category' },
  { field: 'condition', type: 'enum', values: CONDITIONS },
  { field: 'max_days', type: 'int', min: 1, max: 90, label: 'Maximum lending days' },
  { field: 'pickup_area', maxLength: 120 },
  { field: 'image_url', type: 'image', label: 'Image URL' },
  { field: 'is_active', type: 'boolean' },
]);

router.get('/', controller.list);
router.get('/mine', authenticate, controller.mine); // must be defined BEFORE /:id
router.get('/:id/availability', controller.availability);
router.get('/:id', optionalAuth, controller.getOne);

router.post('/', authenticate, uploadItemImage, createRules, controller.create);
router.put('/:id', authenticate, uploadItemImage, updateRules, controller.update);
router.delete('/:id', authenticate, controller.remove);

module.exports = router;
