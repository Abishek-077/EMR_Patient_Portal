import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  cancelAppointment,
  createAppointmentRequest,
  listAppointments,
  rescheduleAppointment,
  scheduleAppointment,
} from '../services/appointments.service.js';
import {
  appointmentRequestSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
  scheduleAppointmentSchema,
} from '../validation.js';

export const appointmentsRouter = Router();

appointmentsRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    response.json(await listAppointments({
      status: String(request.query.status || 'upcoming'),
      provider: String(request.query.provider || ''),
    }));
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.post('/', requireAuth, async (request, response, next) => {
  try {
    response.status(201).json(await scheduleAppointment(scheduleAppointmentSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.post('/requests', requireAuth, async (request, response, next) => {
  try {
    response.status(201).json(await createAppointmentRequest(appointmentRequestSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.patch('/:appointmentId/reschedule', requireAuth, async (request, response, next) => {
  try {
    response.json(await rescheduleAppointment(
      request.params.appointmentId,
      rescheduleAppointmentSchema(request.body),
    ));
  } catch (error) {
    next(error);
  }
});

appointmentsRouter.patch('/:appointmentId/cancel', requireAuth, async (request, response, next) => {
  try {
    response.json(await cancelAppointment(request.params.appointmentId, cancelAppointmentSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

