import {
  Calendar,
  Chat,
  Document,
  Home,
  Hospital,
  Medication,
  Money,
  Renew,
  Settings,
  UserAvatar,
} from '@carbon/icons-react';
import { routePaths, routePermissions } from '../access-control';
import type { PortalRoute } from '../access-control';

export type PortalRouteManifest = {
  label: string;
  route: PortalRoute;
  path: string;
  requiredPermission: string;
  sidebar: boolean;
  icon: typeof Home;
};

export const portalRouteManifests: PortalRouteManifest[] = [
  manifest('Home', 'home', Home),
  manifest('Dashboard', 'dashboard', Home),
  manifest('Registration', 'registration', UserAvatar),
  manifest('Health Records', 'records', Document),
  manifest('Appointments', 'appointments', Calendar),
  manifest('Messages', 'messages', Chat),
  manifest('Prescriptions', 'prescriptions', Medication),
  manifest('Billing', 'billing', Money),
  manifest('Family Access', 'family', UserAvatar),
  manifest('Referrals', 'referrals', UserAvatar),
  manifest('Health Trends', 'trends', Renew),
  manifest('Immunizations', 'immunizations', Hospital),
  manifest('Resources', 'resources', Document),
  manifest('Profile', 'profile', UserAvatar),
  manifest('Admin Access', 'admin', Settings, false),
];

export const sidebarRouteManifests = portalRouteManifests.filter((route) => route.sidebar);

function manifest(label: string, route: PortalRoute, icon: typeof Home, sidebar = true): PortalRouteManifest {
  return {
    label,
    route,
    path: routePaths[route],
    requiredPermission: routePermissions[route],
    sidebar,
    icon,
  };
}
