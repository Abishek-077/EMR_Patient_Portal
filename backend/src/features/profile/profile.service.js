import { randomUUID } from 'node:crypto';
import { conflict, notFound } from '../../errors.js';
import {
  appendAuditLog,
  ensurePatientProfile,
  findOwned,
  getPatientId,
  scopeDbToPatient,
  stampPatientOwnership,
  updatePatientProfile,
} from '../../domain/patient-scope.js';
import { readDb, updateDb } from '../../store.js';

export async function getProfileOverview(user) {
  const db = scopeDbToPatient(await readDb(), user);
  return {
    profileSettings: db.profileSettings,
    accountStatus: db.accountStatus,
    insuranceDetails: db.insuranceDetails,
    emergencyContacts: db.emergencyContacts,
  };
}

export async function updateProfileSettings(userId, input) {
  return updateDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) throw notFound('User profile not found');
    const normalizedEmail = input.email.toLowerCase();
    const duplicate = db.users.some((item) => item.id !== userId && String(item.email || '').toLowerCase() === normalizedEmail);
    if (duplicate) throw conflict('An account with this email already exists');
    user.fullName = input.fullName;
    user.email = normalizedEmail;
    user.dateOfBirth = input.dateOfBirth;
    const profile = updatePatientProfile(db, user, {
      profileSettings: input,
      patient: {
        ...ensurePatientProfile(db, user).patient,
        name: input.fullName,
      },
      accountStatus: {
        ...ensurePatientProfile(db, user).accountStatus,
        profileCompletion: calculateProfileCompletion(input),
      },
    });
    appendAuditLog(db, user, 'profile updated', 'profile', profile.id);
    return profile.profileSettings;
  });
}

export async function updateInsuranceDetails(user, input) {
  return updateDb((db) => {
    const existingInsurance = ensurePatientProfile(db, user).insuranceDetails || {};
    const profile = updatePatientProfile(db, user, {
      insuranceDetails: {
        ...input,
        verifiedAt: user.actorUserId
          ? input.verifiedAt || existingInsurance.verifiedAt || 'Pending verification'
          : existingInsurance.verifiedAt || 'Pending verification',
        updatedAt: new Date().toISOString(),
      },
    });
    appendAuditLog(db, user, 'insurance updated', 'profile', profile.id);
    return profile.insuranceDetails;
  });
}

export async function addEmergencyContact(user, input) {
  return updateDb((db) => {
    db.emergencyContacts ||= [];
    const contact = stampPatientOwnership({
      id: `contact-${randomUUID()}`,
      ...input,
      createdAt: new Date().toISOString(),
    }, user);
    db.emergencyContacts.push(contact);
    appendAuditLog(db, user, 'emergency contact created', 'emergencyContact', contact.id);
    return publicEmergencyContact(contact);
  });
}

export async function updateEmergencyContact(user, contactId, input) {
  const contact = await updateDb((db) => {
    const foundContact = findOwned(db.emergencyContacts || [], user, (item) => item.id === contactId);
    if (!foundContact) return null;
    Object.assign(foundContact, input, { updatedAt: new Date().toISOString() });
    appendAuditLog(db, user, 'emergency contact updated', 'emergencyContact', contactId);
    return publicEmergencyContact(foundContact);
  });

  if (!contact) throw notFound('Emergency contact not found');
  return contact;
}

export async function deleteEmergencyContact(user, contactId) {
  const removed = await updateDb((db) => {
    const contact = findOwned(db.emergencyContacts || [], user, (item) => item.id === contactId);
    if (!contact) return null;
    db.emergencyContacts = db.emergencyContacts.filter((item) => (
      item.id !== contactId || item.patientId !== getPatientId(user)
    ));
    appendAuditLog(db, user, 'emergency contact deleted', 'emergencyContact', contactId);
    return publicEmergencyContact(contact);
  });

  if (!removed) throw notFound('Emergency contact not found');
  return removed;
}

function calculateProfileCompletion(profile) {
  const fields = ['fullName', 'email', 'phone', 'dateOfBirth', 'address', 'language', 'timezone'];
  const completed = fields.filter((field) => String(profile[field] || '').trim()).length;
  return Math.round((completed / fields.length) * 100);
}

function publicEmergencyContact(contact) {
  return {
    id: String(contact.id || ''),
    name: String(contact.name || ''),
    relationship: String(contact.relationship || ''),
    primaryPhone: String(contact.primaryPhone || ''),
    alternatePhone: String(contact.alternatePhone || ''),
    access: String(contact.access || ''),
    createdAt: contact.createdAt || '',
    updatedAt: contact.updatedAt || '',
  };
}
