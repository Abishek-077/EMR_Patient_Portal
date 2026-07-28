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
  const input = {
    reason: limitedString(body.reason, 'reason', 240),
    preferredDate: stringField(body.preferredDate, 'preferredDate'),
    notes: limitedOptionalString(body.notes, 'notes', 2_000),
  };
  assertFutureDate(input.preferredDate, 'preferredDate');
  return input;
}

export function scheduleAppointmentSchema(body) {
  const provider = stringField(body.provider ?? body.clinician, 'provider');
  const input = {
    slotId: optionalString(body.slotId),
    service: limitedString(body.service, 'service', 160),
    clinician: provider,
    provider,
    date: stringField(body.date ?? body.preferredDate, 'date'),
    time: stringField(body.time, 'time'),
    department: limitedString(body.department, 'department', 120),
    location: limitedOptionalString(body.location || 'Scheduling pending', 'location', 240),
    reason: limitedString(body.reason ?? body.notes, 'reason', 240),
    notes: limitedOptionalString(body.notes || body.reason, 'notes', 2_000),
  };
  assertFutureDate(input.date, 'date');
  return input;
}

export function rescheduleAppointmentSchema(body) {
  const input = {
    slotId: optionalString(body.slotId),
    date: stringField(body.date ?? body.preferredDate, 'date'),
    time: stringField(body.time, 'time'),
    provider: optionalString(body.provider),
    department: optionalString(body.department),
    notes: limitedOptionalString(body.notes, 'notes', 2_000),
  };
  assertFutureDate(input.date, 'date');
  return input;
}

export function cancelAppointmentSchema(body) {
  return {
    reason: limitedOptionalString(body.reason || 'Patient requested cancellation', 'reason', 500),
  };
}

export function appointmentDecisionSchema(body) {
  const decision = enumField(body.decision, 'decision', ['Approved', 'Rejected']);
  const input = {
    decision,
    reason: limitedOptionalString(body.reason, 'reason', 500),
    slotId: optionalString(body.slotId),
    provider: optionalString(body.provider),
    department: optionalString(body.department),
    date: optionalString(body.date),
    time: optionalString(body.time),
    location: limitedOptionalString(body.location, 'location', 240),
  };
  if (decision === 'Rejected' && !input.reason) throw badRequest('reason is required when rejecting a request');
  if (input.date) assertFutureDate(input.date, 'date');
  return input;
}

export function sendMessageSchema(body) {
  return {
    recipientId: limitedOptionalString(body.recipientId || 'patient-support', 'recipientId', 200),
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
    medicationName: limitedString(body.medicationName, 'medicationName', 160),
    notes: limitedOptionalString(body.notes, 'notes', 2_000),
  };
}

export function prescriptionDecisionSchema(body) {
  const decision = enumField(body.decision, 'decision', ['Approved', 'Rejected']);
  const input = {
    decision,
    reason: limitedOptionalString(body.reason, 'reason', 500),
    dosage: limitedOptionalString(body.dosage, 'dosage', 120),
    frequency: limitedOptionalString(body.frequency, 'frequency', 160),
    instructions: limitedOptionalString(body.instructions, 'instructions', 1_000),
    refillCount: body.refillCount === undefined ? null : integerInRange(body.refillCount, 'refillCount', 0, 24),
  };
  if (decision === 'Rejected' && !input.reason) throw badRequest('reason is required when rejecting a request');
  return input;
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
    idempotencyKey: limitedOptionalString(body.idempotencyKey, 'idempotencyKey', 200),
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

export function createUserSchema(body) {
  const input = {
    fullName: stringField(body.fullName, 'fullName'),
    email: stringField(body.email, 'email').toLowerCase(),
    dateOfBirth: optionalString(body.dateOfBirth || '1970-01-01'),
    patientId: optionalString(body.patientId),
    roles: Array.isArray(body.roles) ? body.roles : ['patient'],
    status: optionalString(body.status || 'Active'),
    password: optionalString(body.password),
  };
  if (!isEmail(input.email)) throw badRequest('A valid email address is required');
  if (input.password) assertStrongPassword(input.password);
  return input;
}

export function invoiceSchema(body) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw badRequest('amount must be a positive number');
  return {
    description: stringField(body.description, 'description'),
    amount,
    date: optionalString(body.date || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })),
    status: optionalString(body.status || 'Pending'),
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

export function registrationDemographicsSchema(body) {
  const input = {
    fullName: stringField(body.fullName, 'fullName'),
    email: stringField(body.email, 'email').toLowerCase(),
    phone: stringField(body.phone, 'phone'),
    dateOfBirth: stringField(body.dateOfBirth, 'dateOfBirth'),
    address: stringField(body.address, 'address'),
    preferredLanguage: optionalString(body.preferredLanguage || body.language || 'English (US)'),
    emergencyContact: optionalString(body.emergencyContact),
  };

  if (!isEmail(input.email)) throw badRequest('A valid email address is required');
  if (!isIsoLikeDate(input.dateOfBirth)) throw badRequest('dateOfBirth must be a valid date');
  return input;
}

export function registrationFormSchema(body) {
  if (!body || typeof body !== 'object') throw badRequest('form payload is required');
  const fields = body.fields && typeof body.fields === 'object' && !Array.isArray(body.fields)
    ? Object.fromEntries(Object.entries(body.fields).map(([key, value]) => [key, String(value ?? '').trim()]))
    : {};

  return {
    fields,
    status: optionalString(body.status || inferRegistrationFormStatus(fields)),
  };
}

export function consentSignatureSchema(body) {
  return {
    signerName: stringField(body.signerName, 'signerName'),
  };
}

export function patientNoteSchema(body) {
  return {
    title: stringField(body.title, 'title'),
    text: stringField(body.text ?? body.body, 'text'),
    type: optionalString(body.type || 'Patient Note'),
  };
}

export function resourceInteractionSchema(body) {
  const requestedAction = stringField(body.action, 'action');
  const action = /^(read|read article|view guide|learn more)$/i.test(requestedAction)
    ? 'Read'
    : enumField(requestedAction, 'action', ['Save', 'Unsave', 'Download']);
  return {
    action,
  };
}

export function uploadedFileSchema(body, { requireContent = false } = {}) {
  const fileName = limitedString(body.fileName ?? body.name, 'fileName', 160);
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const allowedExtensions = new Set(['pdf', 'png', 'jpg', 'jpeg', 'txt', 'csv']);
  if (!allowedExtensions.has(extension)) throw badRequest('Unsupported file type');

  const fileContent = Buffer.isBuffer(body.fileContent) ? body.fileContent : null;
  if (requireContent && (!fileContent || fileContent.length === 0)) throw badRequest('A non-empty multipart file is required');
  const size = optionalString(body.size || (fileContent ? `${fileContent.length} B` : '0 B'));
  const parsedSize = parseSizeInBytes(size);
  const bytes = fileContent?.length ?? (Number.isFinite(Number(body.bytes)) ? Number(body.bytes) : parsedSize);
  if (bytes !== null && bytes > 10 * 1024 * 1024) throw badRequest('File exceeds the 10 MB upload limit');

  const mimeType = optionalString(body.mimeType) || expectedMimeType(extension);
  assertFileContentMatches(fileContent, extension, mimeType);

  return {
    fileName,
    category: limitedString(body.category, 'category', 120),
    size,
    source: limitedOptionalString(body.source || 'patient-portal', 'source', 120),
    relatedId: optionalString(body.relatedId),
    mimeType,
    bytes,
    fileContent,
  };
}

export function uploadedFileUpdateSchema(body) {
  const fileName = body.fileName === undefined && body.name === undefined
    ? ''
    : limitedString(body.fileName ?? body.name, 'fileName', 160);
  if (fileName) {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    if (!['pdf', 'png', 'jpg', 'jpeg', 'txt', 'csv'].includes(extension)) throw badRequest('Unsupported file type');
  }
  const category = body.category === undefined ? '' : limitedString(body.category, 'category', 120);
  const source = body.source === undefined ? '' : limitedOptionalString(body.source, 'source', 120);
  if (!fileName && !category && !source && body.relatedId === undefined) throw badRequest('At least one file field must be provided');
  return { fileName, category, source, relatedId: body.relatedId === undefined ? undefined : optionalString(body.relatedId) };
}

export function immunizationRecordSchema(body) {
  const input = {
    vaccine: limitedString(body.vaccine ?? body.title, 'vaccine', 200),
    date: stringField(body.date ?? body.last, 'date'),
    dose: limitedString(body.dose ?? body.doses, 'dose', 120),
    provider: limitedOptionalString(body.provider || 'Patient entered', 'provider', 160),
    route: limitedOptionalString(body.route || 'Unknown', 'route', 120),
  };
  if (!isIsoLikeDate(input.date)) throw badRequest('date must be a valid date');
  if (Date.parse(input.date) > Date.now()) throw badRequest('date cannot be in the future');
  return input;
}

export function immunizationVerificationSchema(body) {
  return {
    decision: enumField(body.decision, 'decision', ['Verified', 'Rejected']),
    note: limitedOptionalString(body.note, 'note', 1_000),
  };
}

export function immunizationAlertSchema(body) {
  return {
    title: limitedString(body.title, 'title', 200),
    detail: limitedOptionalString(body.detail, 'detail', 1_000),
    tone: enumField(body.tone || 'info', 'tone', ['info', 'warning', 'neutral', 'success', 'danger']),
  };
}

export function trendReadingSchema(body) {
  const recordedAt = optionalString(body.recordedAt || new Date().toISOString());
  if (!isIsoLikeDate(recordedAt)) throw badRequest('recordedAt must be a valid date');
  if (Date.parse(recordedAt) > Date.now() + 5 * 60_000) throw badRequest('recordedAt cannot be in the future');
  return {
    metricId: optionalString(body.metricId),
    label: limitedString(body.label, 'label', 120),
    value: limitedString(body.value, 'value', 80),
    unit: limitedOptionalString(body.unit, 'unit', 40),
    recordedAt,
  };
}

export function trendGoalSchema(body) {
  const progress = Number(body.progress);
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    throw badRequest('progress must be a number from 0 to 100');
  }
  return {
    label: limitedString(body.label, 'label', 160),
    progress,
  };
}

function parseSizeInBytes(value) {
  const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb)?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = String(match[2] || 'b').toLowerCase();
  if (unit === 'mb') return amount * 1024 * 1024;
  if (unit === 'kb') return amount * 1024;
  return amount;
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
    fileId: limitedString(value.fileId, 'attachment.fileId', 200),
    fileName: limitedOptionalString(value.fileName ?? value.name, 'attachment.fileName', 160),
    size: limitedOptionalString(value.size, 'attachment.size', 40),
    mimeType: limitedOptionalString(value.mimeType, 'attachment.mimeType', 120),
    downloadUrl: limitedOptionalString(value.downloadUrl, 'attachment.downloadUrl', 500),
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

function limitedString(value, fieldName, maxLength) {
  const normalized = stringField(value, fieldName);
  if (normalized.length > maxLength) throw badRequest(`${fieldName} must be ${maxLength} characters or fewer`);
  return normalized;
}

function optionalString(value) {
  return String(value ?? '').trim();
}

function limitedOptionalString(value, fieldName, maxLength) {
  const normalized = optionalString(value);
  if (normalized.length > maxLength) throw badRequest(`${fieldName} must be ${maxLength} characters or fewer`);
  return normalized;
}

function enumField(value, fieldName, allowedValues) {
  const normalized = stringField(value, fieldName);
  const matched = allowedValues.find((item) => item.toLowerCase() === normalized.toLowerCase());
  if (!matched) throw badRequest(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
  return matched;
}

function integerInRange(value, fieldName, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw badRequest(`${fieldName} must be an integer from ${minimum} to ${maximum}`);
  }
  return number;
}

function assertFutureDate(value, fieldName) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw badRequest(`${fieldName} must be a valid date`);
  if (timestamp <= Date.now()) throw badRequest(`${fieldName} must be in the future`);
}

function expectedMimeType(extension) {
  return {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    txt: 'text/plain',
    csv: 'text/csv',
  }[extension] || 'application/octet-stream';
}

function assertFileContentMatches(content, extension, mimeType) {
  const expected = expectedMimeType(extension);
  if (mimeType && mimeType.toLowerCase() !== expected) {
    throw badRequest(`mimeType must match the .${extension} file extension (${expected})`);
  }
  if (!content) return;

  const magicMatches = {
    pdf: () => content.subarray(0, 5).toString('ascii') === '%PDF-',
    png: () => content.length >= 8 && content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    jpg: () => content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff,
    jpeg: () => content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff,
    txt: () => !content.includes(0),
    csv: () => !content.includes(0),
  }[extension];

  if (magicMatches && !magicMatches()) throw badRequest(`File content does not match the .${extension} extension`);
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

function inferRegistrationFormStatus(fields) {
  return Object.values(fields).some((value) => String(value || '').trim()) ? 'In Progress' : 'Not Started';
}
