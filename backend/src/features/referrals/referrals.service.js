import { randomUUID } from 'node:crypto';
import { conflict, notFound } from '../../errors.js';
import { appendAuditLog, findOwned, scopeDbToPatient, stampPatientOwnership } from '../../domain/patient-scope.js';
import { readDb, updateDb } from '../../store.js';

const STATUS_TRANSITIONS = {
  Pending: new Set(['Approved', 'Rejected', 'Cancelled']),
  Approved: new Set(['Scheduled', 'Cancelled']),
  Scheduled: new Set(['Completed', 'Cancelled']),
  Rejected: new Set(['Pending']),
  Completed: new Set(),
  Cancelled: new Set(),
};

export async function listReferrals(user, { status = 'All Status', page = 1, pageSize = 10 } = {}) {
  const db = scopeDbToPatient(await readDb(), user);
  const rows = (db.referrals?.rows || [])
    .filter((row) => status === 'All Status' || row.status === status)
    .map(publicReferral);
  const pagination = paginate(rows, page, pageSize);
  return {
    rows: pagination.items,
    summary: referralSummary((db.referrals?.rows || []).map(publicReferral)),
    focus: publicFocus(db.referrals?.focus),
    pagination: pagination.meta,
  };
}

export async function getReferralDetail(user, referralId) {
  const db = scopeDbToPatient(await readDb(), user);
  const row = findReferral(db.referrals?.rows || [], user, referralId);
  if (!row) throw notFound('Referral not found');
  const focus = row.id.toUpperCase() === String(db.referrals?.focus?.caseId || '').toUpperCase() ? db.referrals.focus : null;
  return {
    referral: publicReferral(row),
    focus: publicFocus(focus),
    generatedAt: new Date().toISOString(),
    clinic: clinicFor(row, focus),
    attachments: focus?.attachment ? [{ name: focus.attachment, type: 'Referral attachment' }] : [],
  };
}

export async function getReferralContact(user, referralId) {
  const detail = await getReferralDetail(user, referralId);
  return { referralId: detail.referral.id, clinic: detail.clinic };
}

export async function getReferralCalendar(user, referralId) {
  const detail = await getReferralDetail(user, referralId);
  return {
    referralId: detail.referral.id,
    status: detail.referral.status,
    appointment: detail.referral.appointment || null,
    calendarAvailable: Boolean(detail.referral.appointment),
  };
}

export async function requestReferral(user, input) {
  return updateDb((db) => {
    db.referrals ||= {};
    db.referrals.rows ||= [];
    const now = new Date().toISOString();
    const row = stampPatientOwnership({
      id: `ref-${randomUUID()}`,
      issuedDate: now.slice(0, 10),
      provider: input.provider || 'Care Team',
      specialty: input.specialty,
      reason: input.reason,
      status: 'Pending',
      clinic: input.clinic,
      createdAt: now,
      updatedAt: now,
      statusHistory: [{ status: 'Pending', changedAt: now, changedByUserId: user.id }],
    }, user);
    db.referrals.rows.unshift(row);
    appendAuditLog(db, user, 'referral requested', 'referral', row.id);
    return publicReferral(row);
  });
}

export async function updateReferralAction(user, referralId, input) {
  const result = await updateDb((db) => {
    const row = findReferral(db.referrals?.rows || [], user, referralId);
    if (!row) return null;
    if (input.action !== 'Resend Request') throw conflict('This referral action is read-only');
    transitionReferral(row, 'Pending', user, input.note || 'Patient resent referral request');
    appendAuditLog(db, user, 'referral request resent', 'referral', row.id, { note: input.note });
    return publicReferral(row);
  });
  if (!result) throw notFound('Referral not found');
  return result;
}

export async function updateReferralStatus(user, referralId, input) {
  const result = await updateDb((db) => {
    const row = findReferral(db.referrals?.rows || [], user, referralId);
    if (!row) return null;
    if (row.status === input.status) return publicReferral(row);
    transitionReferral(row, input.status, user, input.reason);
    if (input.appointment) row.appointment = input.appointment;
    if (input.clinic) row.clinic = input.clinic;
    if (input.status === 'Rejected') row.rejectionReason = input.reason;
    if (input.status === 'Cancelled') row.cancellationReason = input.reason;
    appendAuditLog(db, user, `referral ${input.status.toLowerCase()}`, 'referral', row.id, { reason: input.reason });
    return publicReferral(row);
  });
  if (!result) throw notFound('Referral not found');
  return result;
}

export async function cancelReferral(user, referralId) {
  const result = await updateDb((db) => {
    const row = findReferral(db.referrals?.rows || [], user, referralId);
    if (!row) return null;
    if (row.status === 'Cancelled') return publicReferral(row);
    transitionReferral(row, 'Cancelled', user, 'Patient requested cancellation');
    row.cancellationReason = 'Patient requested cancellation';
    appendAuditLog(db, user, 'referral cancelled', 'referral', row.id);
    return publicReferral(row);
  });
  if (!result) throw notFound('Referral not found');
  return result;
}

export async function getReferralExport(user) {
  const db = scopeDbToPatient(await readDb(), user);
  const rows = (db.referrals?.rows || []).map(publicReferral);
  return { title: 'Referral Status Report', generatedAt: new Date().toISOString(), referrals: rows, summary: referralSummary(rows) };
}

function transitionReferral(row, nextStatus, actor, note) {
  const allowed = STATUS_TRANSITIONS[row.status] || new Set();
  if (!allowed.has(nextStatus)) throw conflict(`Referral cannot move from ${row.status} to ${nextStatus}`);
  const now = new Date().toISOString();
  row.status = nextStatus;
  row.updatedAt = now;
  row.statusHistory ||= [];
  row.statusHistory.push({ status: nextStatus, note: note || '', changedAt: now, changedByUserId: actor.actorUserId || actor.id });
}

function findReferral(rows, user, referralId) {
  const normalized = String(referralId || '').toLowerCase();
  return findOwned(rows, user, (item) => {
    const itemId = String(item.id || '').toLowerCase();
    return itemId === normalized || itemId === normalized.replace(/^ref-?/i, 'ref-');
  });
}

function publicReferral(row) {
  return {
    id: row.id,
    issuedDate: row.issuedDate,
    provider: row.provider,
    specialty: row.specialty,
    reason: row.reason,
    status: row.status,
    clinic: row.clinic || '',
    appointment: row.appointment || null,
    rejectionReason: row.rejectionReason || '',
    cancellationReason: row.cancellationReason || '',
    statusHistory: (row.statusHistory || []).map((item) => ({ status: item.status, note: item.note || '', changedAt: item.changedAt })),
    actions: referralActions(row),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function referralActions(row) {
  const actions = ['Details', 'Contact'];
  if (row.appointment) actions.push('View Calendar');
  if (row.status === 'Rejected') actions.push('Resend Request');
  if (['Pending', 'Approved', 'Scheduled'].includes(row.status)) actions.push('Cancel');
  return actions;
}

function clinicFor(row, focus) {
  return {
    name: row.clinic || focus?.clinic || 'Specialist clinic pending',
    address: focus?.address || '',
    phone: focus?.phone || '',
    email: focus?.email || '',
  };
}

function publicFocus(focus) {
  if (!focus) return null;
  return { caseId: focus.caseId, title: focus.title, note: focus.note, attachment: focus.attachment, lastUpdate: focus.lastUpdate, clinic: focus.clinic, address: focus.address, phone: focus.phone, email: focus.email };
}

function referralSummary(rows) {
  return {
    active: rows.filter((row) => ['Pending', 'Approved', 'Scheduled'].includes(row.status)).length,
    pending: rows.filter((row) => row.status === 'Pending').length,
    completedYear: rows.filter((row) => row.status === 'Completed').length,
  };
}

function paginate(items, requestedPage, requestedPageSize) {
  const pageSize = Math.min(100, Math.max(1, Number(requestedPageSize) || 10));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(requestedPage) || 1));
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), meta: { page, pageSize, total, totalPages } };
}
