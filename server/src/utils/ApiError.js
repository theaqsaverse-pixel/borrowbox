class ApiError extends Error {
  constructor(statusCode, message, errors) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors; // optional field-level errors { field: message }
  }
}

module.exports = {
  ApiError,
  badRequest: (msg = 'Validation failed', errors) => new ApiError(400, msg, errors),
  unauthorized: (msg = 'Authentication required') => new ApiError(401, msg),
  forbidden: (msg = 'You are not allowed to do this') => new ApiError(403, msg),
  notFound: (msg = 'Not found') => new ApiError(404, msg),
  conflict: (msg = 'Conflict') => new ApiError(409, msg),
};
