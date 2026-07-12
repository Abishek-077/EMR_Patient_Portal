export class ApiError extends Error {
  constructor(statusCode, message, details = undefined, code = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code || codeForStatus(statusCode);
    this.details = details;
    this.fieldErrors = details?.fieldErrors;
  }
}

export function badRequest(message, details) {
  return new ApiError(400, message, details);
}

export function unauthorized(message = 'Authentication required') {
  return new ApiError(401, message);
}

export function forbidden(message = 'Access denied') {
  return new ApiError(403, message);
}

export function notFound(message = 'Resource not found') {
  return new ApiError(404, message);
}

export function conflict(message) {
  return new ApiError(409, message);
}

function codeForStatus(statusCode) {
  return {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
  }[statusCode] || 'API_ERROR';
}
