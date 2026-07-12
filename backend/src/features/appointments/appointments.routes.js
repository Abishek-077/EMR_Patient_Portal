import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  cancelAppointment,
  cancelAppointmentRequest,
  createAppointmentRequest,
  getAppointmentDetail,
  getAppointmentsExport,
  listAppointmentRequests,
  listAppointments,
  rescheduleAppointment,
  reviewAppointmentRequest,
  scheduleAppointment,
  updateAppointmentRequest,
} from './appointments.service.js';
import {
  appointmentDecisionSchema,
  appointmentRequestSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  scheduleAppointmentSchema,
} from '../../validation.js';
import { requestedFormat, sendDownload } from '../../shared/http/download.js';

export const appointmentsRouter = Router();

appointmentsRouter.get('/', requireAuth, requirePermission('appointments.view'), async (request, response, next) => {
  try {
    response.json(await listAppointments(request.auth.user, {
      status: String(request.query.status || 'upcoming'),
      provider: String(request.query.provider || ''),
      page: request.query.page,
      pageSize: request.query.pageSize,
    }));
  } catch (error) { next(error); }
});

appointmentsRouter.get('/export', requireAuth, requirePermission('appointments.view'), async (request, response, next) => {
  try {
    const payload = await getAppointmentsExport(request.auth.user, {
      status: String(request.query.status || 'upcoming'),
      provider: String(request.query.provider || ''),
    });
    sendDownload(response, {
      format: requestedFormat(request),
      fileName: `appointments-${String(request.query.status || 'upcoming')}`,
      title: 'Appointments Export',
      payload,
      rows: payload.appointments || [],
    });
  } catch (error) { next(error); }
});

appointmentsRouter.get('/requests', requireAuth, requirePermission('appointments.view'), async (request, response, next) => {
  try {
    response.json(await listAppointmentRequests(request.auth.user, {
      status: String(request.query.status || 'Pending'),
      page: request.query.page,
      pageSize: request.query.pageSize,
    }));
  } catch (error) { next(error); }
});

// Compatibility endpoint: this now submits a slot request; it never creates an appointment directly.
appointmentsRouter.post('/', requireAuth, requirePermission('appointments.request'), async (request, response, next) => {
  try {
    response.status(202).json(await scheduleAppointment(request.auth.user, scheduleAppointmentSchema(request.body)));
  } catch (error) { next(error); }
});

appointmentsRouter.post('/requests', requireAuth, requirePermission('appointments.request'), async (request, response, next) => {
  try {
    response.status(202).json(await createAppointmentRequest(request.auth.user, appointmentRequestSchema(request.body)));
  } catch (error) { next(error); }
});

appointmentsRouter.patch('/requests/:requestId', requireAuth, requirePermission('appointments.request'), async (request, response, next) => {
  try {
    response.json(await updateAppointmentRequest(request.auth.user, request.params.requestId, appointmentRequestSchema(request.body)));
  } catch (error) { next(error); }
});

appointmentsRouter.delete('/requests/:requestId', requireAuth, requirePermission('appointments.request'), async (request, response, next) => {
  try {
    response.json(await cancelAppointmentRequest(request.auth.user, request.params.requestId));
  } catch (error) { next(error); }
});

appointmentsRouter.patch('/requests/:requestId/decision', requireAuth, requirePermission('appointments.approve'), async (request, response, next) => {
  try {
    response.json(await reviewAppointmentRequest(request.auth.user, request.params.requestId, appointmentDecisionSchema(request.body)));
  } catch (error) { next(error); }
});

appointmentsRouter.get('/:appointmentId', requireAuth, requirePermission('appointments.view'), async (request, response, next) => {
  try { response.json(await getAppointmentDetail(request.auth.user, request.params.appointmentId)); }
  catch (error) { next(error); }
});

appointmentsRouter.patch('/:appointmentId/reschedule', requireAuth, requirePermission('appointments.manage'), async (request, response, next) => {
  try {
    response.json(await rescheduleAppointment(request.auth.user, request.params.appointmentId, rescheduleAppointmentSchema(request.body)));
  } catch (error) { next(error); }
});

appointmentsRouter.patch('/:appointmentId/cancel', requireAuth, requirePermission('appointments.manage'), async (request, response, next) => {
  try {
    response.json(await cancelAppointment(request.auth.user, request.params.appointmentId, cancelAppointmentSchema(request.body)));
  } catch (error) { next(error); }
});
