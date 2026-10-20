const router = require('express').Router();
const controller = require('../controllers/reviewController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.put(
  '/:id',
  authenticate,
  validate([
    { field: 'rating', type: 'int', min: 1, max: 5 },
    { field: 'comment', maxLength: 1000 },
  ]),
  controller.update
);
router.delete('/:id', authenticate, controller.remove);

module.exports = router;
