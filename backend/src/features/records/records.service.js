import { randomUUID } from 'node:crypto';
import { forbidden, notFound } from '../../errors.js';
import { hasPermission } from '../../domain/access-control.js';
import { appendAuditLog, findOwned, scopeDbToPatient, stampPatientOwnership } from '../../domain/patient-scope.js';
import { readDb, updateDb } from '../../store.js';

export async function listHealthRecords(user, { query = '', type = 'all' } = {}) {
  const db = scopeDbToPatient(await readDb(), user);
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const normalizedType = String(type || 'all').toLowerCase();
  const matches = (...values) => !normalizedQuery || values.some((value) => String(value || '').toLowerCase().includes(normalizedQuery));

  const labResults = normalizedType === 'all' || normalizedType === 'labs'
    ? db.labResults.filter((lab) => matches(lab.label, lab.range, lab.unit))
    : [];
  const clinicalNotes = normalizedType === 'all' || normalizedType === 'notes'
    ? db.clinicalNotes.filter((note) => matches(note.title, note.text, note.type))
    : [];
  const documents = normalizedType === 'all' || normalizedType === 'documents'
    ? db.documents.filter((document) => matches(document.name, document.category, document.status))
    : [];
  const immunizations = normalizedType === 'all' || normalizedType === 'immunizations'
    ? db.immunizationRecords.completed.filter((record) => matches(record.vaccine, record.provider, record.route))
    : [];

  return {
    labResults,
    clinicalNotes,
    documents,
    immunizations,
    total: labResults.length + clinicalNotes.length + documents.length + immunizations.length,
  };
}

export async function addPatientNote(user, input) {
  return updateDb((db) => {
    db.clinicalNotes ||= [];
    db.activityLog ||= [];
    const now = new Date();
    const note = stampPatientOwnership({
      id: `note-${randomUUID()}`,
      type: input.type || 'Patient Note',
      date: now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      title: input.title,
      text: input.text,
      provenance: 'patient-reported',
      verificationStatus: 'unverified',
      createdAt: now.toISOString(),
    }, user);

    db.clinicalNotes.unshift(note);
    db.activityLog.unshift(stampPatientOwnership({
      id: `activity-${randomUUID()}`,
      type: 'record',
      title: 'Patient note added',
      detail: note.title,
      createdAt: note.createdAt,
    }, user));
    appendAuditLog(db, user, 'clinical note created', 'clinicalNote', note.id);
    return publicRecord(note);
  });
}

export async function updatePatientNote(user, noteId, input) {
  const note = await updateDb((db) => {
    const foundNote = findOwned(db.clinicalNotes || [], user, (item) => item.id === noteId);
    if (!foundNote) return null;
    assertPatientNoteMayBeChanged(foundNote, user);
    foundNote.title = input.title;
    foundNote.text = input.text;
    foundNote.type = input.type || foundNote.type || 'Patient Note';
    foundNote.updatedAt = new Date().toISOString();
    appendAuditLog(db, user, 'clinical note updated', 'clinicalNote', foundNote.id);
    return publicRecord(foundNote);
  });

  if (!note) throw notFound('Clinical note not found');
  return note;
}

export async function deletePatientNote(user, noteId) {
  const note = await updateDb((db) => {
    const foundNote = findOwned(db.clinicalNotes || [], user, (item) => item.id === noteId);
    if (!foundNote) return null;
    assertPatientNoteMayBeChanged(foundNote, user);
    foundNote.deletedAt = new Date().toISOString();
    foundNote.updatedAt = foundNote.deletedAt;
    appendAuditLog(db, user, 'clinical note deleted', 'clinicalNote', foundNote.id);
    return publicRecord(foundNote);
  });

  if (!note) throw notFound('Clinical note not found');
  return note;
}

export async function getLabDetail(user, labId) {
  const db = scopeDbToPatient(await readDb(), user);
  const normalizedLabId = String(labId || '').toLowerCase();
  const lab = findOwned(db.labResults, user, (item) => {
    const label = String(item.label || item.name || '');
    return String(item.id || '').toLowerCase() === normalizedLabId
      || labKey(label) === normalizedLabId
      || label.toLowerCase() === normalizedLabId;
  });
  if (!lab) throw notFound('Lab result not found');
  const label = String(lab.label || lab.name || 'Lab result');
  const comparison = db.healthTrends.labComparison.find((item) => (
    String(item.parameter || '').toLowerCase().includes(label.split(',')[0].toLowerCase())
  ));

  return {
    id: lab.id || labKey(label),
    lab: publicRecord(lab),
    comparison: comparison ? publicRecord(comparison) : null,
    narrative: `${label} is ${lab.value} ${lab.unit}. Reference range: ${lab.range || 'not provided'}. ${lab.tone === 'warning' ? 'Discuss this result with your care team.' : 'This result is within the visible target range.'}`,
    consultReason: `Consult about ${label}`,
  };
}

export async function getDocumentDetail(user, documentId) {
  const db = scopeDbToPatient(await readDb(), user);
  const document = findOwned(db.documents, user, (item) => item.id === documentId || item.name === documentId);
  if (!document) throw notFound('Document not found');

  return {
    document: publicRecord(document),
    generatedAt: new Date().toISOString(),
    printable: true,
    patient: db.patient,
    metadata: {
      category: document.category,
      status: document.status,
      updated: document.updated,
    },
  };
}

export async function getPrintableRecord(user, access) {
  const db = scopeDbToPatient(await readDb(), user);
  return {
    patient: {
      name: db.patient.name,
      identifier: db.patient.identifier,
      dateOfBirth: db.profileSettings.dateOfBirth,
    },
    generatedAt: new Date().toISOString(),
    labResults: db.labResults.map(publicRecord),
    clinicalNotes: db.clinicalNotes.map(publicRecord),
    immunizations: hasPermission(access, 'immunizations.view')
      ? db.immunizationRecords.completed.map(publicRecord)
      : [],
    medications: hasPermission(access, 'prescriptions.view') ? db.prescriptions.map(publicRecord) : [],
    documents: db.documents.map(publicRecord),
  };
}

function labKey(label) {
  return String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function assertPatientNoteMayBeChanged(note, user) {
  const isPatientReported = note.provenance === 'patient-reported'
    || String(note.type || '').toLowerCase() === 'patient note';
  if (!isPatientReported || note.verificationStatus === 'verified') {
    throw forbidden('Verified clinical notes cannot be changed through the patient-note workflow');
  }
  if (!user.actorUserId && note.createdByUserId && note.createdByUserId !== user.id) {
    throw forbidden('Only the author may change this patient note');
  }
}

function publicRecord(record) {
  if (!record || typeof record !== 'object') return record;
  const {
    patientId: _patientId,
    patientUuid: _patientUuid,
    userId: _userId,
    createdByUserId: _createdByUserId,
    ...visible
  } = record;
  return visible;
}
