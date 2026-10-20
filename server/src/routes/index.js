const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/categories', require('./categoryRoutes'));
router.use('/items', require('./itemRoutes'));
router.use('/bookings', require('./bookingRoutes'));
router.use('/reviews', require('./reviewRoutes'));
router.use('/admin', require('./adminRoutes'));

module.exports = router;
