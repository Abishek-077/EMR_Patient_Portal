import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  cancelAppointment,
  createAppointmentRequest,
  getAppointmentDetail,
  getAppointmentsExport,
  listAppointments,
  rescheduleAppointment,
  scheduleAppointment,
} from './appointments.service.js';
import {
  appointmentRequestSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  scheduleAppointmentSchema,
} from '../../validation.js';

export const appointmentsRouter = Router();

appointmentsRouter.get('/', requireAuth, requirePermission('appointments.view'), async (request, response, next) => {
  try {
    response.json(await listAppointments({
      status: String(request.query.status || 'upcoming'),
      provider: String(request.query.provider || ''),
    }));
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.get('/export', requireAuth, requirePermission('appointments.view'), async (request, response, next) => {
  try {
    response.json(await getAppointmentsExport({
      status: String(request.query.status || 'upcoming'),
      provider: String(request.query.provider || ''),
    }));
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.post('/', requireAuth, requirePermission('appointments.request'), async (request, response, next) => {
  try {
    response.status(201).json(await scheduleAppointment(scheduleAppointmentSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.post('/requests', requireAuth, requirePermission('appointments.request'), async (request, response, next) => {
  try {
    response.status(201).json(await createAppointmentRequest(appointmentRequestSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.get('/:appointmentId', requireAuth, requirePermission('appointments.view'), async (request, response, next) => {
  try {
    response.json(await getAppointmentDetail(request.params.appointmentId));
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.patch('/:appointmentId/reschedule', requireAuth, requirePermission('appointments.manage'), async (request, response, next) => {
  try {
    response.json(await rescheduleAppointment(
      request.params.appointmentId,
      rescheduleAppointmentSchema(request.body),
    ));
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.patch('/:appointmentId/cancel', requireAuth, requirePermission('appointments.manage'), async (request, response, next) => {
  try {
    response.json(await cancelAppointment(request.params.appointmentId, cancelAppointmentSchema(request.body)));
  } catch (error) {
    next(error);
  }
});
