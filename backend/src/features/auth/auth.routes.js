import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  changePassword,
  confirmPasswordReset,
  loginPatient,
  logoutPatient,
  registerPatient,
  requestPasswordReset,
  toPublicUser,
} from './auth.service.js';
import { loginSchema, signupSchema } from '../../validation.js';
import { env } from '../../config.js';
import { badRequest } from '../../errors.js';

export const authRouter = Router();

authRouter.post('/signup', async (request, response, next) => {
  try {
    const input = signupSchema(request.body);
    const authResult = await registerPatient(input, { rememberMe: request.body?.rememberMe === true });
    setSessionCookie(response, authResult);
    response.setHeader('Cache-Control', 'no-store');
    response.status(201).json(authResult);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (request, response, next) => {
  try {
    const input = loginSchema(request.body);
    const authResult = await loginPatient(input, { rememberMe: request.body?.rememberMe === true });
    setSessionCookie(response, authResult);
    response.setHeader('Cache-Control', 'no-store');
    response.json(authResult);
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.json({
    user: toPublicUser(request.auth.actor, request.auth.access),
    subjectUser: {
      id: request.auth.subjectUser.id,
      fullName: request.auth.subjectUser.fullName,
      email: request.auth.subjectUser.email,
      patientId: request.auth.subjectUser.patientId || '',
    },
    session: request.auth.session,
    access: {
      roles: request.auth.access.roles,
      roleLabels: request.auth.access.roleLabels,
      permissions: request.auth.access.permissions,
      status: request.auth.access.status,
    },
    csrfToken: request.auth.csrfToken,
    patientContexts: request.auth.patientContexts,
    currentPatientContext: request.auth.currentPatientContext,
  });
});

authRouter.post('/password/change', requireAuth, async (request, response, next) => {
  try {
    const currentPassword = requiredString(request.body?.currentPassword, 'currentPassword', 256);
    const newPassword = requiredString(request.body?.newPassword, 'newPassword', 256);
    response.setHeader('Cache-Control', 'no-store');
    response.json(await changePassword(request.auth.actor, request.auth.session.id, { currentPassword, newPassword }));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/password-reset/request', async (request, response, next) => {
  try {
    const email = requiredString(request.body?.email, 'email', 320);
    response.setHeader('Cache-Control', 'no-store');
    response.status(202).json(await requestPasswordReset(email));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/password-reset/confirm', async (request, response, next) => {
  try {
    const token = requiredString(request.body?.token, 'token', 512);
    const newPassword = requiredString(request.body?.newPassword, 'newPassword', 256);
    response.setHeader('Cache-Control', 'no-store');
    response.json(await confirmPasswordReset(token, newPassword));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', requireAuth, async (request, response, next) => {
  try {
    await logoutPatient(request.auth.token);
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

function setSessionCookie(response, authResult) {
  const options = {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
  };
  if (authResult.session.rememberMe) {
    options.expires = new Date(authResult.session.expiresAt);
  }
  response.cookie('emr_session', authResult.token, options);
}

function clearSessionCookie(response) {
  response.clearCookie('emr_session', {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
  });
}

function requiredString(value, fieldName, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized) throw badRequest(`${fieldName} is required`);
  if (normalized.length > maxLength) throw badRequest(`${fieldName} must be ${maxLength} characters or fewer`);
  return normalized;
}
