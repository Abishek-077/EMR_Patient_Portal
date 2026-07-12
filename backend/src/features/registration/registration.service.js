import { conflict, notFound } from '../../errors.js';
import {
  appendAuditLog,
  ensurePatientProfile,
  updatePatientProfile,
} from '../../domain/patient-scope.js';
import { readDb, updateDb } from '../../store.js';

const DEFAULT_CONSENTS = [
  {
    id: 'privacy-practices',
    version: '2026-01',
    title: 'Notice of Privacy Practices',
    description: 'Acknowledgement that privacy practices were made available for review.',
  },
  {
    id: 'treatment-consent',
    version: '2026-01',
    title: 'Consent for Treatment',
    description: 'Permission for the care team to provide evaluation, diagnosis, and treatment.',
  },
  {
    id: 'financial-responsibility',
    version: '2026-01',
    title: 'Financial Responsibility',
    description: 'Agreement to billing, insurance, and patient responsibility terms.',
  },
];

const DEFAULT_FORMS = [
  {
    id: 'pre-visit-history',
    title: 'Pre-Visit Health History',
    fields: {
      reasonForVisit: '',
      currentMedications: '',
      allergies: '',
      surgeries: '',
    },
  },
  {
    id: 'communication-preferences',
    title: 'Communication Preferences',
    fields: {
      preferredContactMethod: '',
      preferredContactTime: '',
      interpreterNeeded: '',
      accessibilityNeeds: '',
    },
  },
];

export async function getRegistrationIntake(user) {
  const db = await readDb();
  const profile = ensurePatientProfile(db, user);
  return buildRegistrationIntake(profile, user);
}

export async function updateRegistrationDemographics(user, input) {
  return updateDb((db) => {
    const normalizedEmail = input.email.toLowerCase();
    const duplicate = (db.users || []).some((item) => item.id !== user.id && String(item.email || '').toLowerCase() === normalizedEmail);
    if (duplicate) throw conflict('An account with this email already exists');
    const profile = ensurePatientProfile(db, user);
    const registration = buildRegistrationIntake(profile, user);
    const updatedAt = new Date().toISOString();

    const nextProfileSettings = {
      ...profile.profileSettings,
      fullName: input.fullName,
      email: normalizedEmail,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth,
      address: input.address,
      language: input.preferredLanguage || profile.profileSettings?.language || 'English (US)',
    };

    const nextPatient = {
      ...profile.patient,
      name: input.fullName,
      preferredLanguage: input.preferredLanguage || profile.patient?.preferredLanguage || 'English',
      emergencyContact: input.emergencyContact || profile.patient?.emergencyContact || '',
    };

    const stored = updatePatientProfile(db, user, {
      patient: nextPatient,
      profileSettings: nextProfileSettings,
      registration: {
        ...registration,
        demographics: {
          ...input,
          updatedAt,
        },
      },
    });

    const storedUser = db.users?.find((item) => item.id === user.id);
    if (storedUser) {
      storedUser.fullName = input.fullName;
      storedUser.email = normalizedEmail;
      storedUser.dateOfBirth = input.dateOfBirth;
    }

    appendAuditLog(db, user, 'registration demographics updated', 'registration', stored.id);
    return buildRegistrationIntake(stored, { ...user, fullName: input.fullName, email: normalizedEmail, dateOfBirth: input.dateOfBirth });
  });
}

export async function updateRegistrationInsurance(user, input) {
  return updateDb((db) => {
    const profile = ensurePatientProfile(db, user);
    const registration = buildRegistrationIntake(profile, user);
    const updatedAt = new Date().toISOString();
    const stored = updatePatientProfile(db, user, {
      insuranceDetails: {
        ...input,
        verifiedAt: profile.insuranceDetails?.verifiedAt || 'Pending verification',
        updatedAt,
      },
      registration: {
        ...registration,
        insurance: {
          ...input,
          verifiedAt: profile.insuranceDetails?.verifiedAt || 'Pending verification',
          updatedAt,
        },
      },
    });

    appendAuditLog(db, user, 'registration insurance updated', 'registration', stored.id);
    return buildRegistrationIntake(stored, user);
  });
}

export async function signRegistrationConsent(user, consentId, input) {
  return updateDb((db) => {
    const profile = ensurePatientProfile(db, user);
    const registration = buildRegistrationIntake(profile, user);
    const consent = registration.consents.find((item) => item.id === consentId);
    if (!consent) throw notFound('Consent not found');

    const signedConsent = {
      ...consent,
      signerName: user.fullName,
      signerUserId: user.id,
      documentVersion: consent.version,
      signedAt: new Date().toISOString(),
    };

    const stored = updatePatientProfile(db, user, {
      registration: {
        ...registration,
        consents: registration.consents.map((item) => (item.id === consentId ? signedConsent : item)),
      },
    });

    appendAuditLog(db, user, 'registration consent signed', 'registrationConsent', consentId);
    return buildRegistrationIntake(stored, user);
  });
}

export async function updateRegistrationForm(user, formId, input) {
  return updateDb((db) => {
    const profile = ensurePatientProfile(db, user);
    const registration = buildRegistrationIntake(profile, user);
    const form = registration.forms.find((item) => item.id === formId);
    if (!form) throw notFound('Registration form not found');

    const updatedForm = {
      ...form,
      fields: {
        ...form.fields,
        ...input.fields,
      },
      status: input.status || form.status,
      updatedAt: new Date().toISOString(),
    };

    const stored = updatePatientProfile(db, user, {
      registration: {
        ...registration,
        forms: registration.forms.map((item) => (item.id === formId ? updatedForm : item)),
      },
    });

    appendAuditLog(db, user, 'registration form updated', 'registrationForm', formId);
    return buildRegistrationIntake(stored, user);
  });
}

function buildRegistrationIntake(profile, user) {
  const current = profile.registration || {};
  const demographics = {
    ...(current.demographics || {}),
    fullName: user.fullName || profile.profileSettings?.fullName || profile.patient?.name || '',
    email: user.email || profile.profileSettings?.email || '',
    phone: profile.profileSettings?.phone || '',
    dateOfBirth: user.dateOfBirth || profile.profileSettings?.dateOfBirth || '',
    address: profile.profileSettings?.address || '',
    preferredLanguage: profile.profileSettings?.language || profile.patient?.preferredLanguage || 'English (US)',
    emergencyContact: current.demographics?.emergencyContact || profile.patient?.emergencyContact || '',
  };
  const insurance = {
    ...(profile.insuranceDetails || {}),
    ...(current.insurance || {}),
  };
  const consents = mergeConsents(current.consents);
  const forms = mergeForms(current.forms);
  const completion = calculateCompletion({ demographics, insurance, consents, forms });

  return {
    demographics,
    insurance,
    consents,
    forms,
    completion,
    updatedAt: latestTimestamp([
      demographics.updatedAt,
      insurance.updatedAt,
      ...consents.map((item) => item.signedAt),
      ...forms.map((item) => item.updatedAt),
    ]),
  };
}

function mergeConsents(currentConsents = []) {
  return DEFAULT_CONSENTS.map((consent) => ({
    ...consent,
    ...(currentConsents.find((item) => item.id === consent.id) || {}),
  }));
}

function mergeForms(currentForms = []) {
  return DEFAULT_FORMS.map((form) => {
    const current = currentForms.find((item) => item.id === form.id) || {};
    return {
      ...form,
      ...current,
      fields: {
        ...form.fields,
        ...(current.fields || {}),
      },
      status: current.status || inferFormStatus(current.fields || form.fields),
    };
  });
}

function calculateCompletion(intake) {
  const steps = [
    requiredFieldsComplete(intake.demographics, ['fullName', 'email', 'phone', 'dateOfBirth', 'address']),
    requiredFieldsComplete(intake.insurance, ['primaryProvider', 'memberId', 'groupNumber', 'policyHolder']),
    intake.consents.every((consent) => Boolean(consent.signedAt)),
    intake.forms.every((form) => Object.values(form.fields || {}).every((value) => String(value || '').trim())),
  ];
  const completedSteps = steps.filter(Boolean).length;
  return {
    completedSteps,
    totalSteps: steps.length,
    percent: Math.round((completedSteps / steps.length) * 100),
    status: completedSteps === steps.length ? 'Complete' : completedSteps > 0 ? 'In Progress' : 'Not Started',
  };
}

function requiredFieldsComplete(record, fields) {
  return fields.every((field) => String(record?.[field] || '').trim());
}

function inferFormStatus(fields = {}) {
  const values = Object.values(fields);
  if (values.length && values.every((value) => String(value || '').trim())) return 'Complete';
  return values.some((value) => String(value || '').trim()) ? 'In Progress' : 'Not Started';
}

function latestTimestamp(values) {
  const timestamps = values.filter(Boolean).map((value) => Date.parse(value)).filter((value) => !Number.isNaN(value));
  if (!timestamps.length) return '';
  return new Date(Math.max(...timestamps)).toISOString();
}
