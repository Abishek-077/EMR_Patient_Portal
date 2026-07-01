import { readDb } from '../../store.js';
import { hasPermission } from '../../domain/access-control.js';
import { toPublicUser } from '../auth/auth.service.js';
import { getDashboardForPatient } from '../dashboard/dashboard.service.js';

export async function getPortalForPatient(user, access) {
  const db = await readDb();
  const {
    accessControl: _accessControl,
    users: _users,
    sessions: _sessions,
    ...portalData
  } = db;
  const visibleData = filterPortalData(portalData, access);

  return {
    ...visibleData,
    currentUser: toPublicUser(user, access),
    access: {
      roles: access.roles,
      roleLabels: access.roleLabels,
      permissions: access.permissions,
      status: access.status,
    },
    dashboard: await getDashboardForPatient(user, access),
  };
}

function filterPortalData(portalData, access) {
  return {
    ...portalData,
    tasks: hasPermission(access, 'tasks.manage') ? portalData.tasks : [],
    providers: hasPermission(access, 'appointments.view') ? portalData.providers : [],
    appointmentSlots: hasPermission(access, 'appointments.view') ? portalData.appointmentSlots : [],
    appointments: hasPermission(access, 'appointments.view') ? portalData.appointments : [],
    appointmentRequests: hasPermission(access, 'appointments.view') ? portalData.appointmentRequests : [],
    medications: hasPermission(access, 'prescriptions.view') ? portalData.medications : [],
    preferredPharmacy: hasPermission(access, 'prescriptions.view') ? portalData.preferredPharmacy : emptyPharmacy(),
    prescriptions: hasPermission(access, 'prescriptions.view') ? portalData.prescriptions : [],
    refillRequests: hasPermission(access, 'prescriptions.view') ? portalData.refillRequests : [],
    medicationRequests: hasPermission(access, 'prescriptions.view') ? portalData.medicationRequests : [],
    billing: hasPermission(access, 'billing.view') ? portalData.billing : emptyBilling(),
    profileSettings: hasPermission(access, 'profile.view') ? portalData.profileSettings : emptyProfile(),
    accountStatus: hasPermission(access, 'profile.view') ? portalData.accountStatus : emptyAccountStatus(),
    insuranceDetails: hasPermission(access, 'profile.view') ? portalData.insuranceDetails : emptyInsurance(),
    emergencyContacts: hasPermission(access, 'profile.view') ? portalData.emergencyContacts : [],
    labResults: hasPermission(access, 'records.view') ? portalData.labResults : [],
    clinicalNotes: hasPermission(access, 'records.view') ? portalData.clinicalNotes : [],
    documents: hasPermission(access, 'records.view') ? portalData.documents : [],
    uploadedFiles: hasPermission(access, 'records.view') || hasPermission(access, 'messages.view') ? portalData.uploadedFiles : [],
    activityLog: portalData.activityLog || [],
    resourceInteractions: hasPermission(access, 'resources.view') ? portalData.resourceInteractions : [],
    immunizations: hasPermission(access, 'immunizations.view') ? portalData.immunizations : [],
    immunizationRecords: hasPermission(access, 'immunizations.view') ? portalData.immunizationRecords : emptyImmunizationRecords(),
    educationalResources: hasPermission(access, 'resources.view') ? portalData.educationalResources : emptyResources(),
    referrals: hasPermission(access, 'referrals.view') ? portalData.referrals : emptyReferrals(),
    familyAccess: hasPermission(access, 'family.view') ? portalData.familyAccess : emptyFamilyAccess(),
    healthTrends: hasPermission(access, 'trends.view') ? portalData.healthTrends : emptyHealthTrends(),
    messages: hasPermission(access, 'messages.view') ? portalData.messages : [],
    messageConversations: hasPermission(access, 'messages.view') ? portalData.messageConversations : [],
  };
}

function emptyBilling() {
  return {
    outstandingBalance: 0,
    paymentStatus: 'Paid',
    dueDate: '',
    breakdown: { consultation: 0, laboratory: 0, radiology: 0, pharmacy: 0 },
    paymentMethods: [],
    invoices: [],
    payments: [],
    statements: [],
    resources: [],
  };
}

function emptyPharmacy() {
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

function emptyProfile() {
  return {
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    language: '',
    timezone: '',
  };
}

function emptyAccountStatus() {
  return {
    profileCompletion: 0,
    twoFactorEnabled: false,
    lastLogin: '',
    privacyNotice: '',
  };
}

function emptyInsurance() {
  return {
    primaryProvider: '',
    memberId: '',
    groupNumber: '',
    policyHolder: '',
    activeThrough: '',
    verifiedAt: '',
  };
}

function emptyImmunizationRecords() {
  return {
    alerts: [],
    completed: [],
    compliance: {
      percent: 0,
      completed: 0,
      recommended: 0,
      detail: '',
    },
  };
}

function emptyResources() {
  return {
    featured: {
      id: '',
      category: '',
      title: '',
      detail: '',
      meta: '',
      updated: '',
      actionLabel: '',
    },
    video: {
      id: '',
      title: '',
      detail: '',
      duration: '',
      category: '',
    },
    groups: [],
    library: [],
  };
}

function emptyReferrals() {
  return {
    summary: { active: 0, pending: 0, completedYear: 0 },
    rows: [],
    focus: {
      caseId: '',
      title: '',
      note: '',
      attachment: '',
      lastUpdate: '',
      clinic: '',
      address: '',
      phone: '',
      email: '',
    },
  };
}

function emptyFamilyAccess() {
  return {
    proxies: [],
    accounts: [],
    activity: [],
  };
}

function emptyHealthTrends() {
  return {
    summary: {
      withinRange: 0,
      attentionRequired: 0,
      updates: [],
    },
    metrics: [],
    labComparison: [],
    goals: [],
  };
}
