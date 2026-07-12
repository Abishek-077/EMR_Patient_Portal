import { ApiError } from '../errors.js';

export function notFoundHandler(request, response) {
  response.status(404).json({
    code: 'ROUTE_NOT_FOUND',
    message: 'Route not found',
    status: 404,
    requestId: request.id,
    error: 'Route not found',
  });
}

export function errorHandler(error, request, response, _next) {
  if (response.headersSent) return;

  if (error instanceof ApiError) {
    response.status(error.statusCode).json({
      code: error.code,
      message: error.message,
      status: error.statusCode,
      ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
      requestId: request.id,
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  if (error?.type === 'entity.parse.failed') {
    response.status(400).json({
      code: 'INVALID_JSON',
      message: 'Request body contains invalid JSON',
      status: 400,
      requestId: request.id,
      error: 'Request body contains invalid JSON',
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    status: 500,
    requestId: request.id,
    error: 'Internal server error',
  });
}
