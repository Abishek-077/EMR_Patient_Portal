import { badRequest, conflict, notFound } from '../../errors.js';

export const clinicalGateway = {
  name: 'local-clinical-store',

  validateFutureSlot(database, { provider, department, date, time }, { excludeAppointmentId = '' } = {}) {
    const normalizedDate = normalizeDate(date);
    if (normalizedDate && normalizedDate < todayIso()) throw badRequest('Appointment date must be today or later');
    const knownProvider = (database.providers || []).find((item) => item.name === provider);
    if (!knownProvider) throw notFound('Provider not found');
    if (department && knownProvider.department && knownProvider.department !== department) {
      throw badRequest('Provider is not available in the selected department');
    }

    const matchingSlot = (database.appointmentSlots || []).find((slot) => (
      slot.status === 'Available' &&
      (!slot.providerId || slot.providerId === knownProvider.id) &&
      String(slot.date) === String(date) &&
      String(slot.time) === String(time)
    ));
    if ((database.appointmentSlots || []).length && !matchingSlot) throw conflict('The selected appointment slot is not available');

    const collision = (database.appointments || []).find((appointment) => (
      appointment.id !== excludeAppointmentId &&
      appointment.status !== 'Cancelled' &&
      String(appointment.provider || appointment.clinician).toLowerCase() === String(provider).toLowerCase() &&
      String(appointment.date) === String(date) &&
      String(appointment.time) === String(time)
    ));
    if (collision) throw conflict('This provider is already booked at the selected date and time');
    return { provider: knownProvider, slot: matchingSlot || null };
  },
};

function normalizeDate(value) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
