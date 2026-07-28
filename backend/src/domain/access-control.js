export const ACCESS_STATUSES = ['Active', 'Suspended'];

export const PERMISSION_CATALOG = [
  permission('dashboard.view', 'Dashboard', 'View portal overview, summary counters, and quick actions.', 'Care Workspace'),
  permission('notifications.manage', 'Manage notifications', 'Mark portal notifications read and update notification preferences.', 'Care Workspace'),
  permission('notifications.manageOwn', 'Manage own notifications', 'Manage only notifications for the authenticated patient.', 'Care Workspace'),
  permission('records.view', 'Health records', 'View clinical notes, labs, documents, and medical history.', 'Clinical Records'),
  permission('records.viewOwn', 'Own health records', 'View only the authenticated patient records.', 'Clinical Records'),
  permission('records.notes.manage', 'Manage patient notes', 'Create, edit, and remove patient-entered notes.', 'Clinical Records'),
  permission('records.notes.manageOwn', 'Manage own patient notes', 'Manage only notes entered for the authenticated patient.', 'Clinical Records'),
  permission('files.manage', 'Manage patient files', 'Upload, rename, download, and remove patient files.', 'Clinical Records'),
  permission('files.manageOwn', 'Manage own patient files', 'Manage only files owned by the authenticated patient.', 'Clinical Records'),
  permission('appointments.view', 'View appointments', 'See appointment schedule and visit history.', 'Appointments'),
  permission('appointments.viewOwn', 'Own appointments', 'See only the authenticated patient appointments.', 'Appointments'),
  permission('appointments.request', 'Request appointments', 'Create new visit requests and pending appointments.', 'Appointments'),
  permission('appointments.requestOwn', 'Request own appointments', 'Create appointment requests only for the authenticated patient.', 'Appointments'),
  permission('appointments.manage', 'Manage appointments', 'Cancel and reschedule appointments.', 'Appointments'),
  permission('appointments.manageOwn', 'Manage own appointments', 'Cancel and reschedule only authenticated patient appointments.', 'Appointments'),
  permission('appointments.approve', 'Approve appointment requests', 'Approve or reject patient appointment requests and reserve slots.', 'Appointments'),
  permission('messages.view', 'View messages', 'Read secure message conversations.', 'Secure Messaging'),
  permission('messages.viewOwn', 'Own messages', 'Read only the authenticated patient message conversations.', 'Secure Messaging'),
  permission('messages.send', 'Send messages', 'Create secure messages and replies.', 'Secure Messaging'),
  permission('messages.sendOwn', 'Send own messages', 'Send messages only from the authenticated patient account.', 'Secure Messaging'),
  permission('messages.resolve', 'Resolve messages', 'Mark conversations resolved or reopened.', 'Secure Messaging'),
  permission('messages.resolveOwn', 'Resolve own messages', 'Resolve only authenticated patient conversations.', 'Secure Messaging'),
  permission('prescriptions.view', 'View prescriptions', 'See active medications and preferred pharmacy.', 'Pharmacy'),
  permission('prescriptions.viewOwn', 'Own prescriptions', 'See only authenticated patient medications and pharmacy settings.', 'Pharmacy'),
  permission('prescriptions.refill', 'Request refills', 'Request prescription refills.', 'Pharmacy'),
  permission('prescriptions.requestRefillOwn', 'Request own refills', 'Request refills only for authenticated patient prescriptions.', 'Pharmacy'),
  permission('prescriptions.request', 'Request medication', 'Request a new medication review.', 'Pharmacy'),
  permission('prescriptions.requestOwn', 'Request own medication', 'Request medication review only for the authenticated patient.', 'Pharmacy'),
  permission('prescriptions.review', 'Review medication requests', 'Approve or reject refill and medication requests.', 'Pharmacy'),
  permission('prescriptions.pharmacy.manage', 'Manage pharmacy', 'Update preferred pharmacy information.', 'Pharmacy'),
  permission('prescriptions.pharmacy.manageOwn', 'Manage own pharmacy', 'Update only authenticated patient pharmacy information.', 'Pharmacy'),
  permission('billing.view', 'View billing', 'See balances, invoices, statements, and payment resources.', 'Revenue Cycle'),
  permission('billing.viewOwn', 'Own billing', 'See only authenticated patient billing data.', 'Revenue Cycle'),
  permission('billing.pay', 'Pay bills', 'Submit invoice and balance payments.', 'Revenue Cycle'),
  permission('billing.payOwn', 'Pay own bills', 'Submit payments only against authenticated patient invoices.', 'Revenue Cycle'),
  permission('billing.paymentMethods.manage', 'Manage payment methods', 'Add and default patient payment methods.', 'Revenue Cycle'),
  permission('billing.paymentMethods.manageOwn', 'Manage own payment methods', 'Manage only authenticated patient payment methods.', 'Revenue Cycle'),
  permission('billing.statements.manage', 'Generate billing statements', 'Generate patient billing statements and exports.', 'Revenue Cycle'),
  permission('billing.statements.manageOwn', 'Generate own billing statements', 'Generate statements only for the authenticated patient.', 'Revenue Cycle'),
  permission('billing.invoices.manage', 'Manage invoices', 'Create, update, and void billing invoices.', 'Revenue Cycle'),
  permission('registration.view', 'View registration', 'View patient registration and intake information.', 'Patient Intake'),
  permission('registration.viewOwn', 'Own registration', 'View only authenticated patient registration and intake information.', 'Patient Intake'),
  permission('registration.update', 'Update registration', 'Update patient demographics, insurance, and intake forms.', 'Patient Intake'),
  permission('registration.updateOwn', 'Update own registration', 'Update only authenticated patient registration and intake forms.', 'Patient Intake'),
  permission('registration.consent.sign', 'Sign consents', 'Sign registration consent documents.', 'Patient Intake'),
  permission('registration.consent.signOwn', 'Sign own consents', 'Sign only authenticated patient consent documents.', 'Patient Intake'),
  permission('profile.view', 'View profile', 'See profile, insurance, account status, and emergency contacts.', 'Account'),
  permission('profile.viewOwn', 'Own profile', 'See only authenticated patient profile data.', 'Account'),
  permission('profile.update', 'Update profile', 'Edit patient demographic and contact settings.', 'Account'),
  permission('profile.updateOwn', 'Update own profile', 'Edit only authenticated patient demographic settings.', 'Account'),
  permission('profile.insurance.manage', 'Manage insurance', 'Update insurance details.', 'Account'),
  permission('profile.insurance.manageOwn', 'Manage own insurance', 'Update only authenticated patient insurance details.', 'Account'),
  permission('profile.emergencyContacts.manage', 'Manage emergency contacts', 'Create, edit, and remove emergency contacts.', 'Account'),
  permission('profile.emergencyContacts.manageOwn', 'Manage own emergency contacts', 'Manage only authenticated patient emergency contacts.', 'Account'),
  permission('tasks.manage', 'Manage tasks', 'Complete or reopen patient tasks.', 'Workflow'),
  permission('tasks.manageOwn', 'Manage own tasks', 'Complete or reopen only authenticated patient tasks.', 'Workflow'),
  permission('preferences.manage', 'Manage privacy preferences', 'Update patient privacy and sharing preferences.', 'Workflow'),
  permission('preferences.manageOwn', 'Manage own privacy preferences', 'Update only authenticated patient privacy preferences.', 'Workflow'),
  permission('immunizations.view', 'View immunizations', 'See vaccine records and compliance information.', 'Clinical Records'),
  permission('immunizations.viewOwn', 'Own immunizations', 'See only authenticated patient immunization records.', 'Clinical Records'),
  permission('immunizations.manage', 'Manage immunizations', 'Create and maintain patient-reported immunization records.', 'Clinical Records'),
  permission('immunizations.manageOwn', 'Manage own immunizations', 'Manage only authenticated patient-reported immunization records.', 'Clinical Records'),
  permission('immunizations.verify', 'Verify immunizations', 'Verify patient-reported records and manage clinical alerts.', 'Clinical Records'),
  permission('trends.view', 'View health trends', 'See longitudinal vitals, labs, and goals.', 'Clinical Records'),
  permission('trends.viewOwn', 'Own health trends', 'See only authenticated patient trends and vitals.', 'Clinical Records'),
  permission('trends.manage', 'Manage health trends', 'Create, edit, and remove health readings and goals.', 'Clinical Records'),
  permission('trends.manageOwn', 'Manage own health trends', 'Manage only authenticated patient readings and goals.', 'Clinical Records'),
  permission('resources.view', 'View resources', 'Access educational resources and care guidance.', 'Patient Education'),
  permission('resources.interact', 'Use educational resources', 'Save, unsave, read, and download educational resources.', 'Patient Education'),
  permission('patients.context.select', 'Select patient context', 'Work within an explicitly authorized patient context.', 'Administration'),
  permission('admin.access.view', 'View access control', 'View roles, permissions, users, and audit history.', 'Administration'),
  permission('admin.access.manage', 'Manage role permissions', 'Change role permission assignments.', 'Administration'),
  permission('admin.users.manage', 'Manage user access', 'Assign user roles and suspend or reactivate accounts.', 'Administration'),
];

export const PERMISSION_IDS = PERMISSION_CATALOG.map((item) => item.id);
export const REQUIRED_ADMIN_PERMISSIONS = ['admin.access.view', 'admin.access.manage', 'admin.users.manage'];

const allPermissions = PERMISSION_IDS;

export const DEFAULT_ROLES = [
  role('admin', 'Administrator', 'Full platform administrator with access-control, user, and audit authority.', allPermissions, true),
  role('doctor', 'Doctor', 'Clinical provider access for records, appointments, messages, prescriptions, and trends.', [
    'dashboard.view',
    'notifications.manage',
    'records.view',
    'records.notes.manage',
    'files.manage',
    'appointments.view',
    'appointments.manage',
    'appointments.approve',
    'messages.view',
    'messages.send',
    'messages.resolve',
    'prescriptions.view',
    'prescriptions.refill',
    'prescriptions.request',
    'prescriptions.review',
    'prescriptions.pharmacy.manage',
    'profile.view',
    'immunizations.view',
    'immunizations.manage',
    'immunizations.verify',
    'trends.view',
    'trends.manage',
    'resources.view',
    'resources.interact',
    'tasks.manage',
    'patients.context.select',
  ], true),
  role('nurse', 'Nurse / Care Coordinator', 'Care-team workflow access for appointments, secure messaging, records, tasks, and immunizations.', [
    'dashboard.view',
    'notifications.manage',
    'records.view',
    'records.notes.manage',
    'files.manage',
    'appointments.view',
    'appointments.request',
    'appointments.manage',
    'appointments.approve',
    'messages.view',
    'messages.send',
    'messages.resolve',
    'prescriptions.view',
    'prescriptions.refill',
    'profile.view',
    'immunizations.view',
    'immunizations.manage',
    'immunizations.verify',
    'trends.view',
    'trends.manage',
    'resources.view',
    'resources.interact',
    'tasks.manage',
    'patients.context.select',
  ], true),
  role('front-desk', 'Front Desk / Scheduler', 'Scheduling and registration access without clinical record editing or billing payment authority.', [
    'dashboard.view',
    'notifications.manage',
    'appointments.view',
    'appointments.request',
    'appointments.manage',
    'appointments.approve',
    'messages.view',
    'messages.send',
    'profile.view',
    'resources.view',
    'resources.interact',
    'patients.context.select',
  ], true),
  role('billing-specialist', 'Billing Specialist', 'Revenue-cycle access for billing, statements, insurance, and payment support.', [
    'dashboard.view',
    'notifications.manage',
    'billing.view',
    'billing.pay',
    'billing.paymentMethods.manage',
    'billing.statements.manage',
    'billing.invoices.manage',
    'profile.view',
    'profile.insurance.manage',
    'messages.view',
    'messages.send',
    'resources.view',
    'resources.interact',
    'patients.context.select',
  ], true),
  role('patient', 'Patient / Normal User', 'Standard patient portal access for personal records, visits, messages, prescriptions, and billing.', [
    'dashboard.view',
    'notifications.manageOwn',
    'records.viewOwn',
    'records.notes.manageOwn',
    'files.manageOwn',
    'appointments.viewOwn',
    'appointments.requestOwn',
    'appointments.manageOwn',
    'messages.viewOwn',
    'messages.sendOwn',
    'messages.resolveOwn',
    'prescriptions.viewOwn',
    'prescriptions.requestRefillOwn',
    'prescriptions.requestOwn',
    'prescriptions.pharmacy.manageOwn',
    'billing.viewOwn',
    'billing.payOwn',
    'billing.paymentMethods.manageOwn',
    'billing.statements.manageOwn',
    'registration.viewOwn',
    'registration.updateOwn',
    'registration.consent.signOwn',
    'profile.viewOwn',
    'profile.updateOwn',
    'profile.insurance.manageOwn',
    'profile.emergencyContacts.manageOwn',
    'tasks.manageOwn',
    'preferences.manageOwn',
    'immunizations.viewOwn',
    'immunizations.manageOwn',
    'trends.viewOwn',
    'trends.manageOwn',
    'resources.view',
    'resources.interact',
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

    if (Number(providedRole.permissionVersion || 1) < 3) {
      nextRole.permissions = upgradeLegacySystemPermissions(id, nextRole.permissions);
    }
    nextRole.permissionVersion = 3;

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
      roles: normalizedRoles.length ? normalizedRoles : user.deletedAt ? [] : ['patient'],
      status: user.deletedAt ? 'Suspended' : ACCESS_STATUSES.includes(user.status) ? user.status : 'Active',
    };
  });

  return normalizedUsers;
}

export function resolveUserAccess(user, accessControl = getDefaultAccessControl()) {
  const roleMap = new Map(accessControl.roles.map((item) => [item.id, item]));
  const assignedRoleIds = Array.isArray(user.roles) ? user.roles : [user.role || 'patient'];
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
  const permissions = access?.permissions || [];
  return Boolean(permissions.includes(permissionId) || permissionAliases(permissionId).some((alias) => permissions.includes(alias)));
}

function permissionAliases(permissionId) {
  return {
    'records.view': ['records.viewOwn'],
    'notifications.manage': ['notifications.manageOwn'],
    'records.notes.manage': ['records.notes.manageOwn'],
    'files.manage': ['files.manageOwn'],
    'appointments.view': ['appointments.viewOwn'],
    'appointments.request': ['appointments.requestOwn'],
    'appointments.manage': ['appointments.manageOwn'],
    'messages.view': ['messages.viewOwn'],
    'messages.send': ['messages.sendOwn'],
    'messages.resolve': ['messages.resolveOwn'],
    'prescriptions.view': ['prescriptions.viewOwn'],
    'prescriptions.refill': ['prescriptions.requestRefillOwn'],
    'prescriptions.request': ['prescriptions.requestOwn'],
    'prescriptions.pharmacy.manage': ['prescriptions.pharmacy.manageOwn'],
    'billing.view': ['billing.viewOwn'],
    'billing.pay': ['billing.payOwn'],
    'billing.paymentMethods.manage': ['billing.paymentMethods.manageOwn'],
    'billing.statements.manage': ['billing.statements.manageOwn'],
    'registration.view': ['registration.viewOwn'],
    'registration.update': ['registration.updateOwn'],
    'registration.consent.sign': ['registration.consent.signOwn'],
    'profile.view': ['profile.viewOwn'],
    'profile.update': ['profile.updateOwn'],
    'profile.insurance.manage': ['profile.insurance.manageOwn'],
    'profile.emergencyContacts.manage': ['profile.emergencyContacts.manageOwn'],
    'tasks.manage': ['tasks.manageOwn'],
    'preferences.manage': ['preferences.manageOwn'],
    'immunizations.view': ['immunizations.viewOwn'],
    'immunizations.manage': ['immunizations.manageOwn'],
    'trends.view': ['trends.viewOwn'],
    'trends.manage': ['trends.manageOwn'],
  }[permissionId] || [];
}

function upgradeLegacySystemPermissions(roleId, permissions) {
  if (!DEFAULT_ROLES.some((role) => role.id === roleId)) return permissions;
  const upgraded = new Set(permissions);
  const copyCapability = (existingPermission, nextPermission) => {
    if (upgraded.has(existingPermission)) upgraded.add(nextPermission);
  };

  if (upgraded.has('dashboard.view')) {
    upgraded.add(roleId === 'patient' ? 'notifications.manageOwn' : 'notifications.manage');
  }

  copyCapability('records.view', 'records.notes.manage');
  copyCapability('records.view', 'files.manage');
  copyCapability('records.viewOwn', 'records.notes.manageOwn');
  copyCapability('records.viewOwn', 'files.manageOwn');
  copyCapability('immunizations.view', 'immunizations.manage');
  copyCapability('immunizations.viewOwn', 'immunizations.manageOwn');
  copyCapability('trends.view', 'trends.manage');
  copyCapability('trends.viewOwn', 'trends.manageOwn');
  copyCapability('resources.view', 'resources.interact');
  copyCapability('billing.view', 'billing.statements.manage');
  copyCapability('billing.viewOwn', 'billing.statements.manageOwn');

  if (upgraded.has('appointments.manage') && !upgraded.has('appointments.manageOwn')) upgraded.add('appointments.approve');
  if (upgraded.has('prescriptions.request') && !upgraded.has('prescriptions.requestOwn')) upgraded.add('prescriptions.review');
  if (upgraded.has('immunizations.manage') && !upgraded.has('immunizations.manageOwn')) upgraded.add('immunizations.verify');
  if ([...upgraded].some((permission) => permission.endsWith('.view') && !permission.endsWith('.viewOwn'))) {
    upgraded.add('patients.context.select');
  }
  return [...upgraded];
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
  return { id, label, description, permissions: unique(permissions), system, permissionVersion: 3 };
}

function unique(values) {
  return [...new Set(values)];
}
