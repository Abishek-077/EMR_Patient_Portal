export const ACCESS_STATUSES = ['Active', 'Suspended'];

export const PERMISSION_CATALOG = [
  permission('dashboard.view', 'Dashboard', 'View portal overview, summary counters, and quick actions.', 'Care Workspace'),
  permission('records.view', 'Health records', 'View clinical notes, labs, documents, and medical history.', 'Clinical Records'),
  permission('appointments.view', 'View appointments', 'See appointment schedule and visit history.', 'Appointments'),
  permission('appointments.request', 'Request appointments', 'Create new visit requests and pending appointments.', 'Appointments'),
  permission('appointments.manage', 'Manage appointments', 'Cancel and reschedule appointments.', 'Appointments'),
  permission('messages.view', 'View messages', 'Read secure message conversations.', 'Secure Messaging'),
  permission('messages.send', 'Send messages', 'Create secure messages and replies.', 'Secure Messaging'),
  permission('messages.resolve', 'Resolve messages', 'Mark conversations resolved or reopened.', 'Secure Messaging'),
  permission('prescriptions.view', 'View prescriptions', 'See active medications and preferred pharmacy.', 'Pharmacy'),
  permission('prescriptions.refill', 'Request refills', 'Request prescription refills.', 'Pharmacy'),
  permission('prescriptions.request', 'Request medication', 'Request a new medication review.', 'Pharmacy'),
  permission('prescriptions.pharmacy.manage', 'Manage pharmacy', 'Update preferred pharmacy information.', 'Pharmacy'),
  permission('billing.view', 'View billing', 'See balances, invoices, statements, and payment resources.', 'Revenue Cycle'),
  permission('billing.pay', 'Pay bills', 'Submit invoice and balance payments.', 'Revenue Cycle'),
  permission('billing.paymentMethods.manage', 'Manage payment methods', 'Add and default patient payment methods.', 'Revenue Cycle'),
  permission('profile.view', 'View profile', 'See profile, insurance, account status, and emergency contacts.', 'Account'),
  permission('profile.update', 'Update profile', 'Edit patient demographic and contact settings.', 'Account'),
  permission('profile.insurance.manage', 'Manage insurance', 'Update insurance details.', 'Account'),
  permission('profile.emergencyContacts.manage', 'Manage emergency contacts', 'Create, edit, and remove emergency contacts.', 'Account'),
  permission('tasks.manage', 'Manage tasks', 'Complete or reopen patient tasks.', 'Workflow'),
  permission('preferences.manage', 'Manage privacy preferences', 'Update patient privacy and sharing preferences.', 'Workflow'),
  permission('referrals.view', 'View referrals', 'See referral status and specialist details.', 'Care Coordination'),
  permission('referrals.manage', 'Manage referrals', 'Request and update referrals.', 'Care Coordination'),
  permission('immunizations.view', 'View immunizations', 'See vaccine records and compliance information.', 'Clinical Records'),
  permission('trends.view', 'View health trends', 'See longitudinal vitals, labs, and goals.', 'Clinical Records'),
  permission('resources.view', 'View resources', 'Access educational resources and care guidance.', 'Patient Education'),
  permission('family.view', 'View family access', 'See proxy access and account delegation.', 'Proxy Access'),
  permission('family.manage', 'Manage family access', 'Invite, update, and revoke proxy access.', 'Proxy Access'),
  permission('admin.access.view', 'View access control', 'View roles, permissions, users, and audit history.', 'Administration'),
  permission('admin.access.manage', 'Manage role permissions', 'Change role permission assignments.', 'Administration'),
  permission('admin.users.manage', 'Manage user access', 'Assign user roles and suspend or reactivate accounts.', 'Administration'),
];

export const PERMISSION_IDS = PERMISSION_CATALOG.map((item) => item.id);
export const REQUIRED_ADMIN_PERMISSIONS = ['admin.access.view', 'admin.access.manage', 'admin.users.manage'];

const allPermissions = PERMISSION_IDS;

export const DEFAULT_ROLES = [
  role('admin', 'Administrator', 'Full platform administrator with access-control, user, and audit authority.', allPermissions, true),
  role('doctor', 'Doctor', 'Clinical provider access for records, appointments, messages, prescriptions, referrals, and trends.', [
    'dashboard.view',
    'records.view',
    'appointments.view',
    'appointments.manage',
    'messages.view',
    'messages.send',
    'messages.resolve',
    'prescriptions.view',
    'prescriptions.refill',
    'prescriptions.request',
    'prescriptions.pharmacy.manage',
    'profile.view',
    'referrals.view',
    'referrals.manage',
    'immunizations.view',
    'trends.view',
    'resources.view',
    'tasks.manage',
  ], true),
  role('nurse', 'Nurse / Care Coordinator', 'Care-team workflow access for appointments, secure messaging, records, tasks, and immunizations.', [
    'dashboard.view',
    'records.view',
    'appointments.view',
    'appointments.request',
    'appointments.manage',
    'messages.view',
    'messages.send',
    'messages.resolve',
    'prescriptions.view',
    'prescriptions.refill',
    'profile.view',
    'referrals.view',
    'immunizations.view',
    'trends.view',
    'resources.view',
    'tasks.manage',
  ], true),
  role('front-desk', 'Front Desk / Scheduler', 'Scheduling and registration access without clinical record editing or billing payment authority.', [
    'dashboard.view',
    'appointments.view',
    'appointments.request',
    'appointments.manage',
    'messages.view',
    'messages.send',
    'profile.view',
    'referrals.view',
    'resources.view',
  ], true),
  role('billing-specialist', 'Billing Specialist', 'Revenue-cycle access for billing, statements, insurance, and payment support.', [
    'dashboard.view',
    'billing.view',
    'billing.pay',
    'billing.paymentMethods.manage',
    'profile.view',
    'profile.insurance.manage',
    'messages.view',
    'messages.send',
    'resources.view',
  ], true),
  role('patient', 'Patient / Normal User', 'Standard patient portal access for personal records, visits, messages, prescriptions, billing, and family access.', [
    'dashboard.view',
    'records.view',
    'appointments.view',
    'appointments.request',
    'appointments.manage',
    'messages.view',
    'messages.send',
    'messages.resolve',
    'prescriptions.view',
    'prescriptions.refill',
    'prescriptions.request',
    'prescriptions.pharmacy.manage',
    'billing.view',
    'billing.pay',
    'billing.paymentMethods.manage',
    'profile.view',
    'profile.update',
    'profile.insurance.manage',
    'profile.emergencyContacts.manage',
    'tasks.manage',
    'preferences.manage',
    'referrals.view',
    'referrals.manage',
    'immunizations.view',
    'trends.view',
    'resources.view',
    'family.view',
    'family.manage',
  ], true),
  role('proxy', 'Family Proxy / Caregiver', 'Delegated family access for care support, appointment requests, messages, billing, and education.', [
    'dashboard.view',
    'records.view',
    'appointments.view',
    'appointments.request',
    'messages.view',
    'messages.send',
    'prescriptions.view',
    'prescriptions.refill',
    'billing.view',
    'billing.pay',
    'resources.view',
    'family.view',
    'immunizations.view',
    'trends.view',
  ], true),
];

export function getDefaultAccessControl() {
  return {
    roles: structuredClone(DEFAULT_ROLES),
    auditLog: [],
  };
}

export function normalizeAccessControl(accessControl = {}) {
  const providedRoles = Array.isArray(accessControl.roles) ? accessControl.roles : [];
  const roleMap = new Map(DEFAULT_ROLES.map((item) => [item.id, structuredClone(item)]));

  for (const providedRole of providedRoles) {
    const id = normalizeRoleId(providedRole.id);
    if (!id) continue;
    const existingRole = roleMap.get(id);
    const nextRole = {
      ...(existingRole || role(id, providedRole.label || providedRole.name || id, providedRole.description || '', [], false)),
      ...providedRole,
      id,
      label: String(providedRole.label || providedRole.name || existingRole?.label || id).trim(),
      description: String(providedRole.description || existingRole?.description || '').trim(),
      permissions: Array.isArray(providedRole.permissions)
        ? normalizePermissionList(providedRole.permissions)
        : existingRole?.permissions || [],
      system: Boolean(existingRole?.system || providedRole.system),
    };

    if (id === 'admin') {
      nextRole.permissions = unique([...nextRole.permissions, ...REQUIRED_ADMIN_PERMISSIONS]);
      nextRole.system = true;
    }

    roleMap.set(id, nextRole);
  }

  return {
    roles: [...roleMap.values()],
    auditLog: Array.isArray(accessControl.auditLog) ? accessControl.auditLog.slice(-100) : [],
  };
}

export function normalizeUsers(users = [], accessControl = getDefaultAccessControl()) {
  const roleIds = new Set(accessControl.roles.map((item) => item.id));
  const normalizedUsers = users.map((user) => {
    const roles = Array.isArray(user.roles)
      ? user.roles
      : user.role
        ? [user.role]
        : [];
    const normalizedRoles = unique(roles.map(normalizeRoleId).filter((roleId) => roleIds.has(roleId)));

    return {
      ...user,
      roles: normalizedRoles.length ? normalizedRoles : ['patient'],
      status: ACCESS_STATUSES.includes(user.status) ? user.status : 'Active',
    };
  });

  if (normalizedUsers.length && !normalizedUsers.some((user) => user.roles.includes('admin'))) {
    normalizedUsers[0].roles = unique(['admin', ...normalizedUsers[0].roles]);
  }

  return normalizedUsers;
}

export function resolveUserAccess(user, accessControl = getDefaultAccessControl()) {
  const roleMap = new Map(accessControl.roles.map((item) => [item.id, item]));
  const assignedRoleIds = Array.isArray(user.roles) && user.roles.length ? user.roles : [user.role || 'patient'];
  const roles = assignedRoleIds
    .map(normalizeRoleId)
    .map((roleId) => roleMap.get(roleId))
    .filter(Boolean);
  const permissions = unique(roles.flatMap((item) => item.permissions || []));

  return {
    roles: roles.map((item) => item.id),
    roleLabels: roles.map((item) => item.label),
    permissions,
    status: ACCESS_STATUSES.includes(user.status) ? user.status : 'Active',
  };
}

export function hasPermission(access, permissionId) {
  return Boolean(access?.permissions?.includes(permissionId));
}

export function normalizePermissionList(permissions) {
  const knownPermissions = new Set(PERMISSION_IDS);
  return unique((Array.isArray(permissions) ? permissions : []).filter((item) => knownPermissions.has(item)));
}

export function normalizeRoleId(value) {
  return String(value || '').trim().toLowerCase();
}

function permission(id, label, description, group) {
  return { id, label, description, group };
}

function role(id, label, description, permissions, system) {
  return { id, label, description, permissions: unique(permissions), system };
}

function unique(values) {
  return [...new Set(values)];
}
