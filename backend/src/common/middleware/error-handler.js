const { AppError } = require('../errors');
const { createLogger } = require('../logger');

const logger = createLogger('error');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Database validation failed',
        details: err.errors.map((e) => ({ field: e.path, message: e.message })),
      },
    });
  }

  logger.error('Unhandled error:', err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
}

function notFoundHandler(req, res) {
  return res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}

module.exports = { errorHandler, notFoundHandler };
