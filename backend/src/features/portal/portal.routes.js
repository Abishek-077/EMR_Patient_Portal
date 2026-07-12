import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { getPortalForPatient } from './portal.service.js';

export const portalRouter = Router();

portalRouter.get('/portal', requireAuth, async (request, response, next) => {
  try {
    response.json(await getPortalForPatient(request.auth.user, request.auth.access, {
      actor: request.auth.actor,
      patientContexts: request.auth.patientContexts,
      currentPatientContext: request.auth.currentPatientContext,
    }));
  } catch (error) {
    next(error);
  }
});
