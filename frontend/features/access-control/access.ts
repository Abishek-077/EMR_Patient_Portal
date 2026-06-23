export type PortalRoute =
  | 'dashboard'
  | 'records'
  | 'appointments'
  | 'messages'
  | 'prescriptions'
  | 'billing'
  | 'resources'
  | 'family'
  | 'referrals'
  | 'immunizations'
  | 'trends'
  | 'settings'
  | 'admin';

export const routePermissions: Record<PortalRoute, string> = {
  dashboard: 'dashboard.view',
  records: 'records.view',
  appointments: 'appointments.view',
  messages: 'messages.view',
  prescriptions: 'prescriptions.view',
  billing: 'billing.view',
  resources: 'resources.view',
  family: 'family.view',
  referrals: 'referrals.view',
  immunizations: 'immunizations.view',
  trends: 'trends.view',
  settings: 'profile.view',
  admin: 'admin.access.view',
};

const orderedPortalRoutes: PortalRoute[] = [
  'dashboard',
  'records',
  'appointments',
  'messages',
  'prescriptions',
  'billing',
  'referrals',
  'trends',
  'immunizations',
  'resources',
  'family',
  'admin',
  'settings',
];

export function hasPermission(permissions: string[], permission: string) {
  return permissions.includes(permission);
}

export function canAccessRoute(route: PortalRoute, permissions: string[]) {
  return hasPermission(permissions, routePermissions[route]);
}

export function firstAllowedRoute(permissions: string[]): PortalRoute {
  return orderedPortalRoutes.find((route) => canAccessRoute(route, permissions)) || 'dashboard';
}

export function getHashRoute(): PortalRoute {
  const route = location.hash.replace(/^#/, '') as PortalRoute;
  return orderedPortalRoutes.includes(route) ? route : 'dashboard';
}
