import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  cancelMedicationRequest,
  cancelRefillRequest,
  checkDrugInteractions,
  getMedicationLeaflet,
  getPrintablePrescriptions,
  getPrescriptionsOverview,
  listPrescriptionRequests,
  requestMedication,
  requestRefill,
  reviewMedicationRequest,
  reviewRefillRequest,
  updateMedicationRequest,
  updatePreferredPharmacy,
} from './prescriptions.service.js';
import { drugInteractionSchema, medicationRequestSchema, preferredPharmacySchema, prescriptionDecisionSchema } from '../../validation.js';
import { requestedFormat, sendDownload } from '../../shared/http/download.js';

export const prescriptionsRouter = Router();

prescriptionsRouter.get('/', requireAuth, requirePermission('prescriptions.view'), async (request, response, next) => {
  try { response.json(await getPrescriptionsOverview(request.auth.user)); }
  catch (error) { next(error); }
});

prescriptionsRouter.get('/printable', requireAuth, requirePermission('prescriptions.view'), async (request, response, next) => {
  try {
    const payload = await getPrintablePrescriptions(request.auth.user);
    sendDownload(response, {
      format: requestedFormat(request),
      fileName: 'prescriptions',
      title: 'Medication List',
      payload,
      rows: payload.prescriptions || [],
    });
  } catch (error) { next(error); }
});

prescriptionsRouter.get('/requests', requireAuth, requirePermission('prescriptions.view'), async (request, response, next) => {
  try { response.json(await listPrescriptionRequests(request.auth.user, { status: String(request.query.status || 'Pending') })); }
  catch (error) { next(error); }
});

prescriptionsRouter.post('/interactions', requireAuth, requirePermission('prescriptions.request'), async (request, response, next) => {
  try { response.status(201).json(await checkDrugInteractions(request.auth.user, drugInteractionSchema(request.body))); }
  catch (error) { next(error); }
});

prescriptionsRouter.post('/:prescriptionId/refills', requireAuth, requirePermission('prescriptions.refill'), async (request, response, next) => {
  try { response.status(202).json(await requestRefill(request.auth.user, request.params.prescriptionId)); }
  catch (error) { next(error); }
});

prescriptionsRouter.delete('/refill-requests/:requestId', requireAuth, requirePermission('prescriptions.refill'), async (request, response, next) => {
  try { response.json(await cancelRefillRequest(request.auth.user, request.params.requestId)); }
  catch (error) { next(error); }
});

prescriptionsRouter.patch('/refill-requests/:requestId/decision', requireAuth, requirePermission('prescriptions.review'), async (request, response, next) => {
  try { response.json(await reviewRefillRequest(request.auth.user, request.params.requestId, prescriptionDecisionSchema(request.body))); }
  catch (error) { next(error); }
});

prescriptionsRouter.post('/medication-requests', requireAuth, requirePermission('prescriptions.request'), async (request, response, next) => {
  try { response.status(202).json(await requestMedication(request.auth.user, medicationRequestSchema(request.body))); }
  catch (error) { next(error); }
});

prescriptionsRouter.patch('/medication-requests/:requestId', requireAuth, requirePermission('prescriptions.request'), async (request, response, next) => {
  try { response.json(await updateMedicationRequest(request.auth.user, request.params.requestId, medicationRequestSchema(request.body))); }
  catch (error) { next(error); }
});

prescriptionsRouter.delete('/medication-requests/:requestId', requireAuth, requirePermission('prescriptions.request'), async (request, response, next) => {
  try { response.json(await cancelMedicationRequest(request.auth.user, request.params.requestId)); }
  catch (error) { next(error); }
});

prescriptionsRouter.patch('/medication-requests/:requestId/decision', requireAuth, requirePermission('prescriptions.review'), async (request, response, next) => {
  try { response.json(await reviewMedicationRequest(request.auth.user, request.params.requestId, prescriptionDecisionSchema(request.body))); }
  catch (error) { next(error); }
});

prescriptionsRouter.patch('/preferred-pharmacy', requireAuth, requirePermission('prescriptions.pharmacy.manage'), async (request, response, next) => {
  try { response.json(await updatePreferredPharmacy(request.auth.user, preferredPharmacySchema(request.body))); }
  catch (error) { next(error); }
});

prescriptionsRouter.get('/:prescriptionId/leaflet', requireAuth, requirePermission('prescriptions.view'), async (request, response, next) => {
  try { response.json(await getMedicationLeaflet(request.auth.user, request.params.prescriptionId)); }
  catch (error) { next(error); }
});
