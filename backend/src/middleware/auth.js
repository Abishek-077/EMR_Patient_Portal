import { forbidden, unauthorized } from '../errors.js';
import { hasPermission } from '../domain/access-control.js';
import { findSessionUser, verifyCsrfToken } from '../features/auth/auth.service.js';
import { env } from '../config.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function requireAuth(request, _response, next) {
  try {
    const credentials = getAuthToken(request);
    if (!credentials.token) throw unauthorized();

    const requestedPatientContext = String(request.get('x-patient-context') || '').trim();
    const authContext = await findSessionUser(credentials.token, requestedPatientContext);
    if (!authContext) throw unauthorized();
    if (authContext.actor.mustChangePassword && !isPasswordSetupRoute(request.originalUrl)) {
      throw forbidden('A password change is required before using the portal');
    }
    if (credentials.source === 'cookie' && !SAFE_METHODS.has(request.method)) {
      const csrfToken = request.get('x-csrf-token') || '';
      if (!verifyCsrfToken(credentials.token, csrfToken)) {
        throw forbidden('A valid CSRF token is required for cookie-authenticated changes');
      }
    }

    request.auth = {
      ...authContext,
      token: credentials.token,
      tokenSource: credentials.source,
    };
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
  return getAuthToken(request).token;
}

export function getAuthToken(request) {
  const authorization = String(request.get('authorization') || '').trim();
  if (authorization) {
    const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
    return match ? { token: match[1], source: 'bearer' } : { token: '', source: 'invalid' };
  }

  const cookieToken = getCookie(request, 'emr_session');
  return cookieToken
    ? { token: cookieToken, source: 'cookie' }
    : { token: '', source: 'none' };
}

function getCookie(request, name) {
  const cookies = request.get('cookie') || '';
  const encodedValue = cookies
    .split(';')
    .map((cookie) => cookie.trim())
    .map((cookie) => {
      const separator = cookie.indexOf('=');
      return separator < 0 ? [cookie, ''] : [cookie.slice(0, separator), cookie.slice(separator + 1)];
    })
    .find(([key]) => key === name)?.[1] || '';

  try {
    return decodeURIComponent(encodedValue);
  } catch {
    return '';
  }
}

function isPasswordSetupRoute(url) {
  return [`${env.apiBasePath}/auth/me`, `${env.apiBasePath}/auth/password/change`, `${env.apiBasePath}/auth/logout`]
    .some((path) => String(url || '').split('?')[0] === path);
}
