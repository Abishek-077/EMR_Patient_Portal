import { randomUUID } from 'node:crypto';
import { conflict, notFound } from '../../errors.js';
import { appendAuditLog, filterOwned, findOwned, scopeDbToPatient, stampPatientOwnership, updatePatientProfile } from '../../domain/patient-scope.js';
import { drugInteractionGateway } from '../../providers/index.js';
import { readDb, updateDb } from '../../store.js';

const PENDING_STATUSES = new Set(['Pending', 'Queued', 'Requested']);

export async function getPrescriptionsOverview(user) {
  const db = scopeDbToPatient(await readDb(), user);
  const prescriptions = (db.prescriptions || []).map(publicPrescription);
  const refillRequests = (db.refillRequests || []).map(publicRequest);
  const medicationRequests = (db.medicationRequests || []).map(publicRequest);

  return {
    preferredPharmacy: publicPharmacy(db.preferredPharmacy),
    summary: buildMedicationSummary(prescriptions, refillRequests, medicationRequests),
    prescriptions,
    refillRequests,
    medicationRequests,
    pagination: { page: 1, pageSize: prescriptions.length || 1, total: prescriptions.length, totalPages: 1 },
  };
}

export async function listPrescriptionRequests(user, { status = 'Pending' } = {}) {
  const db = scopeDbToPatient(await readDb(), user);
  const desiredStatus = String(status || 'Pending');
  const refillRequests = (db.refillRequests || []).map(publicRequest).filter((item) => desiredStatus === 'All' || item.status === desiredStatus);
  const medicationRequests = (db.medicationRequests || []).map(publicRequest).filter((item) => desiredStatus === 'All' || item.status === desiredStatus);
  return { refillRequests, medicationRequests, total: refillRequests.length + medicationRequests.length };
}

export async function getPrintablePrescriptions(user) {
  const overview = await getPrescriptionsOverview(user);
  return {
    title: 'Medication List',
    generatedAt: new Date().toISOString(),
    preferredPharmacy: overview.preferredPharmacy,
    prescriptions: overview.prescriptions,
    refillRequests: overview.refillRequests,
    medicationRequests: overview.medicationRequests,
    summary: overview.summary,
  };
}

export async function getMedicationLeaflet(user, prescriptionId) {
  const db = scopeDbToPatient(await readDb(), user);
  const prescription = findOwned(db.prescriptions || [], user, (item) => item.id === prescriptionId);
  if (!prescription) throw notFound('Prescription not found');
  const safePrescription = publicPrescription(prescription);
  const medicationName = String(prescription.name || '').split(/\s+\d/)[0];

  return {
    prescription: safePrescription,
    title: `${medicationName} Medication Guide`,
    generatedAt: new Date().toISOString(),
    sections: [
      { heading: 'Purpose', body: `${medicationName} is listed in your medication profile. Use only as directed by your care team.` },
      { heading: 'How to take', body: prescription.frequency || prescription.instructions || 'Follow the directions on your prescription label.' },
      { heading: 'Refills', body: `${prescription.refillCount ?? 0} refills remaining. ${prescription.refillDetail || ''}`.trim() },
      { heading: 'Safety', body: 'Report severe side effects, allergies, or unexpected symptoms to your clinician before changing dose or schedule.' },
    ],
  };
}

export async function checkDrugInteractions(user, input) {
  const database = await readDb();
  const activePrescriptions = filterOwned(database.prescriptions || [], user)
    .filter((item) => ['Active', 'Refill Due'].includes(item.status));
  const gatewayResult = await drugInteractionGateway.check({ medicationName: input.medicationName, currentMedications: activePrescriptions });

  return updateDb((db) => {
    db.interactionChecks ||= [];
    const result = stampPatientOwnership({
      id: `interaction-${randomUUID()}`,
      medicationName: input.medicationName,
      checkedAgainst: gatewayResult.currentMedications,
      severity: gatewayResult.severity,
      warnings: gatewayResult.warnings,
      recommendation: gatewayResult.warnings.length ? 'Contact your care team before starting this medication.' : 'No local informational rule matched.',
      disclaimer: gatewayResult.disclaimer,
      provider: gatewayResult.provider,
      createdAt: gatewayResult.checkedAt,
    }, user);
    db.interactionChecks.unshift(result);
    appendAuditLog(db, user, 'drug interaction informational check', 'prescription', result.id);
    return publicInteractionCheck(result);
  });
}

export async function requestRefill(user, prescriptionId) {
  const refillRequest = await updateDb((db) => {
    db.refillRequests ||= [];
    const prescription = findOwned(db.prescriptions || [], user, (item) => item.id === prescriptionId);
    if (!prescription) return null;
    if (!['Active', 'Refill Due'].includes(prescription.status)) throw conflict('This prescription is not eligible for a refill request');

    const existingRequest = filterOwned(db.refillRequests, user).find(
      (item) => item.prescriptionId === prescription.id && PENDING_STATUSES.has(item.status),
    );
    if (existingRequest) return publicRequest(existingRequest);

    const pharmacy = scopeDbToPatient(db, user).preferredPharmacy || {};
    const createdRequest = stampPatientOwnership({
      id: `refill-${randomUUID()}`,
      requestType: 'Refill',
      prescriptionId: prescription.id,
      prescriptionName: prescription.name,
      pharmacyId: pharmacy.id || null,
      pharmacyName: pharmacy.name || 'Preferred pharmacy',
      status: 'Pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, user);
    db.refillRequests.unshift(createdRequest);
    appendAuditLog(db, user, 'refill requested', 'prescription', prescription.id);
    return publicRequest(createdRequest);
  });

  if (!refillRequest) throw notFound('Prescription not found');
  return refillRequest;
}

export async function cancelRefillRequest(user, requestId) {
  const request = await updateDb((db) => {
    const found = findOwned(db.refillRequests || [], user, (item) => item.id === requestId);
    if (!found) return null;
    assertPending(found, 'Refill request');
    markCancelled(found);
    appendAuditLog(db, user, 'refill request cancelled', 'refillRequest', found.id);
    return publicRequest(found);
  });
  if (!request) throw notFound('Refill request not found');
  return request;
}

export async function reviewRefillRequest(user, requestId, input) {
  const result = await updateDb((db) => {
    const request = findOwned(db.refillRequests || [], user, (item) => item.id === requestId);
    if (!request) return null;
    if (normalizeRequestStatus(request.status) === input.decision) return publicRequest(request);
    assertPending(request, 'Refill request');
    const now = new Date().toISOString();
    request.status = input.decision;
    request.decisionReason = input.reason;
    request.reviewedByUserId = actorId(user);
    request.reviewedAt = now;
    request.updatedAt = now;
    if (input.decision === 'Approved') {
      const prescription = findOwned(db.prescriptions || [], user, (item) => item.id === request.prescriptionId);
      if (!prescription) throw notFound('Prescription linked to refill request was not found');
      prescription.status = 'Active';
      prescription.lastRefillApprovedAt = now;
      prescription.updatedAt = now;
    }
    appendAuditLog(db, user, `refill request ${input.decision.toLowerCase()}`, 'refillRequest', request.id, { reason: input.reason });
    return publicRequest(request);
  });
  if (!result) throw notFound('Refill request not found');
  return result;
}

export async function requestMedication(user, input) {
  return updateDb((db) => {
    db.medicationRequests ||= [];
    const existing = filterOwned(db.medicationRequests, user).find((item) => (
      PENDING_STATUSES.has(item.status) && item.medicationName.toLowerCase() === input.medicationName.toLowerCase()
    ));
    if (existing) return publicRequest(existing);
    const now = new Date().toISOString();
    const createdRequest = stampPatientOwnership({
      id: `medication-${randomUUID()}`,
      requestType: 'Medication',
      medicationName: input.medicationName,
      notes: input.notes,
      status: 'Pending',
      createdAt: now,
      updatedAt: now,
    }, user);
    db.medicationRequests.unshift(createdRequest);
    appendAuditLog(db, user, 'medication requested', 'medicationRequest', createdRequest.id);
    return publicRequest(createdRequest);
  });
}

export async function updateMedicationRequest(user, requestId, input) {
  const medicationRequest = await updateDb((db) => {
    const foundRequest = findOwned(db.medicationRequests || [], user, (item) => item.id === requestId);
    if (!foundRequest) return null;
    assertPending(foundRequest, 'Medication request');
    foundRequest.medicationName = input.medicationName;
    foundRequest.notes = input.notes;
    foundRequest.updatedAt = new Date().toISOString();
    appendAuditLog(db, user, 'medication request updated', 'medicationRequest', foundRequest.id);
    return publicRequest(foundRequest);
  });
  if (!medicationRequest) throw notFound('Medication request not found');
  return medicationRequest;
}

export async function cancelMedicationRequest(user, requestId) {
  const medicationRequest = await updateDb((db) => {
    const foundRequest = findOwned(db.medicationRequests || [], user, (item) => item.id === requestId);
    if (!foundRequest) return null;
    assertPending(foundRequest, 'Medication request');
    markCancelled(foundRequest);
    appendAuditLog(db, user, 'medication request cancelled', 'medicationRequest', foundRequest.id);
    return publicRequest(foundRequest);
  });
  if (!medicationRequest) throw notFound('Medication request not found');
  return medicationRequest;
}

export async function reviewMedicationRequest(user, requestId, input) {
  const result = await updateDb((db) => {
    const request = findOwned(db.medicationRequests || [], user, (item) => item.id === requestId);
    if (!request) return null;
    if (normalizeRequestStatus(request.status) === input.decision) {
      const existingPrescription = request.prescriptionId
        ? findOwned(db.prescriptions || [], user, (item) => item.id === request.prescriptionId)
        : null;
      return { request: publicRequest(request), prescription: existingPrescription ? publicPrescription(existingPrescription) : null };
    }
    assertPending(request, 'Medication request');
    const now = new Date().toISOString();
    request.status = input.decision;
    request.decisionReason = input.reason;
    request.reviewedByUserId = actorId(user);
    request.reviewedAt = now;
    request.updatedAt = now;
    let prescription = null;
    if (input.decision === 'Approved') {
      db.prescriptions ||= [];
      prescription = stampPatientOwnership({
        id: `rx-${randomUUID()}`,
        requestId: request.id,
        name: request.medicationName,
        detail: input.dosage || 'Dose provided by prescriber',
        frequency: input.frequency || input.instructions || 'Follow prescriber instructions',
        instructions: input.instructions,
        started: now.slice(0, 10),
        refillCount: input.refillCount ?? 0,
        refillDetail: input.refillCount ? `${input.refillCount} refills authorized` : 'No refills authorized',
        status: 'Active',
        provenance: 'clinician',
        verificationStatus: 'Verified',
        prescribedByUserId: actorId(user),
        createdAt: now,
        updatedAt: now,
      }, user);
      db.prescriptions.unshift(prescription);
      request.prescriptionId = prescription.id;
    }
    appendAuditLog(db, user, `medication request ${input.decision.toLowerCase()}`, 'medicationRequest', request.id, { prescriptionId: prescription?.id || null, reason: input.reason });
    return { request: publicRequest(request), prescription: prescription ? publicPrescription(prescription) : null };
  });
  if (!result) throw notFound('Medication request not found');
  return result;
}

export async function updatePreferredPharmacy(user, input) {
  return updateDb((db) => {
    const current = scopeDbToPatient(db, user).preferredPharmacy || {};
    const preferredPharmacy = {
      id: current.id || `pharmacy-${randomUUID()}`,
      ...input,
      isPreferred: true,
      updatedAt: new Date().toISOString(),
    };
    updatePatientProfile(db, user, { preferredPharmacy });
    appendAuditLog(db, user, 'preferred pharmacy updated', 'preferredPharmacy', preferredPharmacy.id);
    return publicPharmacy(preferredPharmacy);
  });
}

function buildMedicationSummary(prescriptions, refillRequests, medicationRequests) {
  return {
    activeMedications: prescriptions.filter((item) => ['Active', 'Refill Due'].includes(item.status)).length,
    dueForRefill: prescriptions.filter((item) => item.status === 'Refill Due').length,
    pendingRequests: [...medicationRequests, ...refillRequests].filter((item) => item.status === 'Pending').length,
  };
}

function assertPending(request, label) {
  if (!PENDING_STATUSES.has(request.status)) throw conflict(`${label} is already ${normalizeRequestStatus(request.status).toLowerCase()}`);
}

function markCancelled(request) {
  const now = new Date().toISOString();
  request.status = 'Cancelled';
  request.cancelledAt = now;
  request.updatedAt = now;
}

function normalizeRequestStatus(status) {
  return PENDING_STATUSES.has(status) ? 'Pending' : status || 'Pending';
}

function publicPrescription(item) {
  return {
    id: item.id,
    requestId: item.requestId || null,
    name: item.name,
    detail: item.detail || '',
    frequency: item.frequency || '',
    instructions: item.instructions || '',
    started: item.started || '',
    refillCount: item.refillCount ?? 0,
    refillDetail: item.refillDetail || '',
    status: item.status,
    provenance: item.provenance || 'clinical-import',
    verificationStatus: item.verificationStatus || 'Verified',
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function publicRequest(item) {
  return {
    id: item.id,
    requestType: item.requestType || (item.prescriptionId ? 'Refill' : 'Medication'),
    prescriptionId: item.prescriptionId || null,
    prescriptionName: item.prescriptionName || '',
    medicationName: item.medicationName || item.prescriptionName || '',
    notes: item.notes || '',
    pharmacyId: item.pharmacyId || null,
    pharmacyName: item.pharmacyName || '',
    status: normalizeRequestStatus(item.status),
    decisionReason: item.decisionReason || '',
    prescriptionCreatedId: item.prescriptionId || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    reviewedAt: item.reviewedAt || null,
  };
}

function publicPharmacy(item) {
  if (!item) return null;
  return { id: item.id, name: item.name, addressLine1: item.addressLine1, addressLine2: item.addressLine2 || '', phone: item.phone, hours: item.hours || '', isPreferred: item.isPreferred !== false, updatedAt: item.updatedAt || null };
}

function publicInteractionCheck(item) {
  return { id: item.id, medicationName: item.medicationName, checkedAgainst: item.checkedAgainst, severity: item.severity, warnings: item.warnings, recommendation: item.recommendation, disclaimer: item.disclaimer, provider: item.provider, createdAt: item.createdAt };
}

function actorId(user) {
  return user.actorUserId || user.id;
}
