import { createHash, randomUUID } from 'node:crypto';
import { seedData } from '../seed-data.js';

const OWNED_ARRAY_KEYS = [
  'tasks',
  'appointments',
  'appointmentRequests',
  'medications',
  'prescriptions',
  'refillRequests',
  'medicationRequests',
  'labResults',
  'clinicalNotes',
  'immunizations',
  'messages',
  'messageConversations',
  'documents',
  'uploadedFiles',
  'activityLog',
  'resourceInteractions',
  'interactionChecks',
];

const BILLING_ARRAY_KEYS = ['paymentMethods', 'invoices', 'payments', 'statements', 'paymentSessions'];

export function normalizePatientData(db) {
  db.patientProfiles = Array.isArray(db.patientProfiles) ? db.patientProfiles : [];
  const patientUsers = getPatientUsers(db);

  for (const user of patientUsers) {
    user.patientUuid = getPatientId(user);
    migrateLegacyPatientOwnership(db, user);
  }

  for (const user of patientUsers) {
    ensurePatientProfile(db, user);
  }

  recalculateAllBillingSummaries(db);
  return db;
}

export function provisionPatientDemoData(db, user) {
  const profile = ensurePatientProfile(db, user, { forceUserFields: true, demo: true });
  if (!isPatientUser(user)) return profile;

  if (hasAnyPatientData(db, user)) return profile;

  if (hasUnownedDemoData(db)) {
    stampUnownedTopLevelArrays(db, user);
    stampUnownedBilling(db, user);
    stampUnownedNestedArrays(db, user);
  } else {
    appendSeedDataForPatient(db, user);
  }

  recalculateBillingSummary(db, user);
  return profile;
}

export function scopeDbToPatient(db, user) {
  const profile = ensurePatientProfile(db, user);
  return {
    ...db,
    patient: profile.patient,
    profileSettings: profile.profileSettings,
    accountStatus: profile.accountStatus,
    insuranceDetails: profile.insuranceDetails,
    preferences: profile.preferences,
    preferredPharmacy: profile.preferredPharmacy,
    emergencyContacts: filterOwned(db.emergencyContacts || [], user),
    tasks: filterOwned(db.tasks || [], user),
    appointments: filterOwned(db.appointments || [], user),
    appointmentRequests: filterOwned(db.appointmentRequests || [], user),
    medications: filterOwned(db.medications || [], user),
    prescriptions: filterOwned(db.prescriptions || [], user),
    refillRequests: filterOwned(db.refillRequests || [], user),
    medicationRequests: filterOwned(db.medicationRequests || [], user),
    labResults: filterOwned(db.labResults || [], user),
    clinicalNotes: filterOwned(db.clinicalNotes || [], user),
    immunizations: filterOwned(db.immunizations || [], user),
    messages: filterOwned(db.messages || [], user),
    messageConversations: filterOwned(db.messageConversations || [], user),
    documents: filterOwned(db.documents || [], user),
    uploadedFiles: filterOwned(db.uploadedFiles || [], user),
    activityLog: filterOwned(db.activityLog || [], user),
    resourceInteractions: filterOwned(db.resourceInteractions || [], user),
    interactionChecks: filterOwned(db.interactionChecks || [], user),
    billing: getBillingForPatient(db, user),
    immunizationRecords: scopeImmunizationRecords(db.immunizationRecords, user),
    healthTrends: scopeHealthTrends(db.healthTrends, user),
  };
}

export function ensurePatientProfile(db, user, options = {}) {
  if (!user?.id) throw new TypeError('A persisted user is required to resolve a patient profile');
  db.patientProfiles ||= [];
  const patientId = getPatientId(user);
  let profile = db.patientProfiles.find((item) => item.userId === user.id)
    || db.patientProfiles.find((item) => item.patientId === patientId);

  if (!profile) {
    profile = {
      id: `patient-profile-${randomUUID()}`,
      userId: user.id,
      patientId,
      patient: patientSummaryForUser(db, user),
      profileSettings: profileSettingsForUser(db, user),
      accountStatus: emptyAccountStatus(),
      insuranceDetails: emptyInsuranceDetails(),
      preferences: emptyPreferences(),
      preferredPharmacy: emptyPreferredPharmacy(),
      createdAt: new Date().toISOString(),
    };
    db.patientProfiles.push(profile);
  }

  profile.userId = user.id;
  profile.patientId = patientId;
  if (options.forceUserFields) {
    profile.patient = patientSummaryForUser(db, user, profile.patient);
    profile.profileSettings = profileSettingsForUser(db, user, profile.profileSettings);
  }
  if (options.demo) applyDemoProfileDefaults(profile, user);
  return profile;
}

export function updatePatientProfile(db, user, updates) {
  const profile = ensurePatientProfile(db, user);
  Object.assign(profile, updates, { updatedAt: new Date().toISOString() });
  return profile;
}

export function stampPatientOwnership(record, user, extra = {}) {
  return {
    ...record,
    patientId: getPatientId(user),
    userId: record.userId || user.id,
    createdByUserId: record.createdByUserId || user.id,
    ...extra,
  };
}

export function filterOwned(items = [], user) {
  const patientId = getPatientId(user);
  return (Array.isArray(items) ? items : []).filter((item) => item?.patientId === patientId && !isDeleted(item));
}

export function findOwned(items = [], user, predicate) {
  return filterOwned(items, user).find(predicate);
}

export function appendAuditLog(db, user, action, resourceType, resourceId = '', metadata = {}) {
  const now = new Date().toISOString();
  const actorUserId = user?.actorUserId || user?.id || 'anonymous';
  const subjectPatientId = metadata.patientId
    || user?.subjectPatientId
    || (isPatientUser(user) ? getPatientId(user) : '');
  const entry = {
    id: `audit-${randomUUID()}`,
    actorUserId,
    patientId: subjectPatientId,
    action,
    resourceType,
    resourceId,
    timestamp: now,
    metadata,
  };

  db.auditLog ||= [];
  db.auditLog.push(entry);
  db.auditLog = db.auditLog.slice(-500);

  db.activityLog ||= [];
  if (entry.patientId) {
    db.activityLog.unshift(stampPatientOwnership({
      id: `activity-${randomUUID()}`,
      type: 'audit',
      title: action,
      detail: `${resourceType}${resourceId ? `: ${resourceId}` : ''}`,
      createdAt: now,
    }, user, { patientId: entry.patientId, createdByUserId: actorUserId }));
  }

  return entry;
}

export function getPatientId(user) {
  const existing = String(user?.patientUuid || '').trim();
  if (existing) return existing;
  const userId = String(user?.id || '').trim();
  if (!userId) return '';

  const hex = createHash('sha256').update(`emr-patient:${userId}`).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

export function recalculateBillingSummary(db, user) {
  const patientId = getPatientId(user);
  db.billing ||= {};
  const invoices = (db.billing.invoices || []).filter((invoice) => invoice.patientId === patientId && !isDeleted(invoice));
  const outstandingBalance = invoices.reduce((sum, invoice) => sum + invoiceBalanceDue(invoice), 0);
  const profile = ensurePatientProfile(db, user);

  profile.billingSummary = {
    outstandingBalance: roundMoney(outstandingBalance),
    paymentStatus: outstandingBalance <= 0 ? 'Paid' : 'Due',
    dueDate: nextDueDate(invoices),
    breakdown: billingBreakdown(invoices),
  };
  return profile.billingSummary;
}

export function getBillingForPatient(db, user) {
  const summary = recalculateBillingSummary(db, user);
  const billing = db.billing || {};
  const invoices = filterOwned(billing.invoices || [], user).map((invoice) => publicInvoice(normalizeInvoiceTotals(invoice)));
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id));

  return {
    outstandingBalance: summary.outstandingBalance,
    outstandingBalanceCents: Math.round(summary.outstandingBalance * 100),
    paymentStatus: summary.paymentStatus,
    dueDate: summary.dueDate,
    breakdown: summary.breakdown,
    breakdownCents: Object.fromEntries(Object.entries(summary.breakdown).map(([key, value]) => [key, Math.round(Number(value || 0) * 100)])),
    paymentMethods: filterOwned(billing.paymentMethods || [], user).map(safePaymentMethod),
    invoices,
    payments: filterOwned(billing.payments || [], user).map(publicPayment),
    statements: filterOwned(billing.statements || [], user).map((statement) => ({
      id: String(statement.id || ''),
      invoiceIds: (statement.invoiceIds || []).filter((invoiceId) => invoiceIds.has(invoiceId)),
      period: String(statement.period || ''),
      generatedAt: statement.generatedAt || statement.createdAt || '',
      status: String(statement.status || 'Ready'),
    })),
    paymentSessions: filterOwned(billing.paymentSessions || [], user).map(publicPaymentSession),
    resources: (billing.resources || seedData.billing.resources || []).map(publicBillingResource),
  };
}

export function normalizeInvoiceTotals(invoice) {
  const amount = Number(invoice.amount || 0);
  const paidAmount = Number(invoice.paidAmount ?? (invoice.status === 'Paid' ? amount : 0));
  const balanceDue = Math.max(0, roundMoney(Number(invoice.balanceDue ?? amount - paidAmount)));
  let status = invoice.status;
  if (balanceDue <= 0) status = 'Paid';
  else if (paidAmount > 0) status = 'Partially Paid';
  else if (!['Pending', 'Overdue'].includes(status)) status = 'Pending';

  return {
    ...invoice,
    amount,
    paidAmount: roundMoney(paidAmount),
    balanceDue,
    status,
  };
}

export function invoiceBalanceDue(invoice) {
  return normalizeInvoiceTotals(invoice).balanceDue;
}

export function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function stampUnownedTopLevelArrays(db, user) {
  for (const key of OWNED_ARRAY_KEYS) {
    db[key] = stampUnownedArray(db[key], user);
  }
  db.emergencyContacts = stampUnownedArray(db.emergencyContacts, user);
}

function stampUnownedBilling(db, user) {
  db.billing ||= {};
  for (const key of BILLING_ARRAY_KEYS) {
    db.billing[key] = stampUnownedArray(db.billing[key], user);
  }
}

function stampUnownedNestedArrays(db, user) {
  db.immunizationRecords ||= {};
  db.immunizationRecords.alerts = stampUnownedArray(db.immunizationRecords.alerts, user);
  db.immunizationRecords.completed = stampUnownedArray(db.immunizationRecords.completed, user);

  db.healthTrends ||= {};
  db.healthTrends.metrics = stampUnownedArray(db.healthTrends.metrics, user);
  db.healthTrends.labComparison = stampUnownedArray(db.healthTrends.labComparison, user);
  db.healthTrends.goals = stampUnownedArray(db.healthTrends.goals, user);
}

function stampUnownedArray(items, user) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => item?.patientId ? item : stampPatientOwnership(item, user));
}

function isDeleted(item) {
  return Boolean(item?.deletedAt || item?.deleted_at);
}

function appendSeedDataForPatient(db, user) {
  for (const key of OWNED_ARRAY_KEYS) {
    db[key] ||= [];
    db[key].push(...cloneOwnedArray(seedData[key], user));
  }

  db.emergencyContacts ||= [];
  db.emergencyContacts.push(...cloneOwnedArray(seedData.emergencyContacts, user));

  db.billing ||= {};
  for (const key of BILLING_ARRAY_KEYS) {
    db.billing[key] ||= [];
    db.billing[key].push(...cloneOwnedArray(seedData.billing[key], user));
  }
  db.billing.resources ||= structuredClone(seedData.billing.resources);

  db.immunizationRecords ||= {};
  db.immunizationRecords.alerts ||= [];
  db.immunizationRecords.completed ||= [];
  db.immunizationRecords.alerts.push(...cloneOwnedArray(seedData.immunizationRecords.alerts, user));
  db.immunizationRecords.completed.push(...cloneOwnedArray(seedData.immunizationRecords.completed, user));
  db.immunizationRecords.compliance ||= structuredClone(seedData.immunizationRecords.compliance);

  db.healthTrends ||= {};
  db.healthTrends.metrics ||= [];
  db.healthTrends.labComparison ||= [];
  db.healthTrends.goals ||= [];
  db.healthTrends.metrics.push(...cloneOwnedArray(seedData.healthTrends.metrics, user));
  db.healthTrends.labComparison.push(...cloneOwnedArray(seedData.healthTrends.labComparison, user));
  db.healthTrends.goals.push(...cloneOwnedArray(seedData.healthTrends.goals, user));
  db.healthTrends.summary ||= structuredClone(seedData.healthTrends.summary);
}

function cloneOwnedArray(items = [], user) {
  return structuredClone(items || []).map((item) => stampPatientOwnership(item, user));
}

function hasAnyPatientData(db, user) {
  const patientId = getPatientId(user);
  const substantiveCollections = ['appointments', 'prescriptions', 'labResults', 'clinicalNotes', 'documents'];
  return substantiveCollections.some((key) => (db[key] || []).some((item) => item?.patientId === patientId)) ||
    (db.billing?.invoices || []).some((item) => item?.patientId === patientId);
}

function hasUnownedDemoData(db) {
  return OWNED_ARRAY_KEYS.some((key) => (db[key] || []).some((item) => item && !item.patientId && !item.userId))
    || BILLING_ARRAY_KEYS.some((key) => (db.billing?.[key] || []).some((item) => item && !item.patientId && !item.userId));
}

function getPatientUsers(db) {
  return (Array.isArray(db.users) ? db.users : []).filter(isPatientUser);
}

function isPatientUser(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean);
  return roles.includes('patient');
}

function patientSummaryForUser(_db, user, current = {}) {
  return {
    name: '',
    age: 0,
    identifier: 'Health ID: Unassigned',
    location: '',
    primaryCondition: '',
    careTeam: '',
    insurance: '',
    preferredLanguage: '',
    emergencyContact: '',
    ...current,
    name: user.fullName || current.name || '',
    identifier: user.patientId ? `Health ID: ${user.patientId}` : current.identifier || 'Health ID: Unassigned',
  };
}

function profileSettingsForUser(_db, user, current = {}) {
  return {
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    language: '',
    timezone: '',
    ...current,
    fullName: user.fullName || current.fullName || '',
    email: user.email || current.email || '',
    dateOfBirth: user.dateOfBirth || current.dateOfBirth || '',
  };
}

function scopeImmunizationRecords(records = {}, user) {
  const alerts = filterOwned(records.alerts || [], user);
  const completed = filterOwned(records.completed || [], user);
  const recommended = Math.max(completed.length, Number(records.compliance?.recommended || completed.length));
  return {
    alerts,
    completed,
    compliance: {
      percent: recommended ? Math.round((completed.length / recommended) * 100) : 0,
      completed: completed.length,
      recommended,
      detail: recommended ? `${completed.length} of ${recommended} recommended immunizations recorded` : 'No recommendations available',
    },
  };
}

function scopeHealthTrends(healthTrends = {}, user) {
  const metrics = filterOwned(healthTrends.metrics || [], user);
  const attentionRequired = metrics.filter((metric) => /elevated|attention|high|low|critical/i.test(String(metric.status || ''))).length;
  return {
    summary: {
      withinRange: Math.max(0, metrics.length - attentionRequired),
      attentionRequired,
      updates: metrics
        .filter((metric) => metric.updatedAt || metric.readings?.[0]?.recordedAt)
        .map((metric) => `${metric.label} updated ${metric.updatedAt || metric.readings[0].recordedAt}`)
        .slice(0, 4),
    },
    metrics,
    labComparison: filterOwned(healthTrends.labComparison || [], user),
    goals: filterOwned(healthTrends.goals || [], user),
  };
}

function safePaymentMethod(method) {
  return {
    id: String(method.id || ''),
    type: String(method.type || ''),
    label: String(method.label || ''),
    detail: String(method.detail || ''),
    isDefault: Boolean(method.isDefault),
  };
}

function recalculateAllBillingSummaries(db) {
  for (const user of getPatientUsers(db)) {
    recalculateBillingSummary(db, user);
  }
}

function migrateLegacyPatientOwnership(db, user) {
  const canonicalId = getPatientId(user);
  const profile = (db.patientProfiles || []).find((item) => item.userId === user.id);
  const legacyIds = new Set([
    canonicalId,
    String(user.id || '').trim(),
    String(user.patientId || '').trim(),
    String(profile?.patientId || '').trim(),
  ].filter(Boolean));

  if (profile) {
    profile.patientId = canonicalId;
    profile.userId = user.id;
  }

  const migrateArray = (items) => {
    for (const item of Array.isArray(items) ? items : []) {
      if (!item || typeof item !== 'object') continue;
      if (item.userId === user.id || legacyIds.has(String(item.patientId || '').trim())) {
        item.patientId = canonicalId;
        item.userId ||= user.id;
      }
    }
  };

  for (const key of [...OWNED_ARRAY_KEYS, 'emergencyContacts']) migrateArray(db[key]);
  for (const key of BILLING_ARRAY_KEYS) migrateArray(db.billing?.[key]);
  migrateArray(db.immunizationRecords?.alerts);
  migrateArray(db.immunizationRecords?.completed);
  migrateArray(db.healthTrends?.metrics);
  migrateArray(db.healthTrends?.labComparison);
  migrateArray(db.healthTrends?.goals);

}

function applyDemoProfileDefaults(profile, user) {
  profile.patient = {
    ...structuredClone(seedData.patient),
    name: user.fullName || seedData.patient.name,
    identifier: user.patientId ? `Health ID: ${user.patientId}` : 'Health ID: Unassigned',
  };
  profile.profileSettings = {
    ...structuredClone(seedData.profileSettings),
    fullName: user.fullName || seedData.profileSettings.fullName,
    email: user.email || seedData.profileSettings.email,
    dateOfBirth: user.dateOfBirth || seedData.profileSettings.dateOfBirth,
  };
  profile.accountStatus = structuredClone(seedData.accountStatus);
  profile.insuranceDetails = structuredClone(seedData.insuranceDetails);
  profile.preferences = structuredClone(seedData.preferences);
  profile.preferredPharmacy = structuredClone(seedData.preferredPharmacy);
}

function emptyAccountStatus() {
  return {
    profileCompletion: 0,
    twoFactorEnabled: false,
    lastLogin: '',
    privacyNotice: '',
  };
}

function emptyInsuranceDetails() {
  return {
    primaryProvider: '',
    memberId: '',
    groupNumber: '',
    policyHolder: '',
    activeThrough: '',
    verifiedAt: 'Pending verification',
  };
}

function emptyPreferences() {
  return { shareRecords: false, mentalHealthNotes: false };
}

function emptyPreferredPharmacy() {
  return {
    id: '',
    name: '',
    addressLine1: '',
    addressLine2: '',
    phone: '',
    hours: '',
    isPreferred: false,
    updatedAt: '',
  };
}

function publicInvoice(invoice) {
  return {
    id: String(invoice.id || ''),
    date: String(invoice.date || ''),
    dueDate: String(invoice.dueDate || ''),
    description: String(invoice.description || ''),
    category: String(invoice.category || ''),
    amount: roundMoney(invoice.amount),
    amountCents: Math.round(Number(invoice.amount || 0) * 100),
    paidAmount: roundMoney(invoice.paidAmount),
    paidAmountCents: Math.round(Number(invoice.paidAmount || 0) * 100),
    balanceDue: roundMoney(invoice.balanceDue),
    balanceDueCents: Math.round(Number(invoice.balanceDue || 0) * 100),
    status: String(invoice.status || 'Pending'),
    createdAt: invoice.createdAt || '',
    updatedAt: invoice.updatedAt || '',
    paidAt: invoice.paidAt || '',
  };
}

function publicPayment(payment) {
  return {
    id: String(payment.id || ''),
    amount: roundMoney(payment.amount),
    amountCents: Number(payment.amountCents || Math.round(Number(payment.amount || 0) * 100)),
    invoiceId: payment.invoiceId || null,
    paymentMethodId: payment.paymentMethodId || null,
    status: String(payment.status || 'succeeded'),
    providerReference: payment.providerReference || null,
    createdAt: payment.createdAt || '',
  };
}

function publicPaymentSession(session) {
  return {
    id: String(session.id || ''),
    invoiceId: session.invoiceId || null,
    amount: roundMoney(session.amount),
    amountCents: Math.round(Number(session.amount || 0) * 100),
    status: String(session.status || ''),
    qrPayload: String(session.qrPayload || ''),
    expiresAt: session.expiresAt || '',
    createdAt: session.createdAt || '',
  };
}

function publicBillingResource(resource) {
  return {
    id: String(resource.id || ''),
    title: String(resource.title || ''),
    detail: String(resource.detail || ''),
  };
}

function billingBreakdown(invoices) {
  const breakdown = { consultation: 0, laboratory: 0, radiology: 0, pharmacy: 0 };
  for (const invoice of invoices) {
    const text = `${invoice.category || ''} ${invoice.description || ''}`.toLowerCase();
    const key = /lab|diagnostic|blood/.test(text)
      ? 'laboratory'
      : /radiology|imaging|x-ray|scan|mri/.test(text)
        ? 'radiology'
        : /pharmacy|medication|prescription/.test(text)
          ? 'pharmacy'
          : 'consultation';
    breakdown[key] = roundMoney(breakdown[key] + invoiceBalanceDue(invoice));
  }
  return breakdown;
}

function nextDueDate(invoices) {
  const unpaid = invoices.filter((invoice) => invoiceBalanceDue(invoice) > 0);
  if (!unpaid.length) return '';
  const sorted = [...unpaid].sort((left, right) => {
    const leftTime = Date.parse(left.dueDate || left.date || '') || Number.MAX_SAFE_INTEGER;
    const rightTime = Date.parse(right.dueDate || right.date || '') || Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime;
  });
  return String(sorted[0].dueDate || sorted[0].date || '');
}
