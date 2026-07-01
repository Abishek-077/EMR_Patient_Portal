import { randomUUID } from 'node:crypto';
import { notFound } from '../../errors.js';
import { readDb, updateDb } from '../../store.js';

export async function listReferrals({ status = 'All Status' } = {}) {
  const db = await readDb();
  const rows = db.referrals.rows.filter((row) => status === 'All Status' || row.status === status);
  return {
    ...db.referrals,
    rows,
    summary: referralSummary(db.referrals.rows),
  };
}

export async function getReferralDetail(referralId) {
  const db = await readDb();
  const normalizedReferralId = String(referralId || '').toLowerCase();
  const row = db.referrals.rows.find((item) => {
    const normalizedRowId = item.id.toLowerCase();
    return normalizedRowId === normalizedReferralId || normalizedRowId === normalizedReferralId.replace(/^ref-?/i, 'ref-');
  });
  if (!row) throw notFound('Referral not found');

  return {
    referral: row,
    focus: row.id.toUpperCase() === String(db.referrals.focus?.caseId || '').toUpperCase() ? db.referrals.focus : null,
    generatedAt: new Date().toISOString(),
    printable: true,
    clinic: {
      name: row.clinic || db.referrals.focus?.clinic || 'Specialist clinic pending',
      address: db.referrals.focus?.address || 'Address pending',
      phone: db.referrals.focus?.phone || 'Phone pending',
      email: db.referrals.focus?.email || 'Email pending',
    },
    attachments: [
      {
        name: db.referrals.focus?.attachment || 'Referral packet.pdf',
        type: 'Referral packet',
        generatedAt: new Date().toISOString(),
      },
    ],
  };
}

export async function requestReferral(input) {
  return updateDb((db) => {
    db.referrals.rows ||= [];
    const now = new Date();
    const row = {
      id: `ref-${randomUUID()}`,
      issuedDate: now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      provider: input.provider || 'Care Team',
      specialty: input.specialty,
      reason: input.reason,
      status: 'Pending',
      actions: ['Details', 'Contact', 'Resend Request'],
      clinic: input.clinic,
      createdAt: now.toISOString(),
    };

    db.referrals.rows.unshift(row);
    db.referrals.summary = referralSummary(db.referrals.rows);
    return row;
  });
}

export async function updateReferralAction(referralId, input) {
  const result = await updateDb((db) => {
    const row = db.referrals.rows.find((item) => item.id === referralId);
    if (!row) return null;
    const now = new Date().toISOString();
    row.lastAction = input.action;
    row.lastActionNote = input.note;
    row.lastActionAt = now;
    if (/resend/i.test(input.action)) row.status = 'Pending';
    if (/calendar/i.test(input.action)) row.status = 'Scheduled';
    db.referrals.focus = {
      ...db.referrals.focus,
      caseId: row.id.toUpperCase(),
      title: 'Referral Detail Focus',
      note: input.note || db.referrals.focus.note,
      lastUpdate: 'Just now',
      clinic: row.clinic || db.referrals.focus.clinic,
    };
    db.referrals.summary = referralSummary(db.referrals.rows);
    return row;
  });

  if (!result) throw notFound('Referral not found');
  return result;
}

export async function getReferralExport() {
  const db = await readDb();
  return {
    title: 'Referral Status Report',
    generatedAt: new Date().toISOString(),
    referrals: db.referrals.rows,
    summary: referralSummary(db.referrals.rows),
  };
}

function referralSummary(rows) {
  return {
    active: rows.filter((row) => row.status !== 'Completed').length,
    pending: rows.filter((row) => row.status === 'Pending').length,
    completedYear: rows.filter((row) => row.status === 'Completed').length,
  };
}
