import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  addImmunizationAlert,
  addImmunizationRecord,
  addVerifiedImmunizationRecord,
  deleteImmunizationRecord,
  dismissImmunizationAlert,
  getImmunizationDetail,
  getPrintableImmunizationRecord,
  listImmunizations,
  updateImmunizationRecord,
  verifyImmunizationRecord,
} from './immunizations.service.js';
import { immunizationAlertSchema, immunizationRecordSchema, immunizationVerificationSchema } from '../../validation.js';
import { requestedFormat, sendDownload } from '../../shared/http/download.js';

export const immunizationsRouter = Router();

immunizationsRouter.get('/', requireAuth, requirePermission('immunizations.view'), async (request, response, next) => {
  try { response.json(await listImmunizations(request.auth.user)); }
  catch (error) { next(error); }
});

immunizationsRouter.get('/printable', requireAuth, requirePermission('immunizations.view'), async (request, response, next) => {
  try {
    const payload = await getPrintableImmunizationRecord(request.auth.user);
    sendDownload(response, {
      format: requestedFormat(request),
      fileName: 'immunizations',
      title: 'Official Immunization Record',
      payload,
      rows: payload.completed || payload.records || [],
    });
  }
  catch (error) { next(error); }
});

immunizationsRouter.post('/verified', requireAuth, requirePermission('immunizations.verify'), async (request, response, next) => {
  try { response.status(201).json(await addVerifiedImmunizationRecord(request.auth.user, immunizationRecordSchema(request.body))); }
  catch (error) { next(error); }
});

immunizationsRouter.post('/alerts', requireAuth, requirePermission('immunizations.verify'), async (request, response, next) => {
  try { response.status(201).json(await addImmunizationAlert(request.auth.user, immunizationAlertSchema(request.body))); }
  catch (error) { next(error); }
});

immunizationsRouter.delete('/alerts/:alertId', requireAuth, requirePermission('immunizations.verify'), async (request, response, next) => {
  try { response.json(await dismissImmunizationAlert(request.auth.user, request.params.alertId)); }
  catch (error) { next(error); }
});

immunizationsRouter.post('/', requireAuth, requirePermission('immunizations.manage'), async (request, response, next) => {
  try { response.status(202).json(await addImmunizationRecord(request.auth.user, immunizationRecordSchema(request.body))); }
  catch (error) { next(error); }
});

immunizationsRouter.patch('/:recordId/verification', requireAuth, requirePermission('immunizations.verify'), async (request, response, next) => {
  try { response.json(await verifyImmunizationRecord(request.auth.user, request.params.recordId, immunizationVerificationSchema(request.body))); }
  catch (error) { next(error); }
});

immunizationsRouter.patch('/:recordId', requireAuth, requirePermission('immunizations.manage'), async (request, response, next) => {
  try { response.json(await updateImmunizationRecord(request.auth.user, request.params.recordId, immunizationRecordSchema(request.body))); }
  catch (error) { next(error); }
});

immunizationsRouter.delete('/:recordId', requireAuth, requirePermission('immunizations.manage'), async (request, response, next) => {
  try { response.json(await deleteImmunizationRecord(request.auth.user, request.params.recordId)); }
  catch (error) { next(error); }
});

immunizationsRouter.get('/:recordId', requireAuth, requirePermission('immunizations.view'), async (request, response, next) => {
  try { response.json(await getImmunizationDetail(request.auth.user, request.params.recordId)); }
  catch (error) { next(error); }
});
