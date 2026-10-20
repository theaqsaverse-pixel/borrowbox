const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const routes = require('./routes');
const { UPLOAD_DIR } = require('./middleware/upload');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // allow the React app to show /uploads images
app.use(
  cors({
    origin: env.CLIENT_URL.split(',').map((s) => s.trim()),
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Uploaded item images
app.use('/uploads', express.static(UPLOAD_DIR));

// Brute-force protection on login / register (off while running automated tests)
if (env.NODE_ENV !== 'test') {
  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' },
    })
  );
}

app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' }, message: 'BorrowBox API is running' }));
app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
