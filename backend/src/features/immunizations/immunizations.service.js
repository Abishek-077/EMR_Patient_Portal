import { notFound } from '../../errors.js';
import { readDb } from '../../store.js';

export async function listImmunizations() {
  const db = await readDb();
  return {
    records: db.immunizationRecords,
    summary: {
      alerts: db.immunizationRecords.alerts.length,
      completed: db.immunizationRecords.completed.length,
      compliance: db.immunizationRecords.compliance,
    },
  };
}

export async function getImmunizationDetail(recordId) {
  const db = await readDb();
  const record = db.immunizationRecords.completed.find((item) => item.id === recordId);
  if (!record) throw notFound('Immunization record not found');

  return {
    record,
    patient: db.patient,
    generatedAt: new Date().toISOString(),
    printable: true,
    source: 'EMR Patient Portal immunization registry',
  };
}

export async function getPrintableImmunizationRecord() {
  const db = await readDb();
  return {
    title: 'Official Immunization Record',
    patient: db.patient,
    records: db.immunizationRecords.completed,
    alerts: db.immunizationRecords.alerts,
    compliance: db.immunizationRecords.compliance,
    generatedAt: new Date().toISOString(),
    printable: true,
  };
}
