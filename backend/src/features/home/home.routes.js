import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncRoute } from '../../shared/http/async-route.js';
import { getHomeForPatient } from './home.service.js';

export const homeRouter = Router();

homeRouter.get('/home', requireAuth, requirePermission('dashboard.view'), asyncRoute(async (request, response) => {
  response.json(await getHomeForPatient(request.auth.user, request.auth.access));
}));
