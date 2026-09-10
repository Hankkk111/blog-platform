const { AppError } = require('../utils/errors');

/**
 * Centralized error handler. Anything thrown (or passed to next()) from a
 * route handler ends up here instead of scattered try/catch blocks with
 * inconsistent response shapes.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Mongoose validation errors (from schema `required`/`match`/etc rules)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join('; ') });
  }

  // Duplicate key error (e.g. unique username/email already taken)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ message: `${field} is already taken` });
  }

  // Invalid ObjectId format passed in a route param
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid id: ${err.value}` });
  }

  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
}

module.exports = { errorHandler };
