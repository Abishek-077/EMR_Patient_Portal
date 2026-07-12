import {
  cancelAppointment,
  cancelAppointmentRequest,
  createVisitRequest,
  getAppointmentDetail,
  getAppointments,
  getAppointmentsExport,
  rescheduleAppointment,
  scheduleAppointment,
  updateVisitRequest,
} from '../../shared/api/api';

export const appointmentsApi = {
  getAppointments,
  getAppointmentDetail,
  getAppointmentsExport,
  createVisitRequest,
  updateVisitRequest,
  scheduleAppointment,
  rescheduleAppointment,
  cancelAppointment,
  cancelAppointmentRequest,
};
