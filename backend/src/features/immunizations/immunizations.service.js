import { randomUUID } from 'node:crypto';
import { conflict, notFound } from '../../errors.js';
import { appendAuditLog, findOwned, scopeDbToPatient, stampPatientOwnership } from '../../domain/patient-scope.js';
import { readDb, updateDb } from '../../store.js';

export async function listImmunizations(user) {
  const db = scopeDbToPatient(await readDb(), user);
  const records = (db.immunizationRecords?.completed || []).map(publicRecord);
  const alerts = (db.immunizationRecords?.alerts || []).map(publicAlert);
  const compliance = calculateCompliance(records, db.immunizationRecords?.compliance?.recommended);
  return {
    records: { completed: records, alerts, compliance },
    patientReported: records.filter((record) => record.provenance === 'patient-reported'),
    verified: records.filter((record) => record.verificationStatus === 'Verified'),
    summary: { alerts: alerts.length, completed: records.length, verified: compliance.completed, compliance },
  };
}

export async function getImmunizationDetail(user, recordId) {
  const db = scopeDbToPatient(await readDb(), user);
  const record = findOwned(db.immunizationRecords?.completed || [], user, (item) => item.id === recordId);
  if (!record) throw notFound('Immunization record not found');
  return {
    record: publicRecord(record),
    patient: publicPatient(db.patient),
    generatedAt: new Date().toISOString(),
    official: verificationStatus(record) === 'Verified',
    source: record.provenance === 'patient-reported' ? 'Patient-reported submission' : 'Clinical immunization registry',
  };
}

export async function getPrintableImmunizationRecord(user) {
  const db = scopeDbToPatient(await readDb(), user);
  const records = (db.immunizationRecords?.completed || [])
    .filter((item) => verificationStatus(item) === 'Verified')
    .map(publicRecord);
  return {
    title: 'Official Immunization Record',
    patient: publicPatient(db.patient),
    records,
    compliance: calculateCompliance(records, db.immunizationRecords?.compliance?.recommended),
    generatedAt: new Date().toISOString(),
    official: true,
  };
}

export async function addImmunizationRecord(user, input) {
  return createRecord(user, input, {
    provenance: 'patient-reported',
    verificationStatus: 'Pending verification',
    providerFallback: 'Patient entered',
    auditAction: 'patient-reported immunization submitted',
  });
}

export async function addVerifiedImmunizationRecord(user, input) {
  return createRecord(user, input, {
    provenance: 'clinician',
    verificationStatus: 'Verified',
    providerFallback: 'Care team',
    auditAction: 'verified immunization recorded',
    verifiedByUserId: actorId(user),
  });
}

async function createRecord(user, input, options) {
  return updateDb((db) => {
    db.immunizationRecords ||= {};
    db.immunizationRecords.completed ||= [];
    const now = new Date().toISOString();
    const record = stampPatientOwnership({
      id: `imm-${randomUUID()}`,
      vaccine: input.vaccine,
      date: input.date,
      dose: input.dose,
      provider: input.provider || options.providerFallback,
      route: input.route || 'Unknown',
      provenance: options.provenance,
      verificationStatus: options.verificationStatus,
      verifiedByUserId: options.verifiedByUserId || null,
      verifiedAt: options.verifiedByUserId ? now : null,
      createdAt: now,
      updatedAt: now,
    }, user);
    db.immunizationRecords.completed.unshift(record);
    recalculateCompliance(db, user);
    appendAuditLog(db, user, options.auditAction, 'immunization', record.id);
    return publicRecord(record);
  });
}

export async function updateImmunizationRecord(user, recordId, input) {
  const record = await updateDb((db) => {
    const found = findOwned(db.immunizationRecords?.completed || [], user, (item) => item.id === recordId);
    if (!found) return null;
    assertPatientReportEditable(found);
    found.vaccine = input.vaccine;
    found.date = input.date;
    found.dose = input.dose;
    found.provider = input.provider || found.provider;
    found.route = input.route || found.route;
    found.verificationStatus = 'Pending verification';
    found.updatedAt = new Date().toISOString();
    recalculateCompliance(db, user);
    appendAuditLog(db, user, 'patient-reported immunization updated', 'immunization', found.id);
    return publicRecord(found);
  });
  if (!record) throw notFound('Immunization record not found');
  return record;
}

export async function deleteImmunizationRecord(user, recordId) {
  const record = await updateDb((db) => {
    const found = findOwned(db.immunizationRecords?.completed || [], user, (item) => item.id === recordId);
    if (!found) return null;
    assertPatientReportEditable(found);
    found.deletedAt = new Date().toISOString();
    found.updatedAt = found.deletedAt;
    recalculateCompliance(db, user);
    appendAuditLog(db, user, 'patient-reported immunization deleted', 'immunization', found.id);
    return publicRecord(found);
  });
  if (!record) throw notFound('Immunization record not found');
  return record;
}

export async function verifyImmunizationRecord(user, recordId, input) {
  const record = await updateDb((db) => {
    const found = findOwned(db.immunizationRecords?.completed || [], user, (item) => item.id === recordId);
    if (!found) return null;
    if (verificationStatus(found) === input.decision) return publicRecord(found);
    if (found.provenance !== 'patient-reported') throw conflict('Clinical registry records are already verified');
    if (!['Pending verification', 'Rejected'].includes(verificationStatus(found))) {
      throw conflict(`Immunization submission is already ${verificationStatus(found).toLowerCase()}`);
    }
    const now = new Date().toISOString();
    found.verificationStatus = input.decision;
    found.verificationNote = input.note;
    found.verifiedByUserId = actorId(user);
    found.verifiedAt = now;
    found.updatedAt = now;
    recalculateCompliance(db, user);
    appendAuditLog(db, user, `immunization ${input.decision.toLowerCase()}`, 'immunization', found.id, { note: input.note });
    return publicRecord(found);
  });
  if (!record) throw notFound('Immunization record not found');
  return record;
}

export async function addImmunizationAlert(user, input) {
  return updateDb((db) => {
    db.immunizationRecords ||= {};
    db.immunizationRecords.alerts ||= [];
    const alert = stampPatientOwnership({
      id: `imm-alert-${randomUUID()}`,
      tone: input.tone,
      title: input.title,
      detail: input.detail,
      source: 'care-team',
      createdByUserId: actorId(user),
      createdAt: new Date().toISOString(),
    }, user);
    db.immunizationRecords.alerts.unshift(alert);
    appendAuditLog(db, user, 'immunization alert added', 'immunizationAlert', alert.id);
    return publicAlert(alert);
  });
}

export async function dismissImmunizationAlert(user, alertId) {
  const alert = await updateDb((db) => {
    const found = findOwned(db.immunizationRecords?.alerts || [], user, (item) => item.id === alertId);
    if (!found) return null;
    found.deletedAt = new Date().toISOString();
    found.dismissed = true;
    found.dismissedByUserId = actorId(user);
    found.updatedAt = found.deletedAt;
    appendAuditLog(db, user, 'immunization alert dismissed', 'immunizationAlert', found.id);
    return publicAlert(found);
  });
  if (!alert) throw notFound('Immunization alert not found');
  return alert;
}

function assertPatientReportEditable(record) {
  if (record.provenance !== 'patient-reported') throw conflict('Verified clinical immunization records cannot be changed from the patient portal');
  if (verificationStatus(record) === 'Verified') throw conflict('Verified immunization records cannot be changed from the patient portal');
}

function recalculateCompliance(db, user) {
  const scoped = scopeDbToPatient(db, user);
  const visibleRecords = (scoped.immunizationRecords?.completed || []).map(publicRecord);
  const compliance = calculateCompliance(visibleRecords, db.immunizationRecords?.compliance?.recommended);
  db.immunizationRecords.compliance = compliance;
  return compliance;
}

function calculateCompliance(records, recommendedValue) {
  const recommended = Math.max(1, Number(recommendedValue) || 13);
  const completed = records.filter((record) => record.verificationStatus === 'Verified' && !record.deletedAt).length;
  const percent = Math.min(100, Math.round((completed / recommended) * 100));
  return { percent, completed, recommended, detail: `${completed} of ${recommended} recommended immunization records are documented.` };
}

function verificationStatus(record) {
  return record.verificationStatus || (record.provenance === 'patient-reported' ? 'Pending verification' : 'Verified');
}

function publicRecord(record) {
  return {
    id: record.id,
    vaccine: record.vaccine,
    date: record.date,
    dose: record.dose,
    provider: record.provider,
    route: record.route,
    provenance: record.provenance || 'clinical-import',
    verificationStatus: verificationStatus(record),
    verificationNote: record.verificationNote || '',
    verifiedAt: record.verifiedAt || null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
    deletedAt: record.deletedAt || null,
  };
}

function publicAlert(alert) {
  return { id: alert.id, tone: alert.tone, title: alert.title, detail: alert.detail || '', source: alert.source || 'clinical-import', dismissed: Boolean(alert.dismissed), createdAt: alert.createdAt || null, updatedAt: alert.updatedAt || null };
}

function publicPatient(patient) {
  return { name: patient?.name || '', identifier: patient?.identifier || '', dateOfBirth: patient?.dateOfBirth || null };
}

function actorId(user) {
  return user.actorUserId || user.id;
}
