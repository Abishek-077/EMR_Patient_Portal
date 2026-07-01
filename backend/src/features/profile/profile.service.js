import { randomUUID } from 'node:crypto';
import { notFound } from '../../errors.js';
import { readDb, updateDb } from '../../store.js';

export async function getProfileOverview() {
  const db = await readDb();
  return {
    profileSettings: db.profileSettings,
    accountStatus: db.accountStatus,
    insuranceDetails: db.insuranceDetails,
    emergencyContacts: db.emergencyContacts,
  };
}

export async function updateProfileSettings(userId, input) {
  return updateDb((db) => {
    db.profileSettings = input;
    db.patient = {
      ...(db.patient || {}),
      name: input.fullName,
    };
    const user = db.users.find((item) => item.id === userId);
    if (user) {
      user.fullName = input.fullName;
      user.email = input.email.toLowerCase();
    }
    db.accountStatus.profileCompletion = calculateProfileCompletion(input);
    return db.profileSettings;
  });
}

export async function updateInsuranceDetails(input) {
  return updateDb((db) => {
    db.insuranceDetails = {
      ...input,
      verifiedAt: input.verifiedAt || db.insuranceDetails?.verifiedAt || 'Pending verification',
      updatedAt: new Date().toISOString(),
    };
    return db.insuranceDetails;
  });
}

export async function addEmergencyContact(input) {
  return updateDb((db) => {
    db.emergencyContacts ||= [];
    const contact = {
      id: `contact-${randomUUID()}`,
      ...input,
      createdAt: new Date().toISOString(),
    };
    db.emergencyContacts.push(contact);
    return contact;
  });
}

export async function updateEmergencyContact(contactId, input) {
  const contact = await updateDb((db) => {
    const index = db.emergencyContacts.findIndex((item) => item.id === contactId);
    if (index < 0) return null;
    db.emergencyContacts[index] = {
      ...db.emergencyContacts[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    return db.emergencyContacts[index];
  });

  if (!contact) throw notFound('Emergency contact not found');
  return contact;
}

export async function deleteEmergencyContact(contactId) {
  const removed = await updateDb((db) => {
    const contact = db.emergencyContacts.find((item) => item.id === contactId);
    if (!contact) return null;
    db.emergencyContacts = db.emergencyContacts.filter((item) => item.id !== contactId);
    return contact;
  });

  if (!removed) throw notFound('Emergency contact not found');
  return removed;
}

function calculateProfileCompletion(profile) {
  const fields = ['fullName', 'email', 'phone', 'dateOfBirth', 'address', 'language', 'timezone'];
  const completed = fields.filter((field) => String(profile[field] || '').trim()).length;
  return Math.round((completed / fields.length) * 100);
}
