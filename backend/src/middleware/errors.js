import { ApiError } from '../errors.js';

export function notFoundHandler(request, response) {
  response.status(404).json({
    error: 'Route not found',
    method: request.method,
    path: request.originalUrl,
  });
}

export function errorHandler(error, _request, response, _next) {
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  console.error(error);
  response.status(500).json({ error: 'Internal server error' });
}

