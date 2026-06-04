import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getPortalForPatient } from '../services/portal.service.js';

export const portalRouter = Router();

portalRouter.get('/portal', requireAuth, async (request, response, next) => {
  try {
    response.json(await getPortalForPatient(request.auth.user));
  } catch (error) {
    next(error);
  }
});

