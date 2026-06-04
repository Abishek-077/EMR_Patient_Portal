import { unauthorized } from '../errors.js';
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

export function getBearerToken(request) {
  return request.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
}

