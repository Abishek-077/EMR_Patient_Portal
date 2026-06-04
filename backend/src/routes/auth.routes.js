import { Router } from 'express';
import { requireAuth, getBearerToken } from '../middleware/auth.js';
import { loginPatient, logoutPatient, registerPatient, toPublicUser } from '../services/auth.service.js';
import { loginSchema, signupSchema } from '../validation.js';

export const authRouter = Router();

authRouter.post('/signup', async (request, response, next) => {
  try {
    const input = signupSchema(request.body);
    const authResult = await registerPatient(input);
    response.status(201).json(authResult);
  } catch (error) {
    next(error);
  }
});

authRouter.post('/login', async (request, response, next) => {
  try {
    const input = loginSchema(request.body);
    response.json(await loginPatient(input));
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, async (request, response) => {
  response.json({ user: toPublicUser(request.auth.user), session: request.auth.session });
});

authRouter.post('/logout', requireAuth, async (request, response, next) => {
  try {
    await logoutPatient(getBearerToken(request));
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

