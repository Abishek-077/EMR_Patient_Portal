import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  addPatientNote,
  deletePatientNote,
  getDocumentDetail,
  getLabDetail,
  getPrintableRecord,
  listHealthRecords,
  updatePatientNote,
} from './records.service.js';
import { patientNoteSchema } from '../../validation.js';
import { requestedFormat, sendDownload } from '../../shared/http/download.js';

export const recordsRouter = Router();

recordsRouter.get('/', requireAuth, requirePermission('records.view'), async (request, response, next) => {
  try {
    response.json(await listHealthRecords(request.auth.user, {
      query: String(request.query.query || ''),
      type: String(request.query.type || 'all'),
    }));
  } catch (error) {
    next(error);
  }
});

recordsRouter.post('/notes', requireAuth, requirePermission('records.notes.manage'), async (request, response, next) => {
  try {
    response.status(201).json(await addPatientNote(request.auth.user, patientNoteSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

recordsRouter.patch('/notes/:noteId', requireAuth, requirePermission('records.notes.manage'), async (request, response, next) => {
  try {
    response.json(await updatePatientNote(request.auth.user, request.params.noteId, patientNoteSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

recordsRouter.delete('/notes/:noteId', requireAuth, requirePermission('records.notes.manage'), async (request, response, next) => {
  try {
    response.json(await deletePatientNote(request.auth.user, request.params.noteId));
  } catch (error) {
    next(error);
  }
});

recordsRouter.get('/labs/:labId', requireAuth, requirePermission('records.view'), async (request, response, next) => {
  try {
    response.json(await getLabDetail(request.auth.user, request.params.labId));
  } catch (error) {
    next(error);
  }
});

recordsRouter.get('/documents/:documentId', requireAuth, requirePermission('records.view'), async (request, response, next) => {
  try {
    response.json(await getDocumentDetail(request.auth.user, request.params.documentId));
  } catch (error) {
    next(error);
  }
});

recordsRouter.get('/printable', requireAuth, requirePermission('records.view'), async (request, response, next) => {
  try {
    const payload = await getPrintableRecord(request.auth.user, request.auth.access);
    sendDownload(response, {
      format: requestedFormat(request),
      fileName: 'health-record',
      title: 'Patient Health Record',
      payload,
      rows: [
        ...(payload.labResults || []).map((item) => ({ recordType: 'Lab Result', ...item })),
        ...(payload.clinicalNotes || []).map((item) => ({ recordType: 'Clinical Note', ...item })),
        ...(payload.immunizations || []).map((item) => ({ recordType: 'Immunization', ...item })),
        ...(payload.medications || []).map((item) => ({ recordType: 'Medication', ...item })),
        ...(payload.documents || []).map((item) => ({ recordType: 'Document', ...item })),
      ],
    });
  } catch (error) {
    next(error);
  }
});
