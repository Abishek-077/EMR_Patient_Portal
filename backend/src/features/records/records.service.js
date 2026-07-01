import { randomUUID } from 'node:crypto';
import { notFound } from '../../errors.js';
import { readDb, updateDb } from '../../store.js';

export async function listHealthRecords({ query = '', type = 'all' } = {}) {
  const db = await readDb();
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

export async function addPatientNote(input) {
  return updateDb((db) => {
    db.clinicalNotes ||= [];
    db.activityLog ||= [];
    const now = new Date();
    const note = {
      id: `note-${randomUUID()}`,
      type: input.type || 'Patient Note',
      date: now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      title: input.title,
      text: input.text,
      createdAt: now.toISOString(),
    };

    db.clinicalNotes.unshift(note);
    db.activityLog.unshift({
      id: `activity-${randomUUID()}`,
      type: 'record',
      title: 'Patient note added',
      detail: note.title,
      createdAt: note.createdAt,
    });
    return note;
  });
}

export async function getLabDetail(labId) {
  const db = await readDb();
  const normalizedLabId = String(labId || '').toLowerCase();
  const lab = db.labResults.find((item) => labKey(item.label) === normalizedLabId || item.label.toLowerCase() === normalizedLabId);
  if (!lab) throw notFound('Lab result not found');
  const comparison = db.healthTrends.labComparison.find((item) => item.parameter.toLowerCase().includes(lab.label.split(',')[0].toLowerCase()));

  return {
    id: labKey(lab.label),
    lab,
    comparison: comparison || null,
    narrative: `${lab.label} is ${lab.value} ${lab.unit}. Reference range: ${lab.range}. ${lab.tone === 'warning' ? 'Discuss this result with your care team.' : 'This result is within the visible target range.'}`,
    consultReason: `Consult about ${lab.label}`,
  };
}

export async function getDocumentDetail(documentId) {
  const db = await readDb();
  const document = db.documents.find((item) => item.id === documentId || item.name === documentId);
  if (!document) throw notFound('Document not found');

  return {
    document,
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

export async function getPrintableRecord() {
  const db = await readDb();
  return {
    patient: db.patient,
    profileSettings: db.profileSettings,
    generatedAt: new Date().toISOString(),
    labResults: db.labResults,
    clinicalNotes: db.clinicalNotes,
    immunizations: db.immunizationRecords.completed,
    medications: db.prescriptions,
    documents: db.documents,
  };
}

function labKey(label) {
  return String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
