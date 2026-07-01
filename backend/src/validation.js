import { badRequest } from './errors.js';

export function signupSchema(body) {
  const input = {
    fullName: stringField(body.fullName, 'fullName'),
    email: stringField(body.email, 'email').toLowerCase(),
    dateOfBirth: stringField(body.dateOfBirth, 'dateOfBirth'),
    patientId: optionalString(body.patientId),
    password: stringField(body.password, 'password'),
  };

  if (!isEmail(input.email)) throw badRequest('A valid email address is required');
  if (!isIsoLikeDate(input.dateOfBirth)) throw badRequest('dateOfBirth must be a valid date');
  assertStrongPassword(input.password);
  return input;
}

export function loginSchema(body) {
  return {
    usernameOrEmail: stringField(body.usernameOrEmail ?? body.email ?? body.patientId, 'usernameOrEmail'),
    password: stringField(body.password, 'password'),
  };
}

export function taskStatusSchema(body) {
  if (typeof body.completed !== 'boolean') throw badRequest('completed must be a boolean');
  return { completed: body.completed };
}

export function shareRecordsSchema(body) {
  if (typeof body.shareRecords !== 'boolean') throw badRequest('shareRecords must be a boolean');
  return { shareRecords: body.shareRecords };
}

export function appointmentRequestSchema(body) {
  return {
    reason: stringField(body.reason, 'reason'),
    preferredDate: stringField(body.preferredDate, 'preferredDate'),
    notes: optionalString(body.notes),
  };
}

export function scheduleAppointmentSchema(body) {
  const provider = stringField(body.provider ?? body.clinician, 'provider');
  return {
    service: stringField(body.service, 'service'),
    clinician: provider,
    provider,
    date: stringField(body.date ?? body.preferredDate, 'date'),
    time: stringField(body.time, 'time'),
    department: stringField(body.department, 'department'),
    location: optionalString(body.location || 'Scheduling pending'),
    reason: stringField(body.reason ?? body.notes, 'reason'),
    notes: optionalString(body.notes || body.reason),
  };
}

export function rescheduleAppointmentSchema(body) {
  return {
    date: stringField(body.date ?? body.preferredDate, 'date'),
    time: stringField(body.time, 'time'),
    provider: optionalString(body.provider),
    department: optionalString(body.department),
    notes: optionalString(body.notes),
  };
}

export function cancelAppointmentSchema(body) {
  return {
    reason: optionalString(body.reason || 'Patient requested cancellation'),
  };
}

export function sendMessageSchema(body) {
  return {
    subject: stringField(body.subject, 'subject'),
    body: stringField(body.body, 'body'),
  };
}

export function conversationMessageSchema(body) {
  return {
    body: stringField(body.body ?? body.message, 'body'),
    attachment: attachmentSchema(body.attachment, false),
  };
}

export function conversationResolveSchema(body) {
  return {
    resolved: typeof body.resolved === 'boolean' ? body.resolved : true,
  };
}

export function medicationRequestSchema(body) {
  return {
    medicationName: stringField(body.medicationName, 'medicationName'),
    notes: optionalString(body.notes),
  };
}

export function drugInteractionSchema(body) {
  return {
    medicationName: stringField(body.medicationName, 'medicationName'),
  };
}

export function preferredPharmacySchema(body) {
  return {
    name: stringField(body.name, 'name'),
    addressLine1: stringField(body.addressLine1, 'addressLine1'),
    addressLine2: optionalString(body.addressLine2),
    phone: stringField(body.phone, 'phone'),
    hours: optionalString(body.hours || 'Hours unavailable'),
  };
}

export function billingPaymentSchema(body) {
  const amount = body.amount === undefined || body.amount === null || body.amount === ''
    ? null
    : Number(body.amount);
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
    throw badRequest('amount must be a positive number');
  }

  return {
    amount,
    invoiceId: optionalString(body.invoiceId),
    paymentMethodId: optionalString(body.paymentMethodId),
  };
}

export function paymentMethodSchema(body) {
  const type = stringField(body.type, 'type');
  if (!['Card', 'Bank'].includes(type)) throw badRequest('type must be Card or Bank');

  return {
    type,
    label: stringField(body.label, 'label'),
    detail: stringField(body.detail, 'detail'),
    isDefault: typeof body.isDefault === 'boolean' ? body.isDefault : false,
  };
}

export function rolePermissionsSchema(body) {
  if (!Array.isArray(body.permissions)) throw badRequest('permissions must be an array');
  return {
    permissions: body.permissions.map((item) => stringField(item, 'permission')),
  };
}

export function userAccessSchema(body) {
  if (!Array.isArray(body.roles)) throw badRequest('roles must be an array');
  return {
    roles: body.roles.map((item) => stringField(item, 'role')),
    status: stringField(body.status, 'status'),
  };
}

export function insuranceDetailsSchema(body) {
  return {
    primaryProvider: stringField(body.primaryProvider, 'primaryProvider'),
    memberId: stringField(body.memberId, 'memberId'),
    groupNumber: stringField(body.groupNumber, 'groupNumber'),
    policyHolder: stringField(body.policyHolder, 'policyHolder'),
    activeThrough: stringField(body.activeThrough, 'activeThrough'),
    verifiedAt: optionalString(body.verifiedAt || 'Pending verification'),
  };
}

export function patientNoteSchema(body) {
  return {
    title: stringField(body.title, 'title'),
    text: stringField(body.text ?? body.body, 'text'),
    type: optionalString(body.type || 'Patient Note'),
  };
}

export function referralRequestSchema(body) {
  return {
    provider: optionalString(body.provider || 'Care Team'),
    specialty: stringField(body.specialty, 'specialty'),
    reason: stringField(body.reason, 'reason'),
    clinic: optionalString(body.clinic),
  };
}

export function referralActionSchema(body) {
  return {
    action: stringField(body.action, 'action'),
    note: optionalString(body.note),
  };
}

export function proxyInviteSchema(body) {
  return {
    name: stringField(body.name, 'name'),
    relationship: stringField(body.relationship, 'relationship'),
    permissions: stringField(body.permissions, 'permissions'),
  };
}

export function proxyPermissionSchema(body) {
  return {
    permissions: stringField(body.permissions, 'permissions'),
  };
}

export function dependentSchema(body) {
  return {
    name: stringField(body.name, 'name'),
    relationship: stringField(body.relationship, 'relationship'),
    detail: optionalString(body.detail || 'Added from patient portal'),
    access: optionalString(body.access || 'View Only'),
  };
}

export function privacySettingsSchema(body) {
  return {
    shareRecords: typeof body.shareRecords === 'boolean' ? body.shareRecords : null,
    mentalHealthNotes: typeof body.mentalHealthNotes === 'boolean' ? body.mentalHealthNotes : null,
  };
}

export function unauthorizedAccessReportSchema(body) {
  return {
    summary: stringField(body.summary, 'summary'),
    contactPreference: optionalString(body.contactPreference || 'Secure message'),
  };
}

export function resourceInteractionSchema(body) {
  return {
    action: stringField(body.action, 'action'),
  };
}

export function uploadedFileSchema(body) {
  return {
    fileName: stringField(body.fileName ?? body.name, 'fileName'),
    category: stringField(body.category, 'category'),
    size: optionalString(body.size || 'Metadata only'),
    source: optionalString(body.source || 'patient-portal'),
    relatedId: optionalString(body.relatedId),
  };
}

export function emergencyContactSchema(body) {
  return {
    name: stringField(body.name, 'name'),
    relationship: stringField(body.relationship, 'relationship'),
    primaryPhone: stringField(body.primaryPhone, 'primaryPhone'),
    alternatePhone: optionalString(body.alternatePhone || '-'),
    access: stringField(body.access, 'access'),
  };
}

function attachmentSchema(value, required) {
  if (!value && !required) return null;
  if (!value || typeof value !== 'object') throw badRequest('attachment must be an object');
  return {
    fileName: stringField(value.fileName ?? value.name, 'attachment.fileName'),
    size: optionalString(value.size || 'Metadata only'),
  };
}

export function profileSchema(body) {
  const input = {
    fullName: stringField(body.fullName, 'fullName'),
    email: stringField(body.email, 'email').toLowerCase(),
    phone: stringField(body.phone, 'phone'),
    dateOfBirth: stringField(body.dateOfBirth, 'dateOfBirth'),
    address: stringField(body.address, 'address'),
    language: stringField(body.language, 'language'),
    timezone: stringField(body.timezone, 'timezone'),
  };

  if (!isEmail(input.email)) throw badRequest('A valid email address is required');
  return input;
}

function stringField(value, fieldName) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw badRequest(`${fieldName} is required`);
  return normalized;
}

function optionalString(value) {
  return String(value ?? '').trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isIsoLikeDate(value) {
  return !Number.isNaN(Date.parse(value));
}

function assertStrongPassword(password) {
  const failures = [];
  if (password.length < 8) failures.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) failures.push('one uppercase letter');
  if (!/\d/.test(password)) failures.push('one number');
  if (!/[^A-Za-z0-9]/.test(password)) failures.push('one special character');

  if (failures.length > 0) {
    throw badRequest('Password does not meet the security requirements', { requirements: failures });
  }
}
