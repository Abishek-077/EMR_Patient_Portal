import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getPrescriptionsOverview,
  requestMedication,
  requestRefill,
  updatePreferredPharmacy,
} from '../services/prescriptions.service.js';
import { medicationRequestSchema, preferredPharmacySchema } from '../validation.js';

export const prescriptionsRouter = Router();

prescriptionsRouter.get('/', requireAuth, async (_request, response, next) => {
  try {
    response.json(await getPrescriptionsOverview());
  } catch (error) {
    next(error);
  }
});

prescriptionsRouter.post('/:prescriptionId/refills', requireAuth, async (request, response, next) => {
  try {
    response.status(201).json(await requestRefill(request.params.prescriptionId));
  } catch (error) {
    next(error);
  }
});

prescriptionsRouter.post('/medication-requests', requireAuth, async (request, response, next) => {
  try {
    response.status(201).json(await requestMedication(medicationRequestSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

prescriptionsRouter.patch('/preferred-pharmacy', requireAuth, async (request, response, next) => {
  try {
    response.json(await updatePreferredPharmacy(preferredPharmacySchema(request.body)));
  } catch (error) {
    next(error);
  }
});

