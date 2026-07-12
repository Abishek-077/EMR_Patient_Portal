import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncRoute } from '../../shared/http/async-route.js';
import {
  consentSignatureSchema,
  insuranceDetailsSchema,
  registrationDemographicsSchema,
  registrationFormSchema,
} from '../../validation.js';
import {
  getRegistrationIntake,
  signRegistrationConsent,
  updateRegistrationDemographics,
  updateRegistrationForm,
  updateRegistrationInsurance,
} from './registration.service.js';

export const registrationRouter = Router();

registrationRouter.get('/', requireAuth, requirePermission('registration.view'), asyncRoute(async (request, response) => {
  response.json(await getRegistrationIntake(request.auth.user));
}));

registrationRouter.patch('/demographics', requireAuth, requirePermission('registration.update'), asyncRoute(async (request, response) => {
  response.json(await updateRegistrationDemographics(request.auth.user, registrationDemographicsSchema(request.body || {})));
}));

registrationRouter.patch('/insurance', requireAuth, requirePermission('registration.update'), asyncRoute(async (request, response) => {
  response.json(await updateRegistrationInsurance(request.auth.user, insuranceDetailsSchema(request.body || {})));
}));

registrationRouter.post('/consents/:consentId/sign', requireAuth, requirePermission('registration.consent.sign'), asyncRoute(async (request, response) => {
  response.status(201).json(await signRegistrationConsent(
    request.auth.user,
    request.params.consentId,
    consentSignatureSchema(request.body || {}),
  ));
}));

registrationRouter.patch('/forms/:formId', requireAuth, requirePermission('registration.update'), asyncRoute(async (request, response) => {
  response.json(await updateRegistrationForm(
    request.auth.user,
    request.params.formId,
    registrationFormSchema(request.body || {}),
  ));
}));
