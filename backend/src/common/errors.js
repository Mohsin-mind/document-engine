class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict', details = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
};
