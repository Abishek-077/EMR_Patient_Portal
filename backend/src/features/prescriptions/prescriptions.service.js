import { randomUUID } from 'node:crypto';
import { notFound } from '../../errors.js';
import { readDb, updateDb } from '../../store.js';

export async function getPrescriptionsOverview() {
  const db = await readDb();
  const prescriptions = db.prescriptions;
  const refillRequests = db.refillRequests;
  const medicationRequests = db.medicationRequests;

  return {
    preferredPharmacy: db.preferredPharmacy,
    summary: buildMedicationSummary(prescriptions, refillRequests, medicationRequests),
    prescriptions,
    refillRequests,
    medicationRequests,
    pagination: {
      page: 1,
      pageSize: 5,
      total: Math.max(prescriptions.length, 12),
    },
  };
}

export async function getPrintablePrescriptions() {
  const db = await readDb();
  return {
    title: 'Medication List',
    generatedAt: new Date().toISOString(),
    preferredPharmacy: db.preferredPharmacy,
    prescriptions: db.prescriptions,
    refillRequests: db.refillRequests,
    medicationRequests: db.medicationRequests,
    summary: buildMedicationSummary(db.prescriptions, db.refillRequests, db.medicationRequests),
  };
}

export async function getMedicationLeaflet(prescriptionId) {
  const db = await readDb();
  const prescription = db.prescriptions.find((item) => item.id === prescriptionId) || db.prescriptions[0];
  if (!prescription) throw notFound('Prescription not found');
  const medicationName = prescription.name.split(/\s+\d/)[0];

  return {
    prescription,
    title: `${medicationName} Medication Guide`,
    generatedAt: new Date().toISOString(),
    sections: [
      {
        heading: 'Purpose',
        body: `${medicationName} is listed in your active medication profile. Use only as directed by your care team.`,
      },
      {
        heading: 'How to take',
        body: prescription.frequency || 'Follow the directions on your prescription label.',
      },
      {
        heading: 'Refills',
        body: `${prescription.refillCount} refills remaining. ${prescription.refillDetail}`,
      },
      {
        heading: 'Safety',
        body: 'Report severe side effects, allergies, or unexpected symptoms to your clinician before changing dose or schedule.',
      },
    ],
  };
}

export async function checkDrugInteractions(input) {
  const medicationName = String(input.medicationName || '').trim();
  const db = await updateDb((database) => {
    database.interactionChecks ||= [];
    const activePrescriptions = (database.prescriptions || []).filter((item) => item.status === 'Active' || item.status === 'Refill Due');
    const normalizedMedication = medicationName.toLowerCase();
    const warnings = activePrescriptions
      .filter((item) => {
        const normalizedPrescription = item.name.toLowerCase();
        return /ibuprofen|naproxen|nsaid/.test(normalizedMedication) && /lisinopril|warfarin|blood thinner/.test(normalizedPrescription);
      })
      .map((item) => ({
        medication: item.name,
        severity: /warfarin|blood thinner/i.test(item.name) ? 'High' : 'Moderate',
        message: `${medicationName} may require clinical review with ${item.name}.`,
      }));
    const result = {
      id: `interaction-${randomUUID()}`,
      medicationName,
      checkedAgainst: activePrescriptions.map((item) => item.name),
      severity: warnings.some((warning) => warning.severity === 'High') ? 'High' : warnings.length ? 'Moderate' : 'None',
      warnings,
      recommendation: warnings.length
        ? 'Message your care team before starting this medication.'
        : 'No interaction flags were found in the local medication profile.',
      createdAt: new Date().toISOString(),
    };
    database.interactionChecks.unshift(result);
    database.activityLog ||= [];
    database.activityLog.unshift({
      id: `activity-${randomUUID()}`,
      type: 'prescription',
      title: 'Drug interaction check completed',
      detail: `${medicationName}: ${result.severity}`,
      createdAt: result.createdAt,
    });
    return result;
  });

  return db;
}

export async function requestRefill(prescriptionId) {
  const refillRequest = await updateDb((db) => {
    db.refillRequests ||= [];
    db.prescriptions ||= [];
    const prescription = db.prescriptions.find((item) => item.id === prescriptionId);
    if (!prescription) return null;

    const existingRequest = db.refillRequests.find(
      (item) => item.prescriptionId === prescription.id && ['Queued', 'Pending'].includes(item.status),
    );
    if (existingRequest) return existingRequest;

    const createdRequest = {
      id: `refill-${randomUUID()}`,
      prescriptionId: prescription.id,
      prescriptionName: prescription.name,
      pharmacyId: db.preferredPharmacy?.id || null,
      pharmacyName: db.preferredPharmacy?.name || 'Preferred pharmacy',
      status: 'Queued',
      createdAt: new Date().toISOString(),
    };
    db.refillRequests.unshift(createdRequest);
    return createdRequest;
  });

  if (!refillRequest) throw notFound('Prescription not found');
  return refillRequest;
}

export async function requestMedication(input) {
  return updateDb((db) => {
    db.medicationRequests ||= [];
    db.prescriptions ||= [];
    const createdRequest = {
      id: `medication-${randomUUID()}`,
      medicationName: input.medicationName,
      notes: input.notes,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };

    db.medicationRequests.unshift(createdRequest);
    db.prescriptions.push({
      id: `rx-pending-${randomUUID()}`,
      name: input.medicationName,
      detail: 'Oral - Rx: Pending',
      frequency: 'Pending clinical review',
      started: '-',
      refillCount: '-',
      refillDetail: input.notes,
      status: 'Pending Request',
      medicationRequestId: createdRequest.id,
    });

    return createdRequest;
  });
}

export async function updatePreferredPharmacy(input) {
  return updateDb((db) => {
    db.preferredPharmacy = {
      id: db.preferredPharmacy?.id || `pharmacy-${randomUUID()}`,
      ...input,
      isPreferred: true,
      updatedAt: new Date().toISOString(),
    };
    return db.preferredPharmacy;
  });
}

function buildMedicationSummary(prescriptions, refillRequests, medicationRequests) {
  return {
    activeMedications: prescriptions.filter((item) => item.status === 'Active' || item.status === 'Refill Due').length,
    dueForRefill: prescriptions.filter((item) => item.status === 'Refill Due').length,
    pendingRequests:
      medicationRequests.filter((item) => item.status === 'Pending').length +
      refillRequests.filter((item) => ['Queued', 'Pending'].includes(item.status)).length,
  };
}
