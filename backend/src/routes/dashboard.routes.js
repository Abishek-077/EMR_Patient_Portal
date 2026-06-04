import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDashboardForPatient } from '../services/dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', requireAuth, async (request, response, next) => {
  try {
    response.json(await getDashboardForPatient(request.auth.user));
  } catch (error) {
    next(error);
  }
});

