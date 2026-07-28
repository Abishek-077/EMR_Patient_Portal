import { toPublicUser } from '../auth/auth.service.js';
import { env } from '../../config.js';

const NAVIGATION = [
  ['home', 'Home', 'dashboard.view'],
  ['dashboard', 'Dashboard', 'dashboard.view'],
  ['registration', 'Registration', 'registration.view'],
  ['records', 'Records', 'records.view'],
  ['appointments', 'Appointments', 'appointments.view'],
  ['messages', 'Messages', 'messages.view'],
  ['prescriptions', 'Prescriptions', 'prescriptions.view'],
  ['billing', 'Billing', 'billing.view'],
  ['resources', 'Resources', 'resources.view'],
  ['immunizations', 'Immunizations', 'immunizations.view'],
  ['trends', 'Health Trends', 'trends.view'],
  ['profile', 'Profile', 'profile.view'],
  ['admin/access-control', 'Access Control', 'admin.access.view'],
];

export async function getPortalForPatient(user, access, context = {}) {
  return {
    currentUser: toPublicUser(context.actor || user, access),
    subjectUser: publicSubject(user),
    access: {
      roles: access.roles,
      roleLabels: access.roleLabels,
      permissions: access.permissions,
      status: access.status,
    },
    patientContexts: context.patientContexts || [],
    currentPatientContext: context.currentPatientContext || null,
    navigation: NAVIGATION
      .filter(([, , permission]) => hasPermission(access.permissions, permission))
      .map(([id, label]) => ({ id, label })),
    notifications: {
      endpoint: `${env.apiBasePath}/notifications`,
      unreadCount: 0,
    },
    featureEndpoints: {
      dashboard: `${env.apiBasePath}/patient/dashboard`,
      home: `${env.apiBasePath}/patient/home`,
      registration: `${env.apiBasePath}/registration`,
      records: `${env.apiBasePath}/records`,
      appointments: `${env.apiBasePath}/appointments`,
      messages: `${env.apiBasePath}/messages/conversations`,
      prescriptions: `${env.apiBasePath}/prescriptions`,
      billing: `${env.apiBasePath}/billing`,
      profile: `${env.apiBasePath}/profile`,
      trends: `${env.apiBasePath}/trends`,
      immunizations: `${env.apiBasePath}/immunizations`,
      resources: `${env.apiBasePath}/resources`,
      files: `${env.apiBasePath}/files`,
    },
  };
}

function publicSubject(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    patientId: user.patientId || '',
  };
}

function hasPermission(permissions, permission) {
  if (permissions.includes(permission)) return true;
  const ownVariant = {
    'registration.view': 'registration.viewOwn',
    'records.view': 'records.viewOwn',
    'appointments.view': 'appointments.viewOwn',
    'messages.view': 'messages.viewOwn',
    'prescriptions.view': 'prescriptions.viewOwn',
    'billing.view': 'billing.viewOwn',
    'immunizations.view': 'immunizations.viewOwn',
    'trends.view': 'trends.viewOwn',
    'profile.view': 'profile.viewOwn',
  }[permission];
  return Boolean(ownVariant && permissions.includes(ownVariant));
}
