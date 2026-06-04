import { randomUUID } from 'node:crypto';
import { notFound } from '../errors.js';
import { readDb, updateDb } from '../store.js';

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

