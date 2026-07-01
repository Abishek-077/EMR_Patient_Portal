import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { addPatientNote, getDocumentDetail, getLabDetail, getPrintableRecord, listHealthRecords } from './records.service.js';
import { patientNoteSchema } from '../../validation.js';

export const recordsRouter = Router();

recordsRouter.get('/', requireAuth, requirePermission('records.view'), async (request, response, next) => {
  try {
    response.json(await listHealthRecords({
      query: String(request.query.query || ''),
      type: String(request.query.type || 'all'),
    }));
  } catch (error) {
    next(error);
  }
});

recordsRouter.post('/notes', requireAuth, requirePermission('records.view'), async (request, response, next) => {
  try {
    response.status(201).json(await addPatientNote(patientNoteSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

recordsRouter.get('/labs/:labId', requireAuth, requirePermission('records.view'), async (request, response, next) => {
  try {
    response.json(await getLabDetail(request.params.labId));
  } catch (error) {
    next(error);
  }
});

recordsRouter.get('/documents/:documentId', requireAuth, requirePermission('records.view'), async (request, response, next) => {
  try {
    response.json(await getDocumentDetail(request.params.documentId));
  } catch (error) {
    next(error);
  }
});

recordsRouter.get('/printable', requireAuth, requirePermission('records.view'), async (_request, response, next) => {
  try {
    response.json(await getPrintableRecord());
  } catch (error) {
    next(error);
  }
});
