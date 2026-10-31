const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/* eslint-disable no-unused-vars */
function errorHandler(err, req, res, next) {
  let error = err;

  // Mongoose duplicate key
  if (error && error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || 'field';
    error = ApiError.conflict(`That ${field} already exists.`, error.keyValue);
  }

  // Mongoose validation
  if (error && error.name === 'ValidationError') {
    const details = Object.values(error.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.badRequest('Please check the submitted values.', details);
  }

  // Bad ObjectId
  if (error && error.name === 'CastError') {
    error = ApiError.badRequest(`Invalid value for '${error.path}'.`);
  }

  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational || statusCode < 500;

  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? error.message : 'Something went wrong on our side. Please try again.',
    details: error.details || undefined,
    ...(env.isProduction ? {} : { stack: statusCode >= 500 ? err.stack : undefined }),
  });
}

module.exports = errorHandler;
