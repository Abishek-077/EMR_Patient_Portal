import { randomUUID } from 'node:crypto';
import { badRequest, conflict, notFound } from '../../errors.js';
import { appendAuditLog, findOwned, scopeDbToPatient, stampPatientOwnership } from '../../domain/patient-scope.js';
import { clinicalGateway } from '../../providers/index.js';
import { readDb, updateDb } from '../../store.js';

const UPCOMING_STATUSES = new Set(['Confirmed', 'Pending']);
const EDITABLE_REQUEST_STATUSES = new Set(['Pending', 'Queued']);

export async function listAppointments(user, { status = 'upcoming', provider = '', page = 1, pageSize = 10 } = {}) {
  const db = scopeDbToPatient(await readDb(), user);
  const normalizedStatus = normalizeStatus(status);
  const providerFilter = provider.trim().toLowerCase();
  const filtered = db.appointments
    .filter((appointment) => normalizedStatus === 'All' || statusGroup(appointment) === normalizedStatus)
    .filter((appointment) => {
      if (!providerFilter) return true;
      return String(appointment.provider || appointment.clinician).toLowerCase().includes(providerFilter);
    });
  const pagination = paginate(filtered, page, pageSize);

  return {
    summary: buildAppointmentSummary(db),
    appointments: pagination.items.map(toAppointmentRow),
    requests: (db.appointmentRequests || []).map(toAppointmentRequestRow),
    pagination: pagination.meta,
    tabs: {
      upcoming: db.appointments.filter((appointment) => statusGroup(appointment) === 'Upcoming').length,
      past: db.appointments.filter((appointment) => statusGroup(appointment) === 'Past').length,
      cancelled: db.appointments.filter((appointment) => statusGroup(appointment) === 'Cancelled').length,
    },
    providers: (db.providers || []).filter((item) => item.available !== false),
    appointmentSlots: (db.appointmentSlots || []).filter((item) => item.status === 'Available' && isFuture(item.date)),
  };
}

export async function listAppointmentRequests(user, { status = 'Pending', page = 1, pageSize = 20 } = {}) {
  const db = scopeDbToPatient(await readDb(), user);
  const normalizedStatus = String(status || 'Pending').trim();
  const rows = (db.appointmentRequests || [])
    .map(toAppointmentRequestRow)
    .filter((request) => normalizedStatus === 'All' || request.status === normalizedStatus);
  const pagination = paginate(rows, page, pageSize);
  return { requests: pagination.items, pagination: pagination.meta };
}

export async function getAppointmentDetail(user, appointmentId) {
  const db = scopeDbToPatient(await readDb(), user);
  const appointment = findOwned(db.appointments, user, (item) => item.id === appointmentId);
  if (!appointment) throw notFound('Appointment not found');
  const provider = (db.providers || []).find((item) => item.id === appointment.providerId || item.name === (appointment.provider || appointment.clinician)) || null;
  const relatedRequest = (db.appointmentRequests || []).find((request) => request.appointmentId === appointment.id || request.id === appointment.requestId) || null;

  return {
    appointment: toAppointmentRow(appointment),
    provider: provider ? publicProvider(provider) : null,
    relatedRequest: relatedRequest ? toAppointmentRequestRow(relatedRequest) : null,
    timeline: [
      { label: 'Created', value: appointment.createdAt || 'Imported appointment' },
      { label: 'Updated', value: appointment.updatedAt || appointment.rescheduledAt || appointment.cancelledAt || null },
      { label: 'Status', value: appointment.status },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function getAppointmentsExport(user, options = {}) {
  const appointmentList = await listAppointments(user, { ...options, page: 1, pageSize: 500 });
  return {
    title: 'Appointments Export',
    generatedAt: new Date().toISOString(),
    filters: { status: options.status || 'upcoming', provider: options.provider || '' },
    appointments: appointmentList.appointments,
  };
}

export async function createAppointmentRequest(user, input) {
  return updateDb((db) => {
    db.appointmentRequests ||= [];
    const existing = findOwned(db.appointmentRequests, user, (request) => (
      EDITABLE_REQUEST_STATUSES.has(request.status) &&
      request.requestType !== 'Scheduled Slot' &&
      request.reason === input.reason &&
      sameDate(request.preferredDate, input.preferredDate)
    ));
    if (existing) return toAppointmentRequestRow(existing);

    const createdRequest = stampPatientOwnership({
      id: `req-${randomUUID()}`,
      requestType: 'General',
      reason: input.reason,
      preferredDate: input.preferredDate,
      notes: input.notes,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, user);

    db.appointmentRequests.unshift(createdRequest);
    appendAuditLog(db, user, 'appointment request created', 'appointmentRequest', createdRequest.id);
    return toAppointmentRequestRow(createdRequest);
  });
}

export async function updateAppointmentRequest(user, requestId, input) {
  const appointmentRequest = await updateDb((db) => {
    const foundRequest = findOwned(db.appointmentRequests || [], user, (item) => item.id === requestId);
    if (!foundRequest) return null;
    assertRequestEditable(foundRequest);
    foundRequest.reason = input.reason;
    foundRequest.preferredDate = input.preferredDate;
    foundRequest.notes = input.notes;
    foundRequest.updatedAt = new Date().toISOString();
    appendAuditLog(db, user, 'appointment request updated', 'appointmentRequest', foundRequest.id);
    return toAppointmentRequestRow(foundRequest);
  });

  if (!appointmentRequest) throw notFound('Appointment request not found');
  return appointmentRequest;
}

export async function cancelAppointmentRequest(user, requestId) {
  const appointmentRequest = await updateDb((db) => {
    const foundRequest = findOwned(db.appointmentRequests || [], user, (item) => item.id === requestId);
    if (!foundRequest) return null;
    assertRequestEditable(foundRequest);
    const now = new Date().toISOString();
    foundRequest.status = 'Cancelled';
    foundRequest.cancelledAt = now;
    foundRequest.updatedAt = now;
    appendAuditLog(db, user, 'appointment request cancelled', 'appointmentRequest', foundRequest.id);
    return toAppointmentRequestRow(foundRequest);
  });

  if (!appointmentRequest) throw notFound('Appointment request not found');
  return appointmentRequest;
}

// This compatibility entry point now creates a request. Only staff approval creates the appointment.
export async function scheduleAppointment(user, input) {
  return updateDb((db) => {
    db.appointmentRequests ||= [];
    const selection = validateSchedulingSelection(db, input);
    const existing = findOwned(db.appointmentRequests, user, (request) => (
      EDITABLE_REQUEST_STATUSES.has(request.status) &&
      sameDate(request.date, input.date) &&
      request.time === input.time &&
      String(request.provider).toLowerCase() === selection.provider.name.toLowerCase()
    ));
    if (existing) return toAppointmentRequestRow(existing);

    const now = new Date().toISOString();
    const appointmentRequest = stampPatientOwnership({
      id: `req-${randomUUID()}`,
      requestType: 'Scheduled Slot',
      slotId: selection.slot.id,
      providerId: selection.provider.id,
      service: input.service,
      provider: selection.provider.name,
      department: selection.provider.department || input.department,
      date: input.date,
      preferredDate: input.date,
      time: input.time,
      location: input.location || selection.provider.location || 'Scheduling pending',
      reason: input.reason,
      notes: input.notes,
      status: 'Pending',
      createdAt: now,
      updatedAt: now,
    }, user);
    db.appointmentRequests.unshift(appointmentRequest);
    appendAuditLog(db, user, 'appointment slot requested', 'appointmentRequest', appointmentRequest.id, { slotId: selection.slot.id });
    return toAppointmentRequestRow(appointmentRequest);
  });
}

export async function reviewAppointmentRequest(user, requestId, input) {
  const result = await updateDb((db) => {
    const request = findOwned(db.appointmentRequests || [], user, (item) => item.id === requestId);
    if (!request) return null;
    if (normalizeRequestStatus(request.status) === input.decision) {
      const existingAppointment = request.appointmentId
        ? findOwned(db.appointments || [], user, (item) => item.id === request.appointmentId)
        : null;
      return { request: toAppointmentRequestRow(request), appointment: existingAppointment ? toAppointmentRow(existingAppointment) : null };
    }
    assertRequestEditable(request);
    const now = new Date().toISOString();

    if (input.decision === 'Rejected') {
      request.status = 'Rejected';
      request.decisionReason = input.reason;
      request.reviewedByUserId = actorId(user);
      request.reviewedAt = now;
      request.updatedAt = now;
      appendAuditLog(db, user, 'appointment request rejected', 'appointmentRequest', request.id, { reason: input.reason });
      return { request: toAppointmentRequestRow(request), appointment: null };
    }

    const scheduleInput = {
      slotId: input.slotId || request.slotId,
      provider: input.provider || request.provider,
      department: input.department || request.department,
      date: input.date || request.date || request.preferredDate,
      time: input.time || request.time,
    };
    if (!scheduleInput.provider || !scheduleInput.department || !scheduleInput.date || !scheduleInput.time) {
      throw badRequest('provider, department, date, and time are required to approve this request');
    }
    const selection = validateSchedulingSelection(db, scheduleInput);
    assertSlotNotBooked(db, selection.provider.name, scheduleInput.date, scheduleInput.time);

    const appointment = stampPatientOwnership({
      id: `apt-${randomUUID()}`,
      requestId: request.id,
      slotId: selection.slot.id,
      providerId: selection.provider.id,
      service: request.service || request.reason,
      clinician: selection.provider.name,
      provider: selection.provider.name,
      date: scheduleInput.date,
      time: scheduleInput.time,
      department: selection.provider.department || scheduleInput.department,
      location: input.location || request.location || selection.provider.location || 'Location pending',
      initials: initials(selection.provider.name),
      type: request.requestType === 'General' ? 'Requested' : 'Scheduled',
      status: 'Confirmed',
      statusGroup: 'Upcoming',
      reason: request.reason,
      notes: request.notes,
      approvedByUserId: actorId(user),
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    }, user);
    db.appointments ||= [];
    db.appointments.unshift(appointment);
    request.status = 'Approved';
    request.appointmentId = appointment.id;
    request.reviewedByUserId = actorId(user);
    request.reviewedAt = now;
    request.updatedAt = now;
    selection.slot.status = 'Reserved';
    selection.slot.reservedForPatientId = appointment.patientId;
    selection.slot.appointmentId = appointment.id;
    selection.slot.updatedAt = now;
    appendAuditLog(db, user, 'appointment request approved', 'appointmentRequest', request.id, { appointmentId: appointment.id });
    return { request: toAppointmentRequestRow(request), appointment: toAppointmentRow(appointment) };
  });

  if (!result) throw notFound('Appointment request not found');
  return result;
}

export async function rescheduleAppointment(user, appointmentId, input) {
  const appointment = await updateDb((db) => {
    const foundAppointment = findOwned(db.appointments || [], user, (item) => item.id === appointmentId);
    if (!foundAppointment) return null;
    if (!['Confirmed', 'Pending'].includes(foundAppointment.status)) throw conflict('Only upcoming appointments can be rescheduled');

    const selection = validateSchedulingSelection(db, {
      ...input,
      provider: input.provider || foundAppointment.provider || foundAppointment.clinician,
      department: input.department || foundAppointment.department,
    });
    assertSlotNotBooked(db, selection.provider.name, input.date, input.time, foundAppointment.id);
    releaseSlot(db, foundAppointment.slotId);
    const now = new Date().toISOString();
    foundAppointment.slotId = selection.slot.id;
    foundAppointment.providerId = selection.provider.id;
    foundAppointment.provider = selection.provider.name;
    foundAppointment.clinician = selection.provider.name;
    foundAppointment.initials = initials(selection.provider.name);
    foundAppointment.department = selection.provider.department || input.department || foundAppointment.department;
    foundAppointment.date = input.date;
    foundAppointment.time = input.time;
    foundAppointment.status = 'Pending';
    foundAppointment.statusGroup = 'Upcoming';
    foundAppointment.rescheduleNotes = input.notes;
    foundAppointment.rescheduledAt = now;
    foundAppointment.updatedAt = now;
    selection.slot.status = 'Reserved';
    selection.slot.reservedForPatientId = foundAppointment.patientId;
    selection.slot.appointmentId = foundAppointment.id;
    selection.slot.updatedAt = now;
    appendAuditLog(db, user, 'appointment rescheduled', 'appointment', foundAppointment.id, { slotId: selection.slot.id });
    return foundAppointment;
  });

  if (!appointment) throw notFound('Appointment not found');
  return toAppointmentRow(appointment);
}

export async function cancelAppointment(user, appointmentId, input) {
  const appointment = await updateDb((db) => {
    const foundAppointment = findOwned(db.appointments || [], user, (item) => item.id === appointmentId);
    if (!foundAppointment) return null;
    if (!['Confirmed', 'Pending'].includes(foundAppointment.status)) throw conflict('Only upcoming appointments can be cancelled');

    const now = new Date().toISOString();
    foundAppointment.status = 'Cancelled';
    foundAppointment.statusGroup = 'Cancelled';
    foundAppointment.cancelledAt = now;
    foundAppointment.updatedAt = now;
    foundAppointment.cancellationReason = input.reason;
    releaseSlot(db, foundAppointment.slotId);
    appendAuditLog(db, user, 'appointment cancelled', 'appointment', foundAppointment.id, { reason: input.reason });
    return foundAppointment;
  });

  if (!appointment) throw notFound('Appointment not found');
  return toAppointmentRow(appointment);
}

export function buildAppointmentSummary(db) {
  const upcoming = (db.appointments || []).filter((appointment) => statusGroup(appointment) === 'Upcoming');
  const past = (db.appointments || []).filter((appointment) => statusGroup(appointment) === 'Past');
  const nextVisit = [...upcoming].sort((left, right) => Date.parse(left.date) - Date.parse(right.date))[0] || null;
  const lastVisit = [...past].sort((left, right) => Date.parse(right.date) - Date.parse(left.date))[0] || null;

  return {
    nextVisit: nextVisit ? { label: `${nextVisit.date}, ${nextVisit.time}`, provider: nextVisit.provider || nextVisit.clinician, department: nextVisit.department || nextVisit.type } : null,
    pendingRequests: (db.appointmentRequests || []).filter((request) => normalizeRequestStatus(request.status) === 'Pending').length,
    lastVisit: lastVisit ? { label: lastVisit.date, service: lastVisit.service, department: lastVisit.department || lastVisit.type } : null,
    upcomingCount: upcoming.length,
  };
}

function validateSchedulingSelection(db, input) {
  const provider = (db.providers || []).find((item) => (
    item.available !== false && (item.id === input.provider || item.name.toLowerCase() === String(input.provider || '').toLowerCase())
  ));
  if (!provider) throw badRequest('The selected provider is not available');
  if (input.department && provider.department && provider.department.toLowerCase() !== String(input.department).toLowerCase()) {
    throw badRequest('The selected provider does not belong to that department');
  }
  if (!isFuture(input.date)) throw badRequest('The appointment date must be in the future');

  const slot = (db.appointmentSlots || []).find((item) => (
    item.status === 'Available' &&
    (!input.slotId || item.id === input.slotId) &&
    (!item.providerId || item.providerId === provider.id) &&
    sameDate(item.date, input.date) &&
    String(item.time).trim().toLowerCase() === String(input.time || '').trim().toLowerCase() &&
    (!item.department || item.department.toLowerCase() === String(provider.department || input.department).toLowerCase())
  ));
  if (!slot) throw conflict('The selected appointment slot is no longer available');
  clinicalGateway.validateFutureSlot(db, {
    provider: provider.name,
    department: provider.department || input.department,
    date: slot.date,
    time: slot.time,
  });
  return { provider, slot };
}

function assertSlotNotBooked(db, providerName, date, time, excludedAppointmentId = '') {
  const existing = (db.appointments || []).find((appointment) => (
    appointment.id !== excludedAppointmentId &&
    statusGroup(appointment) === 'Upcoming' &&
    String(appointment.provider || appointment.clinician).toLowerCase() === String(providerName).toLowerCase() &&
    sameDate(appointment.date, date) &&
    String(appointment.time).trim().toLowerCase() === String(time).trim().toLowerCase()
  ));
  if (existing) throw conflict('This provider is already booked at the selected date and time');
}

function releaseSlot(db, slotId) {
  if (!slotId) return;
  const slot = (db.appointmentSlots || []).find((item) => item.id === slotId);
  if (!slot) return;
  slot.status = 'Available';
  delete slot.reservedForPatientId;
  delete slot.appointmentId;
  slot.updatedAt = new Date().toISOString();
}

function assertRequestEditable(request) {
  if (!EDITABLE_REQUEST_STATUSES.has(request.status)) throw conflict(`Appointment request is already ${normalizeRequestStatus(request.status).toLowerCase()}`);
}

function toAppointmentRow(appointment) {
  return {
    id: appointment.id,
    requestId: appointment.requestId || null,
    slotId: appointment.slotId || null,
    service: appointment.service,
    provider: appointment.provider || appointment.clinician,
    department: appointment.department || appointment.type,
    date: appointment.date,
    time: appointment.time,
    location: appointment.location || 'Location pending',
    initials: appointment.initials || initials(appointment.provider || appointment.clinician),
    type: appointment.type,
    status: appointment.status,
    statusGroup: statusGroup(appointment),
    reason: appointment.reason || '',
    notes: appointment.notes || '',
    cancellationReason: appointment.cancellationReason || '',
    createdAt: appointment.createdAt || null,
    updatedAt: appointment.updatedAt || null,
  };
}

function toAppointmentRequestRow(request) {
  return {
    id: request.id,
    requestType: request.requestType || 'General',
    appointmentId: request.appointmentId || null,
    slotId: request.slotId || null,
    service: request.service || request.reason,
    provider: request.provider || '',
    department: request.department || '',
    preferredDate: request.preferredDate || request.date,
    date: request.date || request.preferredDate,
    time: request.time || '',
    location: request.location || '',
    reason: request.reason,
    notes: request.notes || '',
    status: normalizeRequestStatus(request.status),
    decisionReason: request.decisionReason || '',
    createdAt: request.createdAt || null,
    updatedAt: request.updatedAt || null,
    reviewedAt: request.reviewedAt || null,
  };
}

function publicProvider(provider) {
  return { id: provider.id, name: provider.name, department: provider.department, role: provider.role, location: provider.location, available: provider.available !== false };
}

function normalizeRequestStatus(status) {
  if (['Queued', 'Requested'].includes(status)) return 'Pending';
  return status || 'Pending';
}

function normalizeStatus(status) {
  const normalized = String(status || 'upcoming').toLowerCase();
  if (normalized === 'all') return 'All';
  if (normalized === 'past') return 'Past';
  if (normalized === 'cancelled') return 'Cancelled';
  return 'Upcoming';
}

function statusGroup(appointment) {
  if (appointment.status === 'Cancelled') return 'Cancelled';
  if (appointment.status === 'Completed') return 'Past';
  if (isPastDate(appointment.date)) return 'Past';
  if (appointment.statusGroup) return appointment.statusGroup;
  if (UPCOMING_STATUSES.has(appointment.status)) return 'Upcoming';
  return 'Upcoming';
}

function paginate(items, requestedPage, requestedPageSize) {
  const pageSize = Math.min(100, Math.max(1, Number(requestedPageSize) || 10));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(requestedPage) || 1));
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), meta: { page, pageSize, total, totalPages } };
}

function sameDate(left, right) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
  return new Date(leftTime).toISOString().slice(0, 10) === new Date(rightTime).toISOString().slice(0, 10);
}

function isFuture(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function isPastDate(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  return new Date(timestamp).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10);
}

function initials(name) {
  return String(name || '').split(/\s+/).filter((part) => !/^dr\.?$/i.test(part)).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'CT';
}

function actorId(user) {
  return user.actorUserId || user.id;
}
