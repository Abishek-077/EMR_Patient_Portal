import type { ReactNode } from 'react';
import {
  Logout,
  Notification,
  Settings,
  UserAvatar,
} from '@carbon/icons-react';
import { canAccessRoute } from '../../../access-control';
import type { PortalRoute } from '../../../access-control';
import type { PortalData } from '../../../../shared/types';
import { sidebarRouteManifests } from '../../routes';

export function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) {
  return <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

export function PortalHeader({
  route,
  onNavigate,
  onNotifications,
  onHelp,
  patientName,
  permissions,
  patientContexts = [],
  currentPatientContextId = '',
  onPatientContextChange,
}: {
  route: PortalRoute;
  onNavigate: (route: PortalRoute) => void;
  onNotifications: () => void;
  onHelp: () => void;
  patientName: string;
  permissions: string[];
  patientContexts?: NonNullable<PortalData['patientContexts']>;
  currentPatientContextId?: string;
  onPatientContextChange?: (contextId: string) => void;
}) {
  return (
    <header className="o3-header">
      <strong>OpenMRS O3</strong>
      <nav aria-label="Primary navigation">
        {canAccessRoute('dashboard', permissions) && <button className={route === 'dashboard' ? 'active' : ''} type="button" onClick={() => onNavigate('dashboard')}>Dashboard</button>}
        {canAccessRoute('records', permissions) && <button className={route === 'records' ? 'active' : ''} type="button" onClick={() => onNavigate('records')}>Records</button>}
        {canAccessRoute('messages', permissions) && <button className={route === 'messages' ? 'active' : ''} type="button" onClick={() => onNavigate('messages')}>Messages</button>}
      </nav>
      <div className="o3-header-actions">
        {patientContexts.length > 1 && onPatientContextChange && <label><span className="sr-only">Patient context</span><select aria-label="Patient context" value={currentPatientContextId} onChange={(event) => onPatientContextChange(event.target.value)}>{patientContexts.map((context) => <option key={context.id} value={context.id}>{context.label}{context.relationship ? ` - ${context.relationship}` : ''}</option>)}</select></label>}
        <IconButton label="Notifications" onClick={onNotifications}><Notification size={20} /></IconButton>
        <IconButton label="Help" onClick={onHelp}><span className="header-symbol">?</span></IconButton>
        <IconButton label="Profile" onClick={() => onNavigate('profile')}><Settings size={20} /></IconButton>
        <img src="/assets/patient-profile.png" alt={`${patientName} profile`} />
      </div>
    </header>
  );
}

export function PortalSidebar({
  route,
  onNavigate,
  onLogout,
  patient,
  permissions,
}: {
  route: PortalRoute;
  onNavigate: (route: PortalRoute) => void;
  onLogout: () => void;
  patient: PortalData['patient'];
  permissions: string[];
}) {
  const visibleMenuItems = sidebarRouteManifests.filter((item) => canAccessRoute(item.route, permissions));
  return (
    <aside className="portal-sidebar">
      <div className="sidebar-profile">
        <div className="sidebar-avatar">
          {route === 'records' || route === 'messages' ? <img src="/assets/patient-profile.png" alt="" /> : <UserAvatar size={25} />}
        </div>
        <div>
          <strong>{patient.name}</strong>
          <span>{patient.identifier}</span>
        </div>
      </div>
      <nav className="sidebar-menu" aria-label="Portal sections">
        {visibleMenuItems.map(({ label, route: itemRoute, icon: Icon }) => (
          <button
            className={itemRoute && itemRoute === route ? 'active' : ''}
            key={label}
            type="button"
            onClick={() => itemRoute && onNavigate(itemRoute)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        {canAccessRoute('admin', permissions) && <button className={route === 'admin' ? 'active' : ''} type="button" onClick={() => onNavigate('admin')}><Settings size={20} /><span>Admin Access</span></button>}
        <button type="button" onClick={onLogout}><Logout size={20} /><span>Logout</span></button>
      </div>
    </aside>
  );
}
