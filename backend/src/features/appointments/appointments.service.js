import { randomUUID } from 'node:crypto';
import { notFound } from '../../errors.js';
import { readDb, updateDb } from '../../store.js';

const UPCOMING_STATUSES = new Set(['Confirmed', 'Pending']);

export async function listAppointments({ status = 'upcoming', provider = '' } = {}) {
  const db = await readDb();
  const normalizedStatus = normalizeStatus(status);
  const providerFilter = provider.trim().toLowerCase();
  const appointments = db.appointments
    .filter((appointment) => statusGroup(appointment) === normalizedStatus)
    .filter((appointment) => {
      if (!providerFilter) return true;
      return String(appointment.provider || appointment.clinician).toLowerCase().includes(providerFilter);
    })
    .map(toAppointmentRow);

  return {
    summary: buildAppointmentSummary(db),
    appointments,
    pagination: {
      page: 1,
      pageSize: 10,
      total: appointments.length,
    },
    tabs: {
      upcoming: db.appointments.filter((appointment) => statusGroup(appointment) === 'Upcoming').length,
      past: db.appointments.filter((appointment) => statusGroup(appointment) === 'Past').length,
      cancelled: db.appointments.filter((appointment) => statusGroup(appointment) === 'Cancelled').length,
    },
    providers: db.providers || [],
    appointmentSlots: db.appointmentSlots || [],
  };
}

export async function getAppointmentDetail(appointmentId) {
  const db = await readDb();
  const appointment = db.appointments.find((item) => item.id === appointmentId);
  if (!appointment) throw notFound('Appointment not found');
  const provider = (db.providers || []).find((item) => item.name === (appointment.provider || appointment.clinician)) || null;
  const relatedRequest = (db.appointmentRequests || []).find((request) => request.reason === appointment.reason) || null;

  return {
    appointment: toAppointmentRow(appointment),
    provider,
    relatedRequest,
    timeline: [
      { label: 'Created', value: appointment.createdAt || 'Seeded appointment' },
      { label: 'Updated', value: appointment.updatedAt || appointment.rescheduledAt || appointment.cancelledAt || 'No updates recorded' },
      { label: 'Status', value: appointment.status },
    ],
    printable: true,
    generatedAt: new Date().toISOString(),
  };
}

export async function getAppointmentsExport({ status = 'upcoming', provider = '' } = {}) {
  const appointmentList = await listAppointments({ status, provider });
  return {
    title: 'Appointments Export',
    generatedAt: new Date().toISOString(),
    filters: { status, provider },
    ...appointmentList,
  };
}

export async function createAppointmentRequest(input) {
  return updateDb((db) => {
    db.appointmentRequests ||= [];
    const createdRequest = {
      id: `req-${randomUUID()}`,
      reason: input.reason,
      preferredDate: input.preferredDate,
      notes: input.notes,
      status: 'Queued',
      createdAt: new Date().toISOString(),
    };

    db.appointmentRequests.unshift(createdRequest);
    return createdRequest;
  });
}

export async function scheduleAppointment(input) {
  return updateDb((db) => {
    db.appointments ||= [];
    const appointment = {
      id: `apt-${randomUUID()}`,
      service: input.service,
      clinician: input.provider || input.clinician,
      provider: input.provider || input.clinician,
      date: input.date,
      time: input.time,
      department: input.department,
      location: input.location || 'Scheduling pending',
      initials: initials(input.provider || input.clinician),
      type: 'Requested',
      status: 'Pending',
      statusGroup: 'Upcoming',
      action: 'Details',
      secondaryAction: 'Cancel',
      reason: input.reason,
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };

    db.appointments.unshift(appointment);
    db.activityLog ||= [];
    db.activityLog.unshift({
      id: `activity-${randomUUID()}`,
      type: 'appointment',
      title: 'Appointment requested',
      detail: `${appointment.service} with ${appointment.provider} on ${appointment.date} at ${appointment.time}`,
      createdAt: appointment.createdAt,
    });
    return toAppointmentRow(appointment);
  });
}

export async function rescheduleAppointment(appointmentId, input) {
  const appointment = await updateDb((db) => {
    const foundAppointment = db.appointments.find((item) => item.id === appointmentId);
    if (!foundAppointment) return null;
    if (foundAppointment.status === 'Cancelled') return null;

    foundAppointment.date = input.date;
    foundAppointment.time = input.time;
    if (input.provider) {
      foundAppointment.provider = input.provider;
      foundAppointment.clinician = input.provider;
      foundAppointment.initials = initials(input.provider);
    }
    if (input.department) foundAppointment.department = input.department;
    foundAppointment.status = 'Pending';
    foundAppointment.statusGroup = 'Upcoming';
    foundAppointment.secondaryAction = 'Cancel';
    foundAppointment.rescheduleNotes = input.notes;
    foundAppointment.updatedAt = new Date().toISOString();
    return foundAppointment;
  });

  if (!appointment) throw notFound('Appointment not found or cannot be rescheduled');
  return toAppointmentRow(appointment);
}

export async function cancelAppointment(appointmentId, input) {
  const appointment = await updateDb((db) => {
    const foundAppointment = db.appointments.find((item) => item.id === appointmentId);
    if (!foundAppointment) return null;

    foundAppointment.status = 'Cancelled';
    foundAppointment.statusGroup = 'Cancelled';
    foundAppointment.secondaryAction = 'Reschedule';
    foundAppointment.cancelledAt = new Date().toISOString();
    foundAppointment.cancellationReason = input.reason;
    return foundAppointment;
  });

  if (!appointment) throw notFound('Appointment not found');
  return toAppointmentRow(appointment);
}

export function buildAppointmentSummary(db) {
  const upcoming = db.appointments.filter((appointment) => statusGroup(appointment) === 'Upcoming');
  const past = db.appointments.filter((appointment) => statusGroup(appointment) === 'Past');
  const nextVisit = upcoming[0] || null;
  const lastVisit = past[0] || null;

  return {
    nextVisit: nextVisit
      ? {
          label: `${nextVisit.date}, ${nextVisit.time}`,
          provider: nextVisit.provider || nextVisit.clinician,
          department: nextVisit.department || nextVisit.type,
        }
      : null,
    pendingRequests: db.appointmentRequests.filter((request) => request.status === 'Queued').length,
    lastVisit: lastVisit
      ? {
          label: lastVisit.date,
          service: lastVisit.service,
          department: lastVisit.department || lastVisit.type,
        }
      : null,
    upcomingCount: upcoming.length,
  };
}

function toAppointmentRow(appointment) {
  return {
    ...appointment,
    provider: appointment.provider || appointment.clinician,
    department: appointment.department || appointment.type,
    location: appointment.location || 'Location pending',
    initials: appointment.initials || initials(appointment.provider || appointment.clinician),
    statusGroup: statusGroup(appointment),
    action: appointment.action || 'Details',
    secondaryAction: appointment.secondaryAction || (appointment.status === 'Cancelled' ? 'Reschedule' : 'Cancel'),
  };
}

function normalizeStatus(status) {
  const normalized = String(status || 'upcoming').toLowerCase();
  if (normalized === 'past') return 'Past';
  if (normalized === 'cancelled') return 'Cancelled';
  return 'Upcoming';
}

function statusGroup(appointment) {
  if (appointment.statusGroup) return appointment.statusGroup;
  if (appointment.status === 'Cancelled') return 'Cancelled';
  if (appointment.status === 'Completed') return 'Past';
  if (UPCOMING_STATUSES.has(appointment.status)) return 'Upcoming';
  return 'Upcoming';
}

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter((part) => !/^dr\.?$/i.test(part))
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'CT';
}
