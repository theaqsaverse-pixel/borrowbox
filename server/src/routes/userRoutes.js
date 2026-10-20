const router = require('express').Router();
const { updateMe, deleteMe, getPublicProfile } = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.put(
  '/me',
  authenticate,
  validate([
    { field: 'name', minLength: 2, maxLength: 100 },
    { field: 'phone', maxLength: 30 },
    { field: 'area', maxLength: 120 },
  ]),
  updateMe
);
router.delete('/me', authenticate, deleteMe);

// keep the dynamic route AFTER /me
router.get('/:id', getPublicProfile);

module.exports = router;
