export class AppError extends Error {
  constructor(statusCode, detail, code = 'APP_ERROR') {
    super(detail);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.detail = detail;
    this.code = code;
  }
}

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const notFoundHandler = (req, _res, next) => {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));
};

export const errorHandler = (err, _req, res, _next) => {
  if (err?.name === 'MulterError') {
    const detail = err.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds 5MB size limit' : err.message;
    return res.status(400).json({ detail });
  }

  if (err?.code === '23505') {
    return res.status(400).json({ detail: 'Duplicate value already exists' });
  }

  if (err?.code === '22P02') {
    return res.status(400).json({ detail: 'Invalid value' });
  }

  if (err?.code === '23503') {
    return res.status(409).json({ detail: 'Record cannot be deleted because it is linked to other data' });
  }

  const statusCode = err?.statusCode || 500;
  const detail = statusCode >= 500 ? 'Internal server error' : err.detail || err.message;

  if (statusCode >= 500) {
    console.error(err);
  }

  return res.status(statusCode).json({ detail });
};
