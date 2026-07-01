import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { getDashboardForPatient } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', requireAuth, requirePermission('dashboard.view'), async (request, response, next) => {
  try {
    response.json(await getDashboardForPatient(request.auth.user, request.auth.access));
  } catch (error) {
    next(error);
  }
});
