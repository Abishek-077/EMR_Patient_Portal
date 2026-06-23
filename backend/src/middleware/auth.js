import { forbidden, unauthorized } from '../errors.js';
import { hasPermission } from '../domain/access-control.js';
import { findSessionUser } from '../services/auth.service.js';

export async function requireAuth(request, _response, next) {
  try {
    const token = getBearerToken(request);
    if (!token) throw unauthorized();

    const authContext = await findSessionUser(token);
    if (!authContext) throw unauthorized();

    request.auth = authContext;
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermission(permissionId) {
  return (request, _response, next) => {
    try {
      if (!hasPermission(request.auth?.access, permissionId)) {
        throw forbidden(`Missing permission: ${permissionId}`);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function getBearerToken(request) {
  return request.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
}
