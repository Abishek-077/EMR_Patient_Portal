export type PortalRoute =
  | 'home'
  | 'dashboard'
  | 'registration'
  | 'records'
  | 'appointments'
  | 'messages'
  | 'prescriptions'
  | 'billing'
  | 'resources'
  | 'referrals'
  | 'immunizations'
  | 'trends'
  | 'profile'
  | 'admin';

export const routePermissions: Record<PortalRoute, string> = {
  home: 'dashboard.view',
  dashboard: 'dashboard.view',
  registration: 'registration.view',
  records: 'records.view',
  appointments: 'appointments.view',
  messages: 'messages.view',
  prescriptions: 'prescriptions.view',
  billing: 'billing.view',
  resources: 'resources.view',
  referrals: 'referrals.view',
  immunizations: 'immunizations.view',
  trends: 'trends.view',
  profile: 'profile.view',
  admin: 'admin.access.view',
};

const orderedPortalRoutes: PortalRoute[] = [
  'home',
  'dashboard',
  'registration',
  'records',
  'appointments',
  'messages',
  'prescriptions',
  'billing',
  'referrals',
  'trends',
  'immunizations',
  'resources',
  'profile',
  'admin',
];

export const routePaths: Record<PortalRoute, string> = {
  home: '/home',
  dashboard: '/dashboard',
  registration: '/registration',
  records: '/records',
  appointments: '/appointments',
  messages: '/messages',
  prescriptions: '/prescriptions',
  billing: '/billing',
  referrals: '/referrals',
  trends: '/trends',
  immunizations: '/immunizations',
  resources: '/resources',
  profile: '/profile',
  admin: '/admin/access-control',
};

export function hasPermission(permissions: string[], permission: string) {
  return permissions.includes(permission) || permissionAliases(permission).some((alias) => permissions.includes(alias));
}

export function canAccessRoute(route: PortalRoute, permissions: string[]) {
  return hasPermission(permissions, routePermissions[route]);
}

export function firstAllowedRoute(permissions: string[]): PortalRoute {
  return orderedPortalRoutes.find((route) => canAccessRoute(route, permissions)) || 'dashboard';
}

export function getHashRoute(): PortalRoute {
  const route = normalizeRoute(location.hash.replace(/^#/, ''));
  return route || 'home';
}

export function routeFromPath(pathname: string): PortalRoute {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/home';
  const route = (Object.entries(routePaths).find(([, path]) => path === normalizedPath)?.[0] || '') as PortalRoute;
  return route || 'home';
}

export function pathForRoute(route: PortalRoute) {
  return routePaths[route] || '/home';
}

export function normalizeRoute(value: string): PortalRoute | null {
  const route = value.replace(/^#/, '').replace(/^\//, '') as PortalRoute | 'settings';
  if (route === 'settings') return 'profile';
  if (orderedPortalRoutes.includes(route as PortalRoute)) return route as PortalRoute;
  return null;
}

function permissionAliases(permission: string) {
  return {
    'records.view': ['records.viewOwn'],
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
    'registration.view': ['registration.viewOwn'],
    'registration.update': ['registration.updateOwn'],
    'registration.consent.sign': ['registration.consent.signOwn'],
    'profile.view': ['profile.viewOwn'],
    'profile.update': ['profile.updateOwn'],
    'profile.insurance.manage': ['profile.insurance.manageOwn'],
    'profile.emergencyContacts.manage': ['profile.emergencyContacts.manageOwn'],
    'tasks.manage': ['tasks.manageOwn'],
    'preferences.manage': ['preferences.manageOwn'],
    'referrals.view': ['referrals.viewOwn'],
    'referrals.manage': ['referrals.manageOwn'],
    'immunizations.view': ['immunizations.viewOwn'],
    'immunizations.manage': ['immunizations.manageOwn'],
    'trends.view': ['trends.viewOwn'],
    'trends.manage': ['trends.manageOwn'],
    'family.view': ['family.viewOwn'],
    'family.manage': ['family.manageOwn'],
    'notifications.manage': ['notifications.manageOwn'],
  }[permission] || [];
}
