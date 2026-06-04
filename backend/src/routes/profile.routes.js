import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  addEmergencyContact,
  deleteEmergencyContact,
  getProfileOverview,
  updateEmergencyContact,
  updateInsuranceDetails,
  updateProfileSettings,
} from '../services/profile.service.js';
import { emergencyContactSchema, insuranceDetailsSchema, profileSchema } from '../validation.js';

export const profileRouter = Router();

profileRouter.get('/', requireAuth, async (_request, response, next) => {
  try {
    response.json(await getProfileOverview());
  } catch (error) {
    next(error);
  }
});

profileRouter.patch('/', requireAuth, async (request, response, next) => {
  try {
    response.json(await updateProfileSettings(request.auth.user.id, profileSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

profileRouter.patch('/insurance', requireAuth, async (request, response, next) => {
  try {
    response.json(await updateInsuranceDetails(insuranceDetailsSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

profileRouter.post('/emergency-contacts', requireAuth, async (request, response, next) => {
  try {
    response.status(201).json(await addEmergencyContact(emergencyContactSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

profileRouter.patch('/emergency-contacts/:contactId', requireAuth, async (request, response, next) => {
  try {
    response.json(await updateEmergencyContact(request.params.contactId, emergencyContactSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

profileRouter.delete('/emergency-contacts/:contactId', requireAuth, async (request, response, next) => {
  try {
    response.json(await deleteEmergencyContact(request.params.contactId));
  } catch (error) {
    next(error);
  }
});

