const multer = require('multer');
const { removeUploadedFile } = require('./upload');
const env = require('../config/env');

const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Clean up an uploaded file if the request failed afterwards.
  if (req.file && req.file.filename) removeUploadedFile(`/uploads/${req.file.filename}`);

  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors;

  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2 MB or smaller' : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  } else if (err.code && typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code) && !err.statusCode) {
    // PostgreSQL error codes
    switch (err.code) {
      case '23505':
        status = 409;
        message = 'A record with the same unique value already exists';
        break;
      case '23503':
        status = 409;
        message = 'This record is referenced by (or refers to) another record';
        break;
      case '23514':
      case '23502':
      case '22P02':
      case '22007':
      case '22008':
        status = 400;
        message = 'Invalid data was supplied';
        break;
      default:
        status = 500;
        message = 'Database error';
    }
  }

  if (status >= 500) {
    console.error(err);
    if (env.NODE_ENV === 'production') message = 'Internal server error';
  }

  const body = { success: false, message };
  if (errors) body.errors = errors;
  res.status(status).json(body);
};

module.exports = { errorHandler, notFoundHandler };
