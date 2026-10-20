const router = require('express').Router();
const controller = require('../controllers/bookingController');
const reviewController = require('../controllers/reviewController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

router.post(
  '/',
  validate([
    { field: 'item_id', type: 'int', required: true, min: 1, label: 'Item' },
    { field: 'start_date', type: 'date', required: true, label: 'Start date' },
    { field: 'end_date', type: 'date', required: true, label: 'End date' },
    { field: 'message', maxLength: 500 },
  ]),
  controller.create
);

// fixed paths BEFORE /:id
router.get('/mine', controller.mine);
router.get('/incoming', controller.incoming);

router.get('/:id', controller.getOne);

router.put(
  '/:id',
  validate([
    { field: 'start_date', type: 'date', label: 'Start date' },
    { field: 'end_date', type: 'date', label: 'End date' },
    { field: 'message', maxLength: 500 },
  ]),
  controller.update
);

router.delete('/:id', controller.remove);

router.patch(
  '/:id/status',
  validate([
    { field: 'action', type: 'enum', required: true, values: ['approve', 'reject', 'cancel', 'pickup', 'return'] },
    { field: 'note', maxLength: 500 },
    { field: 'reason', maxLength: 500 },
    { field: 'condition', type: 'enum', values: ['new', 'good', 'fair'] },
  ]),
  controller.changeStatus
);

router.post(
  '/:id/reviews',
  validate([
    { field: 'rating', type: 'int', required: true, min: 1, max: 5 },
    { field: 'comment', maxLength: 1000 },
  ]),
  reviewController.create
);

module.exports = router;
