import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  ComposedModal,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  TextArea,
  TextInput,
} from '@carbon/react';
import {
  Add,
  Attachment,
  Building,
  Calendar,
  Chat,
  CheckmarkOutline,
  Document,
  Download,
  Edit,
  Filter,
  Home,
  Hospital,
  Information,
  Launch,
  Location,
  Logout,
  Medication,
  Money,
  Notification,
  OverflowMenuVertical,
  Printer,
  QrCode,
  Renew,
  Report,
  Search,
  Send,
  Security,
  Settings,
  TaskComplete,
  TestTool,
  TrashCan,
  UserProfile,
  UserAvatar,
  Wallet,
} from '@carbon/icons-react';
import {
  addDependent,
  addBillingPaymentMethod,
  addEmergencyContact,
  addPatientNote,
  cancelAppointment,
  createVisitRequest,
  checkDrugInteractions,
  createPaymentSession,
  deleteEmergencyContact,
  getAccessPolicy,
  getAccessControlOverview,
  getAppointmentDetail,
  getAppointmentsExport,
  getBillingStatement,
  getBillingResource,
  getDocumentDetail,
  getImmunizationDetail,
  getInvoiceDetail,
  getLabDetail,
  getMedicationLeaflet,
  getPrintableRecord,
  getPrintableImmunizations,
  getPrintablePrescriptions,
  getReferralExport,
  getReferralDetail,
  getResourceDetail,
  getTrendsExport,
  getPortalData,
  inviteProxy,
  payFullBalance,
  payInvoice,
  recordResourceInteraction,
  reportUnauthorizedAccess,
  requestReferral,
  requestNewMedication,
  requestPrescriptionRefill,
  resendProxyInvite,
  rescheduleAppointment,
  revokeProxy,
  saveProfileSettings,
  scheduleAppointment,
  resolveConversation,
  sendConversationAttachment,
  sendConversationMessage,
  sendMessage,
  updateEmergencyContact,
  updateFamilyPrivacy,
  updateInsuranceDetails,
  updatePreferredPharmacy,
  updateProxyPermissions,
  updateReferralAction,
  updateRolePermissions,
  updateUserAccess,
  uploadFileMetadata,
} from '../../shared/api/api';
import {
  canAccessRoute,
  firstAllowedRoute,
  getHashRoute,
  hasPermission,
} from '../access-control';
import type { PortalRoute } from '../access-control';
import type {
  AccessControlOverview,
  AccessRole,
  AccessStatus,
  Appointment,
  BillingData,
  BillingPaymentMethod,
  BillingPaymentMethodInput,
  DashboardActivity,
  EmergencyContact,
  LabResult,
  MessageConversation,
  PortalData,
  PreferredPharmacy,
  Prescription,
  ProfileSettings,
} from '../../shared/types';

const initialVisitForm = {
  service: 'Cardiology follow-up',
  department: 'Cardiology',
  provider: 'Dr. Michael Chen',
  date: 'Nov 08, 2023',
  time: '10:30 AM',
  location: 'Main Clinic, Suite 402',
  reason: 'Annual physical',
  preferredDate: 'Nov 08, 2023',
  notes: '',
};

const initialMessageForm = {
  subject: 'Question for Dr. Wilson',
  body: '',
};

const menuItems = [
  { label: 'Dashboard', route: 'dashboard' as const, icon: Home },
  { label: 'Health Records', route: 'records' as const, icon: Document },
  { label: 'Appointments', route: 'appointments' as const, icon: Calendar },
  { label: 'Messages', route: 'messages' as const, icon: Chat },
  { label: 'Prescriptions', route: 'prescriptions' as const, icon: Medication },
  { label: 'Billing', route: 'billing' as const, icon: Money },
  { label: 'Referrals', route: 'referrals' as const, icon: UserAvatar },
  { label: 'Health Trends', route: 'trends' as const, icon: Renew },
  { label: 'Immunizations', route: 'immunizations' as const, icon: Hospital },
  { label: 'Resources', route: 'resources' as const, icon: Document },
  { label: 'Family Access', route: 'family' as const, icon: UserAvatar },
];

function labKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function openPrintableView(title: string, payload: unknown) {
  const printable = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  const escapedBody = body.replace(/[<>&]/g, (char) => {
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    return '&amp;';
  });
  if (!printable) return false;
  printable.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: IBM Plex Sans, Arial, sans-serif; margin: 32px; color: #161616; }
          h1 { font-size: 24px; font-weight: 600; }
          pre { white-space: pre-wrap; border: 1px solid #e0e0e0; padding: 16px; background: #f4f4f4; }
        </style>
      </head>
      <body><h1>${title}</h1><pre>${escapedBody}</pre></body>
    </html>
  `);
  printable.document.close();
  printable.focus();
  printable.print();
  return true;
}

function defaultPharmacyForm(pharmacy: PreferredPharmacy) {
  return {
    name: pharmacy.name,
    addressLine1: pharmacy.addressLine1,
    addressLine2: pharmacy.addressLine2,
    phone: pharmacy.phone,
    hours: pharmacy.hours,
  };
}

const emptyEmergencyContact: Omit<EmergencyContact, 'id'> = {
  name: '',
  relationship: '',
  primaryPhone: '',
  alternatePhone: '',
  access: 'Emergency Only',
};


function labStatus(lab: LabResult) {
  if (lab.tone === 'good') return 'NORMAL';
  return /vitamin|low/i.test(lab.label) ? 'LOW' : 'HIGH';
}

function labTone(lab: LabResult) {
  const status = labStatus(lab);
  if (status === 'LOW') return 'low';
  if (status === 'HIGH') return 'high';
  return 'normal';
}

function labValue(lab: LabResult) {
  return `${lab.value} ${lab.unit}`.trim();
}

function appointmentDateParts(date: string) {
  const [month = 'TBD', day = ''] = date.replace(',', '').split(/\s+/);
  return {
    month: month.slice(0, 3).toUpperCase(),
    day: day || '--',
  };
}

function activityPresentation(activity: DashboardActivity) {
  if (activity.tone === 'success') return { icon: TaskComplete, tone: 'green' };
  if (activity.tone === 'message') return { icon: Chat, tone: 'purple' };
  return { icon: Document, tone: 'blue' };
}

function quickActionIcon(target: PortalRoute) {
  if (target === 'messages') return Chat;
  if (target === 'prescriptions') return Medication;
  return Document;
}

function portalSyncLabel() {
  return '2 mins ago';
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick: () => void }) {
  return <button className="icon-button" type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function PortalHeader({
  route,
  onNavigate,
  onNotifications,
  onHelp,
  patientName,
  permissions,
}: {
  route: PortalRoute;
  onNavigate: (route: PortalRoute) => void;
  onNotifications: () => void;
  onHelp: () => void;
  patientName: string;
  permissions: string[];
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
        <IconButton label="Notifications" onClick={onNotifications}><Notification size={20} /></IconButton>
        <IconButton label="Help" onClick={onHelp}><span className="header-symbol">?</span></IconButton>
        <IconButton label="Settings" onClick={() => onNavigate('settings')}><Settings size={20} /></IconButton>
        <img src="/assets/patient-profile.png" alt={`${patientName} profile`} />
      </div>
    </header>
  );
}

function PortalSidebar({
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
  const visibleMenuItems = menuItems.filter((item) => canAccessRoute(item.route, permissions));
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
        {canAccessRoute('settings', permissions) && <button className={route === 'settings' ? 'active' : ''} type="button" onClick={() => onNavigate('settings')}><Settings size={20} /><span>Settings</span></button>}
        <button type="button" onClick={onLogout}><Logout size={20} /><span>Logout</span></button>
      </div>
    </aside>
  );
}

function Dashboard({
  portal,
  onBook,
  onNavigate,
  onPrintRecord,
  canBook,
}: {
  portal: PortalData;
  onBook: () => void;
  onNavigate: (route: PortalRoute) => void;
  onPrintRecord: () => Promise<void>;
  canBook: boolean;
}) {
  const { dashboard } = portal;
  const upcomingAppointments = dashboard.upcomingAppointments.slice(0, 2);

  return (
    <main className="portal-main dashboard-page">
      <section className="page-title dashboard-title">
        <div>
          <h1>Welcome back, {dashboard.summary.welcomeName}</h1>
          <p>Your health overview for {dashboard.summary.overviewDate}</p>
        </div>
        <div className="page-actions">
          <button className="secondary-action" type="button" onClick={() => void onPrintRecord()}><Download size={16} /> Print Record</button>
          {canBook && <button className="primary-action" type="button" onClick={onBook}><Add size={16} /> New Request</button>}
        </div>
      </section>

      <section className="quick-grid" aria-label="Quick actions">
        {dashboard.quickActions.map((action) => {
          const Icon = quickActionIcon(action.target);
          const className = [
            'quick-card',
            action.priority === 'primary' ? 'quick-card--blue' : '',
            action.priority === 'neutral' ? 'quick-card--gray' : '',
          ].filter(Boolean).join(' ');
          return (
            <button className={className} key={action.id} type="button" onClick={() => onNavigate(action.target)}>
              <Icon size={29} />
              <strong>{action.label}</strong>
              <span>{action.detail}</span>
            </button>
          );
        })}
      </section>

      <div className="dashboard-content">
        <section className="o3-panel labs-panel">
          <div className="panel-heading">
            <h2><TestTool size={22} /> Latest Lab Results</h2>
            <button type="button" onClick={() => onNavigate('records')}>View all results</button>
          </div>
          <table className="lab-table">
            <thead>
              <tr><th>Test Name</th><th>Result</th><th>Reference Range</th><th>Status</th></tr>
            </thead>
            <tbody>
              {dashboard.latestLabResults.map((lab) => (
                <tr key={lab.label}>
                  <td>{lab.label}</td>
                  <td className={labTone(lab) === 'high' ? 'result-high' : ''}><strong>{labValue(lab)}</strong></td>
                  <td><small>{lab.range}</small></td>
                  <td><span className={`status-pill status-pill--${labTone(lab)}`}>{labStatus(lab)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="o3-panel appointment-panel">
          <div className="panel-heading">
            <h2><Calendar size={22} /> Appointments</h2>
          </div>
          <div className="appointment-list">
            {upcomingAppointments.map((appointment, index) => {
              const dateParts = appointmentDateParts(appointment.date);
              return (
                <article className={`appointment-card appointment-card--${index === 0 ? 'blue' : 'gray'}`} key={appointment.id}>
                  <time><strong>{dateParts.day}</strong><span>{dateParts.month}</span></time>
                  <div>
                    <h3>{appointment.service}</h3>
                    <p>{appointment.provider || appointment.clinician}</p>
            <button className="link-button" type="button" onClick={() => onNavigate('appointments')}>{appointment.time || 'Time pending'} - {appointment.location || 'Location pending'}</button>
                  </div>
                </article>
              );
            })}
            {!upcomingAppointments.length && <p className="empty-appointments">No upcoming appointments scheduled.</p>}
          </div>
          {canBook && <button className="wide-secondary" type="button" onClick={onBook}>Schedule New Appointment</button>}
        </section>

        <section className="o3-panel activity-panel">
          <div className="panel-heading"><h2><Renew size={22} /> Recent Activity</h2></div>
          <div className="activity-list">
            {dashboard.recentActivity.map((item) => {
              const { icon: Icon, tone } = activityPresentation(item);
              return (
                <article className="activity-row" key={item.id}>
                  <span className={`activity-icon activity-icon--${tone}`}><Icon size={18} /></span>
                  <div>
                    <p><strong>{item.title}:</strong> {item.detail}</p>
                    <small>{item.occurredAt}</small>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="vitals-grid" aria-label="Recent vital signs">
          {dashboard.vitals.map((vital) => (
            <article className="vital-card" key={vital.id}>
              <span>{vital.label}</span>
              <strong>{vital.value}{vital.unit && <small> {vital.unit}</small>}</strong>
              {vital.progress !== null ? (
                <>
                  <i><b style={{ width: `${vital.progress}%` }} /></i>
                  <em>{vital.status}</em>
                </>
              ) : <p>{vital.status}</p>}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

const trendChartSeries = {
  bloodPressure: {
    label: 'Blood Pressure',
    aria: 'Stable blood pressure trend chart',
    points: [[35, 145], [145, 132], [255, 141], [365, 114], [475, 122], [585, 96]] as Array<[number, number]>,
    summary: 'Last Reading: 120/80 mmHg',
    detail: 'Stable Trend - Oct 14, 2023',
  },
  weight: {
    label: 'Weight',
    aria: 'Weight trend chart',
    points: [[35, 128], [145, 124], [255, 118], [365, 112], [475, 105], [585, 101]] as Array<[number, number]>,
    summary: 'Last Reading: 183 lb',
    detail: 'Down 4 lb - Oct 14, 2023',
  },
  glucose: {
    label: 'Glucose',
    aria: 'Glucose trend chart',
    points: [[35, 124], [145, 139], [255, 116], [365, 130], [475, 103], [585, 98]] as Array<[number, number]>,
    summary: 'Last Reading: 104 mg/dL',
    detail: 'Improving - Oct 14, 2023',
  },
};

type TrendChartKey = keyof typeof trendChartSeries;

function TrendChart() {
  const [activeMetric, setActiveMetric] = useState<TrendChartKey>('bloodPressure');
  const metric = trendChartSeries[activeMetric];
  return (
    <div className="trend-chart" aria-label={`${metric.label} trend`}>
      <div className="chart-tabs">
        {(Object.keys(trendChartSeries) as TrendChartKey[]).map((key) => (
          <button className={activeMetric === key ? 'active' : ''} type="button" key={key} onClick={() => setActiveMetric(key)}>
            {trendChartSeries[key].label}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 640 220" role="img" aria-label={metric.aria}>
        <polyline points={metric.points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#0f62fe" strokeWidth="4" />
        {metric.points.map(([cx, cy]) => <circle cx={cx} cy={cy} fill="#0f62fe" key={`${cx}-${cy}`} r="6" />)}
      </svg>
      <div className="trend-tooltip">
        <strong>{metric.summary}</strong>
        <span>{metric.detail}</span>
      </div>
    </div>
  );
}

function RecordsPage({
  portal,
  onBookConsult,
  onAddNote,
  onExport,
  onUpload,
  onLabDetail,
  onDocumentDetail,
}: {
  portal: PortalData;
  onBookConsult: (reason: string) => void;
  onAddNote: (input: { title: string; text: string; type?: string }) => Promise<void>;
  onExport: () => Promise<void>;
  onUpload: (category: string) => Promise<void>;
  onLabDetail: (lab: LabResult) => Promise<void>;
  onDocumentDetail: (documentId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [selectedLab, setSelectedLab] = useState(portal.labResults[0]?.label || '');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const warningLabs = portal.labResults.filter((lab) => lab.tone === 'warning');
  const latestDocument = portal.documents[0];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleLabs = portal.labResults.filter((lab) => !normalizedQuery || [lab.label, lab.range, lab.unit].some((value) => value.toLowerCase().includes(normalizedQuery)));
  const visibleNotes = portal.clinicalNotes.filter((note) => !normalizedQuery || [note.title, note.type, note.text].some((value) => value.toLowerCase().includes(normalizedQuery)));
  const detailLab = portal.labResults.find((lab) => lab.label === selectedLab) || portal.labResults[0];

  const saveNote = async () => {
    if (!noteTitle.trim() || !noteText.trim()) return;
    setSavingNote(true);
    try {
      await onAddNote({ title: noteTitle, text: noteText });
      setNoteOpen(false);
      setNoteTitle('');
      setNoteText('');
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <main className="portal-main records-page">
      <section className="records-title">
        <div>
          <h1>Health Records</h1>
          <p>Comprehensive clinical summary including longitudinal vital trends, laboratory results, and documented patient history.</p>
        </div>
        <div className="page-actions">
          <button className="secondary-action" type="button" onClick={onExport}><Download size={16} /> Export PDF</button>
          <button className="secondary-action" type="button" onClick={() => onUpload('Health records upload')}><Attachment size={16} /> Upload File</button>
          <button className="primary-action" type="button" onClick={() => setNoteOpen(true)}><Add size={16} /> Add Note</button>
        </div>
      </section>
      <label className="record-search">
        <Search size={18} />
        <input aria-label="Search health records" placeholder="Search labs, notes, documents..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>

      <div className="records-grid">
        <section className="records-trends">
          <h2><Renew size={22} /> Health Trends</h2>
          <TrendChart />
        </section>
        <aside className="observations-panel">
          <h2>Critical Observations</h2>
          {warningLabs.length ? warningLabs.map((lab) => (
            <article className={`observation observation--${labStatus(lab) === 'LOW' ? 'yellow' : 'red'}`} key={lab.label}>
              <strong>{labStatus(lab) === 'LOW' ? 'Low' : 'High'} {lab.label}</strong>
              <span>Latest result: {labValue(lab)}. Reference range: {lab.range}.</span>
            </article>
          )) : <article className="observation observation--yellow"><strong>No critical observations</strong><span>Your latest labs are within the visible reference ranges.</span></article>}
          <div className="records-sync">
            <span>Last Update</span>
            <strong>{latestDocument?.updated || 'Updated today'}</strong>
            <button type="button" onClick={() => latestDocument && void onDocumentDetail(latestDocument.id)}>{latestDocument ? `${latestDocument.name} - ${latestDocument.status}` : 'Syncing with Central Registry...'}</button>
          </div>
        </aside>

        <section className="clinical-notes">
          <div className="records-subheading"><h2>Clinical Notes</h2><button type="button" onClick={() => setQuery('')}>View All History</button></div>
          {visibleNotes.map((note) => (
            <article className="note-card" key={note.id}>
              <div><span>{note.type}</span><time>{note.date}</time></div>
              <h3>{note.title}</h3>
              <p>{note.text}</p>
            </article>
          ))}
          {!visibleNotes.length && <p className="empty-appointments">No clinical notes match your search.</p>}
        </section>

        <section className="record-labs">
          <div className="records-subheading"><h2>Laboratory Results</h2><span><Filter size={16} /> {visibleLabs.length} visible</span></div>
          <table>
            <thead><tr><th>Test Name</th><th>Result</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {visibleLabs.map((lab, index) => (
                <tr className={detailLab?.label === lab.label ? 'selected-row' : ''} key={lab.label} onClick={() => setSelectedLab(lab.label)}>
                  <td>{lab.label}<small>{index === 0 ? 'Panel Analysis' : 'Laboratory Result'}</small></td>
                  <td className={labTone(lab) === 'high' ? 'result-high' : ''}><strong>{labValue(lab)}</strong></td>
                  <td><span className={`status-pill status-pill--${labTone(lab)}`}>{labStatus(lab)}</span></td>
                  <td>{portal.documents[index]?.updated || latestDocument?.updated || 'Latest'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {detailLab && (
          <aside className="lab-detail-panel">
            <h2><TestTool size={20} /> Detail View: {detailLab.label}</h2>
            <strong>{labValue(detailLab)}</strong>
            <span>Reference range: {detailLab.range}</span>
            <p>{detailLab.tone === 'warning' ? 'This result is outside the visible target range. You can book a clinical consult from this panel.' : 'This result is within the visible target range.'}</p>
            <button className="secondary-action" type="button" onClick={() => void onLabDetail(detailLab)}>View Full Lab Narrative</button>
            <button className="primary-action" type="button" onClick={() => onBookConsult(`Consult about ${detailLab.label}`)}>Book Consult</button>
          </aside>
        )}

        <section className="immunization-panel">
          <h2>Immunization History</h2>
          <div className="immunization-grid">
            {portal.immunizations.map((item) => (
              <article className="immunization-card" key={item.id}>
                <div><span><Medication size={22} /></span><small>{item.doses}</small></div>
                <strong>{item.title}</strong>
                <p>{item.last}</p>
                <i><b className={`bar--${item.tone}`} style={{ width: item.tone === 'green' ? '100%' : '72%' }} /></i>
                <em className={`text--${item.tone}`}>{item.status}</em>
              </article>
            ))}
            <button className="log-immunization" type="button" onClick={() => onUpload('Immunization record')}><Add size={22} /> Log New Immunization</button>
          </div>
        </section>
      </div>
      <button className="floating-add" aria-label="Add record" title="Add record" type="button" onClick={() => setNoteOpen(true)}><Add size={27} /></button>

      <ComposedModal open={noteOpen} onClose={() => setNoteOpen(false)} size="sm">
        <ModalHeader title="Add patient note" />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="patient-note-title" labelText="Note title" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
            <TextArea id="patient-note-text" labelText="Note" value={noteText} onChange={(event) => setNoteText(event.target.value)} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setNoteOpen(false)}>Cancel</Button>
          <Button disabled={!noteTitle.trim() || !noteText.trim() || savingNote} onClick={saveNote}>{savingNote ? 'Saving...' : 'Save note'}</Button>
        </ModalFooter>
      </ComposedModal>
    </main>
  );
}

function MessagesPageLive({
  conversations,
  onSend,
  onAttach,
  onResolve,
  onCompose,
  onMoreActions,
  canSend,
  canResolve,
}: {
  conversations: MessageConversation[];
  onSend: (conversationId: string, body: string) => Promise<void>;
  onAttach: (conversationId: string) => Promise<void>;
  onResolve: (conversationId: string, resolved: boolean) => Promise<void>;
  onCompose: () => void;
  onMoreActions: (conversation: MessageConversation) => void;
  canSend: boolean;
  canResolve: boolean;
}) {
  const [selectedConversationId, setSelectedConversationId] = useState(conversations[0]?.id || '');
  const [conversationSearch, setConversationSearch] = useState('');
  const [reply, setReply] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    if (!conversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(conversations[0]?.id || '');
    }
  }, [conversations, selectedConversationId]);

  const visibleConversations = conversations.filter((conversation) => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return true;
    return [conversation.participantName, conversation.subject, conversation.preview].some((value) => value.toLowerCase().includes(query));
  });
  const activeConversation = conversations.find((conversation) => conversation.id === selectedConversationId) || conversations[0];

  const handleSend = async () => {
    if (!activeConversation) return;
    const message = reply.trim();
    if (!message) return;
    setIsSending(true);
    setSendError('');
    try {
      await onSend(activeConversation.id, message);
      setReply('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleResolve = async () => {
    if (!activeConversation) return;
    setIsResolving(true);
    setSendError('');
    try {
      await onResolve(activeConversation.id, !activeConversation.resolved);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not update conversation');
    } finally {
      setIsResolving(false);
    }
  };

  const handleAttach = async () => {
    if (!activeConversation) return;
    setIsSending(true);
    setSendError('');
    try {
      await onAttach(activeConversation.id);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not attach file metadata');
    } finally {
      setIsSending(false);
    }
  };

  const insertComposerText = (snippet: string) => {
    setReply((current) => `${current}${current && !current.endsWith('\n') ? '\n' : ''}${snippet}`);
  };

  if (!activeConversation) {
    return (
      <main className="messages-page">
        <section className="conversation-pane">
          <div className="conversation-tools">
            <div><h1>Messages</h1>{canSend && <IconButton label="Compose message" onClick={onCompose}><Edit size={25} /></IconButton>}</div>
          </div>
        </section>
        <section className="message-thread"><p className="empty-appointments">No secure messages yet.</p></section>
      </main>
    );
  }

  return (
    <main className="messages-page">
      <section className="conversation-pane">
        <div className="conversation-tools">
          <div><h1>Messages</h1>{canSend && <IconButton label="Compose message" onClick={onCompose}><Edit size={25} /></IconButton>}</div>
          <label><input aria-label="Search conversations" placeholder="Search conversations..." value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} /><Search size={23} /></label>
        </div>
        <div className="conversation-list">
          {visibleConversations.map((conversation) => (
            <button className={`conversation-row ${conversation.id === activeConversation.id ? 'active' : ''}`} key={conversation.id} type="button" onClick={() => setSelectedConversationId(conversation.id)}>
              <span><strong>{conversation.participantName}</strong>{conversation.unread && <i />}</span>
              <time>{conversation.time}</time>
              <b>{conversation.subject}</b>
              <small>{conversation.preview}</small>
            </button>
          ))}
          {!visibleConversations.length && <p className="empty-appointments">No conversations match this search.</p>}
        </div>
      </section>

      <section className="message-thread">
        <header className="thread-heading">
          <img src="/assets/clinician-sarah-jenkins.png" alt={activeConversation.participantName} />
          <div>
            <h2>{activeConversation.participantName}</h2>
            <p><i /> {activeConversation.participantRole} - {activeConversation.activeNow ? 'Active Now' : activeConversation.resolved ? 'Resolved' : 'Secure Thread'}</p>
          </div>
          {canResolve && <button className="secondary-action" type="button" disabled={isResolving} onClick={handleResolve}>
            {isResolving ? 'Updating...' : activeConversation.resolved ? 'Reopen Thread' : 'Mark as Resolved'}
          </button>}
          <IconButton label="More conversation actions" onClick={() => onMoreActions(activeConversation)}><OverflowMenuVertical size={22} /></IconButton>
        </header>
        <div className="thread-body">
          <time className="thread-date">Monday, October 14, 2024</time>
          {activeConversation.messages.map((message) => (
            message.direction === 'outbound' ? (
              <article className="outbound-bubble" key={message.id}>
                {message.body.split('\n').filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                <time>{message.sentAtLabel} <span>{message.read ? 'Read' : 'Sent'}</span></time>
              </article>
            ) : (
              <article className="inbound-bubble" key={message.id}>
                {message.labReference && <div className="lab-reference"><strong>{message.labReference.label}</strong><span>{message.labReference.name} <b>{message.labReference.value}</b></span></div>}
                {message.body.split('\n').filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {message.attachment && (
                  <button className="message-attachment" type="button" onClick={() => openPrintableView('Message Attachment', message.attachment)}>
                    <Document size={24} />
                    <span>{message.attachment.fileName}<small>{message.attachment.size}</small></span>
                    <Download size={22} />
                  </button>
                )}
                <time>{message.sentAtLabel}</time>
              </article>
            )
          ))}
        </div>
        {canSend && <div className="thread-composer">
          <div className="composer-tools">
            <button className="format-bold" type="button" onClick={() => insertComposerText('**bold text**')}>B</button>
            <button className="format-italic" type="button" onClick={() => insertComposerText('_italic text_')}>I</button>
            <button className="format-list" type="button" onClick={() => insertComposerText('- list item')}>List</button>
            <IconButton label="Attach file" onClick={handleAttach}><Attachment size={20} /></IconButton>
          </div>
          <textarea aria-label="Message reply" placeholder="Type a secure message..." value={reply} onChange={(event) => setReply(event.target.value)} />
          <div className="composer-footer">
            {sendError ? <span className="composer-error">{sendError}</span> : <span>Secure message to {activeConversation.participantName}</span>}
            <button className="primary-action" type="button" disabled={isSending || !reply.trim()} onClick={handleSend}>
              {isSending ? 'Sending...' : 'Send'} <Send size={20} />
            </button>
          </div>
        </div>}
      </section>
    </main>
  );
}

function AppointmentsPageLive({
  appointments,
  appointmentRequests,
  onBook,
  onCancel,
  onReschedule,
  onDetail,
  onExport,
  onSupport,
  canRequest,
  canManage,
}: {
  appointments: Appointment[];
  appointmentRequests: PortalData['appointmentRequests'];
  onBook: () => void;
  onCancel: (appointmentId: string) => Promise<void>;
  onReschedule: (appointmentId: string) => Promise<void>;
  onDetail: (appointmentId: string) => Promise<void>;
  onExport: (status: 'upcoming' | 'past' | 'cancelled', provider: string) => Promise<void>;
  onSupport: () => void;
  canRequest: boolean;
  canManage: boolean;
}) {
  const [tab, setTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [providerFilter, setProviderFilter] = useState('');
  const [pendingAppointmentId, setPendingAppointmentId] = useState('');
  const [appointmentError, setAppointmentError] = useState('');
  const visibleRows = appointments
    .filter((appointment) => appointmentTab(appointment) === tab)
    .filter((appointment) => (appointment.provider || appointment.clinician).toLowerCase().includes(providerFilter.trim().toLowerCase()));
  const upcomingRows = appointments.filter((appointment) => appointmentTab(appointment) === 'upcoming');
  const pastRows = appointments.filter((appointment) => appointmentTab(appointment) === 'past');
  const cancelledRows = appointments.filter((appointment) => appointmentTab(appointment) === 'cancelled');
  const nextVisit = upcomingRows[0];
  const lastVisit = pastRows[0];

  const runAppointmentAction = async (appointment: Appointment) => {
    setPendingAppointmentId(appointment.id);
    setAppointmentError('');
    try {
      if ((appointment.secondaryAction || 'Cancel') === 'Reschedule') {
        await onReschedule(appointment.id);
      } else {
        await onCancel(appointment.id);
      }
    } catch (error) {
      setAppointmentError(error instanceof Error ? error.message : 'Could not update appointment');
    } finally {
      setPendingAppointmentId('');
    }
  };

  return (
    <main className="portal-main appointments-page">
      <section className="appointments-title">
        <div>
          <p>Patient Portal <span>/</span> Appointments</p>
          <h1>Appointments Management <b>{upcomingRows.length} Upcoming</b></h1>
        </div>
        {canRequest && <button className="primary-action" type="button" onClick={onBook}><Add size={18} /> Schedule New Appointment</button>}
      </section>

      <section className="appointments-summary">
        <article><span>Next Visit</span><strong>{nextVisit ? `${nextVisit.date}, ${nextVisit.time || 'Time pending'}` : 'No upcoming visits'}</strong><p>{nextVisit ? `${nextVisit.provider || nextVisit.clinician} - ${nextVisit.department || nextVisit.type}` : 'Schedule a new appointment'}</p></article>
        <article><span>Pending Requests</span><strong>{appointmentRequests.length} Request{appointmentRequests.length === 1 ? '' : 's'}</strong><p>{appointmentRequests[0] ? `${appointmentRequests[0].reason} - Awaiting approval` : 'No pending requests'}</p></article>
        <article><span>Last Visit</span><strong>{lastVisit?.date || 'No prior visits'}</strong><p>{lastVisit ? `${lastVisit.service} - ${lastVisit.department || lastVisit.type}` : 'Clinical history unavailable'}</p></article>
        <article><span>Fast Actions</span><div><button type="button" disabled={!canManage || !nextVisit || pendingAppointmentId === nextVisit.id} onClick={() => nextVisit && onReschedule(nextVisit.id)}>Reschedule</button><button type="button" disabled={!canManage || !nextVisit || pendingAppointmentId === nextVisit.id} onClick={() => nextVisit && onCancel(nextVisit.id)}>Cancel</button></div></article>
      </section>

      <section className="appointments-table-panel">
        <div className="appointments-table-tools">
          <nav aria-label="Appointment status">
            <button className={tab === 'upcoming' ? 'active' : ''} type="button" onClick={() => setTab('upcoming')}>Upcoming</button>
            <button className={tab === 'past' ? 'active' : ''} type="button" onClick={() => setTab('past')}>Past Visits</button>
            <button className={tab === 'cancelled' ? 'active' : ''} type="button" onClick={() => setTab('cancelled')}>Cancelled</button>
          </nav>
          <label><input aria-label="Filter by provider" placeholder="Filter by provider..." value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} /><Filter size={18} /></label>
          <IconButton label="Download appointments" onClick={() => void onExport(tab, providerFilter)}><Download size={21} /></IconButton>
        </div>
        <div className="appointments-table-wrap">
          <table>
            <thead><tr><th>Date & Time</th><th>Provider</th><th>Department</th><th>Location</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleRows.map((appointment) => (
                <tr key={appointment.id}>
                  <td><strong>{appointment.date}</strong><span>{appointment.time || 'Time pending'}</span></td>
                  <td><i>{appointment.initials || appointmentInitials(appointment.provider || appointment.clinician)}</i> {appointment.provider || appointment.clinician}</td>
                  <td><b>{appointment.department || appointment.type}</b></td>
                  <td><Location size={17} /> {appointment.location || 'Location pending'}</td>
                  <td><button type="button" onClick={() => void onDetail(appointment.id)}>{appointment.action || 'Details'}</button>{canManage && <><em /> <button type="button" disabled={pendingAppointmentId === appointment.id} onClick={() => runAppointmentAction(appointment)}>{pendingAppointmentId === appointment.id ? 'Updating...' : appointment.secondaryAction || 'Cancel'}</button></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleRows.length && <p className="empty-appointments">No {tab} appointments match this view.</p>}
        </div>
        <footer><span>{appointmentError || `Showing ${visibleRows.length ? `1 - ${visibleRows.length}` : '0'} of ${tab === 'upcoming' ? upcomingRows.length : tab === 'past' ? pastRows.length : cancelledRows.length} appointments`}</span><span>Items per page: 10 &nbsp; {'<'} &nbsp; {'>'}</span></footer>
      </section>

      <aside className="reschedule-note">
        <Information size={28} />
        <p><strong>Need to reschedule within 24 hours?</strong><span>For urgent changes or appointments within the next 24 hours, please contact the clinic directly at +1 (555) 010-9988.</span></p>
        <button className="secondary-action" type="button" onClick={onSupport}>Contact Support</button>
      </aside>
    </main>
  );
}

function appointmentTab(appointment: Appointment) {
  if (appointment.statusGroup === 'Cancelled' || appointment.status === 'Cancelled') return 'cancelled';
  if (appointment.statusGroup === 'Past' || appointment.status === 'Completed') return 'past';
  return 'upcoming';
}

function appointmentInitials(name: string) {
  return name
    .split(/\s+/)
    .filter((part) => !/^dr\.?$/i.test(part))
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'CT';
}

function PrescriptionsPage({
  preferredPharmacy,
  medicationSummary,
  prescriptions,
  refillRequestIds,
  onRefill,
  onRequestMedication,
  onChangePharmacy,
  onStartMessage,
  onPrintList,
  onViewLeaflet,
  onCheckInteraction,
  canRefill,
  canRequestMedication,
}: {
  preferredPharmacy: PortalData['preferredPharmacy'];
  medicationSummary: {
    activeMedications: number;
    dueForRefill: number;
    pendingRequests: number;
  };
  prescriptions: Prescription[];
  refillRequestIds: string[];
  onRefill: (prescriptionId: string) => Promise<void>;
  onRequestMedication: (medicationName: string, notes: string) => Promise<void>;
  onChangePharmacy: (input: ReturnType<typeof defaultPharmacyForm>) => Promise<void>;
  onStartMessage: (subject: string, body?: string) => void;
  onPrintList: () => Promise<void>;
  onViewLeaflet: (prescriptionId: string) => Promise<void>;
  onCheckInteraction: (medicationName: string) => Promise<unknown>;
  canRefill: boolean;
  canRequestMedication: boolean;
}) {
  const [pendingRefill, setPendingRefill] = useState('');
  const [notice, setNotice] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [medicationName, setMedicationName] = useState('');
  const [notes, setNotes] = useState('');
  const [requestingMedication, setRequestingMedication] = useState(false);
  const [pharmacyOpen, setPharmacyOpen] = useState(false);
  const [pharmacyForm, setPharmacyForm] = useState(defaultPharmacyForm(preferredPharmacy));
  const [savingPharmacy, setSavingPharmacy] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interactionMedication, setInteractionMedication] = useState('');
  const [checkingInteraction, setCheckingInteraction] = useState(false);

  useEffect(() => {
    setPharmacyForm(defaultPharmacyForm(preferredPharmacy));
  }, [preferredPharmacy]);

  const handleRefill = async (prescriptionId: string) => {
    setPendingRefill(prescriptionId);
    setNotice('');
    try {
      await onRefill(prescriptionId);
      setNotice('Refill request sent to your preferred pharmacy.');
    } finally {
      setPendingRefill('');
    }
  };

  const handleMedicationRequest = async () => {
    if (!medicationName.trim()) return;
    setRequestingMedication(true);
    try {
      await onRequestMedication(medicationName, notes);
      setRequestOpen(false);
      setMedicationName('');
      setNotes('');
      setNotice('Medication request sent for clinical review.');
    } finally {
      setRequestingMedication(false);
    }
  };

  const handlePharmacySave = async () => {
    setSavingPharmacy(true);
    try {
      await onChangePharmacy(pharmacyForm);
      setPharmacyOpen(false);
      setNotice('Preferred pharmacy updated.');
    } finally {
      setSavingPharmacy(false);
    }
  };

  const handleInteractionCheck = async () => {
    if (!interactionMedication.trim()) return;
    setCheckingInteraction(true);
    setNotice('');
    try {
      const result = await onCheckInteraction(interactionMedication);
      setInteractionOpen(false);
      setInteractionMedication('');
      openPrintableView('Drug Interaction Check', result);
      setNotice('Interaction check completed and recorded.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not complete interaction check.');
    } finally {
      setCheckingInteraction(false);
    }
  };

  return (
    <main className="portal-main prescriptions-page">
      <section className="prescriptions-title">
        <div><h1>Active Prescriptions</h1><p>Manage your current medications and refill requests.</p></div>
        <div className="page-actions">
          {canRequestMedication && <button className="primary-action" type="button" onClick={() => setRequestOpen(true)}><Add size={18} /> Request New Medication</button>}
          <button className="secondary-action" type="button" onClick={() => void onPrintList()}><Printer size={17} /> Print List</button>
        </div>
      </section>

      {notice && <p className="workspace-notice">{notice}</p>}

      <section className="pharmacy-summary">
        <article>
          <div><span>Preferred Pharmacy</span><button type="button" onClick={() => setPharmacyOpen(true)}><Edit size={15} /> Change</button></div>
          <button className="link-button" type="button" onClick={() => openPrintableView('Preferred Pharmacy', preferredPharmacy)}>{preferredPharmacy.name}</button>
          <p>{preferredPharmacy.addressLine1}<br />{preferredPharmacy.addressLine2}</p>
          <footer><p><span>Phone</span><strong>{preferredPharmacy.phone}</strong></p><p><span>Hours</span><strong>{preferredPharmacy.hours}</strong></p></footer>
        </article>
        <aside>
          <h2>Medication Summary</h2>
          <p><span>Active Medications</span><strong>{String(medicationSummary.activeMedications).padStart(2, '0')}</strong></p>
          <p><span>Due for Refill</span><strong className="text-red">{String(medicationSummary.dueForRefill).padStart(2, '0')}</strong></p>
          <p><span>Pending Requests</span><strong>{String(medicationSummary.pendingRequests).padStart(2, '0')}</strong></p>
        </aside>
      </section>

      <section className="prescriptions-table-panel">
        <div className="prescriptions-table-wrap">
          <table>
            <thead><tr><th>Medication & Dosage</th><th>Frequency</th><th>Started</th><th>Refills Remaining</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {prescriptions.map((prescription) => {
                const requested = refillRequestIds.includes(prescription.id);
                return (
                  <tr className={prescription.status === 'Pending Request' ? 'muted-row' : ''} key={prescription.id}>
                    <td>{prescription.name}<small>{prescription.detail}</small></td>
                    <td>{prescription.frequency}</td>
                    <td>{prescription.started}</td>
                    <td>{prescription.refillCount}<small className={prescription.status === 'Refill Due' ? 'text-red' : ''}>{prescription.refillDetail}</small></td>
                    <td><span className={`rx-status rx-status--${prescription.status.toLowerCase().replaceAll(' ', '-')}`}>{prescription.status}</span></td>
                    <td>
                      <button
                        className={prescription.status === 'Pending Request' || requested ? 'rx-action rx-action--muted' : 'rx-action'}
                        type="button"
                        disabled={!canRefill || prescription.status === 'Pending Request' || requested || pendingRefill === prescription.id}
                        onClick={() => handleRefill(prescription.id)}
                      >
                        {!canRefill ? 'Restricted' : requested || prescription.status === 'Pending Request' ? 'Pending' : pendingRefill === prescription.id ? 'Sending...' : 'Refill'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer><span>Showing {prescriptions.length ? `1-${prescriptions.length}` : '0'} of {prescriptions.length} prescriptions</span><span>{'<'} &nbsp; Page 1 of 1 &nbsp; {'>'}</span></footer>
      </section>

      <aside className="safety-note"><Information size={25} /><p><strong>Safety Information</strong><span>Always consult with your doctor before starting or stopping any medications. If you experience severe side effects, please contact your primary care provider or visit the nearest emergency department immediately.</span></p></aside>
      <section className="rx-action-grid">
        <button type="button" onClick={() => prescriptions[0] && void onViewLeaflet(prescriptions[0].id)}>View Medical Leaflet</button>
        <button type="button" onClick={() => setInteractionOpen(true)}>Check New Drug Interaction</button>
        <button type="button" onClick={() => onStartMessage('Medication question', 'I have a question about my current prescriptions.')}>Start Message</button>
      </section>

      <ComposedModal open={requestOpen} onClose={() => setRequestOpen(false)} size="sm">
        <ModalHeader title="Request new medication" />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="new-medication-name" labelText="Medication name" value={medicationName} onChange={(event) => setMedicationName(event.target.value)} />
            <TextArea id="new-medication-notes" labelText="Reason or notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setRequestOpen(false)}>Cancel</Button>
          <Button onClick={handleMedicationRequest} disabled={!medicationName.trim() || requestingMedication}>{requestingMedication ? 'Sending...' : 'Send request'}</Button>
        </ModalFooter>
      </ComposedModal>

      <ComposedModal open={pharmacyOpen} onClose={() => setPharmacyOpen(false)} size="sm">
        <ModalHeader title="Change preferred pharmacy" />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="pharmacy-name" labelText="Pharmacy name" value={pharmacyForm.name} onChange={(event) => setPharmacyForm((current) => ({ ...current, name: event.target.value }))} />
            <TextInput id="pharmacy-address-1" labelText="Address line 1" value={pharmacyForm.addressLine1} onChange={(event) => setPharmacyForm((current) => ({ ...current, addressLine1: event.target.value }))} />
            <TextInput id="pharmacy-address-2" labelText="Address line 2" value={pharmacyForm.addressLine2} onChange={(event) => setPharmacyForm((current) => ({ ...current, addressLine2: event.target.value }))} />
            <TextInput id="pharmacy-phone" labelText="Phone" value={pharmacyForm.phone} onChange={(event) => setPharmacyForm((current) => ({ ...current, phone: event.target.value }))} />
            <TextInput id="pharmacy-hours" labelText="Hours" value={pharmacyForm.hours} onChange={(event) => setPharmacyForm((current) => ({ ...current, hours: event.target.value }))} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setPharmacyOpen(false)}>Cancel</Button>
          <Button onClick={handlePharmacySave} disabled={savingPharmacy || !pharmacyForm.name.trim() || !pharmacyForm.addressLine1.trim() || !pharmacyForm.phone.trim()}>{savingPharmacy ? 'Saving...' : 'Save pharmacy'}</Button>
        </ModalFooter>
      </ComposedModal>

      <ComposedModal open={interactionOpen} onClose={() => setInteractionOpen(false)} size="sm">
        <ModalHeader title="Check drug interaction" />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="interaction-medication" labelText="Medication to check" placeholder="Ibuprofen 200 mg" value={interactionMedication} onChange={(event) => setInteractionMedication(event.target.value)} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setInteractionOpen(false)}>Cancel</Button>
          <Button disabled={!interactionMedication.trim() || checkingInteraction} onClick={handleInteractionCheck}>{checkingInteraction ? 'Checking...' : 'Check interaction'}</Button>
        </ModalFooter>
      </ComposedModal>
    </main>
  );
}

type BillingPaymentInput = {
  amount?: number;
  invoiceId?: string;
  paymentMethodId?: string;
};

const initialPaymentMethodForm: BillingPaymentMethodInput = {
  type: 'Card',
  label: '',
  detail: '',
  isDefault: false,
};

function BillingPage({
  billing,
  onPay,
  onAddPaymentMethod,
  onStatement,
  onInvoice,
  onResource,
  onPaymentSession,
  onSupport,
  canPay,
  canManagePaymentMethods,
}: {
  billing: BillingData;
  onPay: (input?: BillingPaymentInput) => Promise<void>;
  onAddPaymentMethod: (input: BillingPaymentMethodInput) => Promise<BillingPaymentMethod>;
  onStatement: () => Promise<void>;
  onInvoice: (invoiceId: string) => Promise<void>;
  onResource: (resourceId: string) => Promise<void>;
  onPaymentSession: (invoiceId?: string) => Promise<void>;
  onSupport: () => void;
  canPay: boolean;
  canManagePaymentMethods: boolean;
}) {
  const [invoiceFilter, setInvoiceFilter] = useState<'All' | 'Paid' | 'Pending' | 'Overdue'>('All');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [paying, setPaying] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(billing.paymentMethods.find((method) => method.isDefault)?.id || billing.paymentMethods[0]?.id || '');
  const [notice, setNotice] = useState('');
  const [methodOpen, setMethodOpen] = useState(false);
  const [methodForm, setMethodForm] = useState<BillingPaymentMethodInput>(initialPaymentMethodForm);
  const [methodError, setMethodError] = useState('');
  const [methodSaving, setMethodSaving] = useState(false);
  const invoices = billing.invoices
    .filter((invoice) => invoiceFilter === 'All' || invoice.status === invoiceFilter)
    .filter((invoice) => {
      const query = invoiceQuery.trim().toLowerCase();
      if (!query) return true;
      return [invoice.id, invoice.description, invoice.status].some((value) => value.toLowerCase().includes(query));
    });

  useEffect(() => {
    if (!billing.paymentMethods.some((method) => method.id === selectedPaymentMethodId)) {
      setSelectedPaymentMethodId(billing.paymentMethods.find((method) => method.isDefault)?.id || billing.paymentMethods[0]?.id || '');
    }
  }, [billing.paymentMethods, selectedPaymentMethodId]);

  const handlePayment = async (invoice?: BillingData['invoices'][number]) => {
    if (invoice?.status === 'Paid') return;
    setPaying(true);
    setPayingInvoiceId(invoice?.id || '');
    setNotice('');
    try {
      await onPay(invoice ? {
        invoiceId: invoice.id,
        amount: invoice.amount,
        paymentMethodId: selectedPaymentMethodId,
      } : {
        paymentMethodId: selectedPaymentMethodId,
      });
      setNotice(invoice ? `${invoice.id} has been paid.` : 'Your full outstanding balance has been paid.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not process payment');
    } finally {
      setPaying(false);
      setPayingInvoiceId('');
    }
  };

  const handlePaymentMethodSave = async () => {
    if (!methodForm.label.trim() || !methodForm.detail.trim()) {
      setMethodError('Label and details are required.');
      return;
    }

    setMethodSaving(true);
    setMethodError('');
    try {
      const method = await onAddPaymentMethod({
        ...methodForm,
        label: methodForm.label.trim(),
        detail: methodForm.detail.trim(),
      });
      setSelectedPaymentMethodId(method.id);
      setMethodForm(initialPaymentMethodForm);
      setMethodOpen(false);
      setNotice(`${method.label} has been added.`);
    } catch (error) {
      setMethodError(error instanceof Error ? error.message : 'Could not add payment method.');
    } finally {
      setMethodSaving(false);
    }
  };

  return (
    <>
      <main className="portal-main billing-page">
        <section className="billing-title"><h1>Billing & Payments</h1><p>Review your medical statements, track invoice history, and manage payment methods.</p></section>
        {notice && <p className="workspace-notice">{notice}</p>}

        <div className="billing-top-grid">
          <section className="balance-panel">
            <div><span>Total Outstanding Balance</span>{billing.paymentStatus === 'Due' ? <b>Payment Due: {billing.dueDate || 'Oct 25'}</b> : <b className="paid-label">Paid in Full</b>}</div>
            <strong>${billing.outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
            <div className="balance-breakdown">
              <p><span>Consultation</span><strong>${(billing.breakdown?.consultation ?? 450).toFixed(2)}</strong></p><p><span>Laboratory</span><strong>${(billing.breakdown?.laboratory ?? 320.5).toFixed(2)}</strong></p><p><span>Radiology</span><strong>${(billing.breakdown?.radiology ?? 478).toFixed(2)}</strong></p><p><span>Pharmacy</span><strong>${(billing.breakdown?.pharmacy ?? 0).toFixed(2)}</strong></p>
            </div>
            <footer><button className="primary-action" type="button" disabled={!canPay || billing.outstandingBalance === 0 || paying} onClick={() => handlePayment()}><Money size={19} /> {!canPay ? 'Payment Restricted' : paying && !payingInvoiceId ? 'Processing...' : billing.outstandingBalance === 0 ? 'Balance Paid' : 'Pay Full Balance'}</button><button className="secondary-action" type="button" onClick={onStatement}><Report size={19} /> View Statement</button></footer>
          </section>
          <section className="payment-methods">
            <h2>Payment Methods</h2>
            {billing.paymentMethods.map((method) => (
              <article key={method.id}>{method.type === 'Card' ? <Wallet size={22} /> : <Building size={22} />}<p><strong>{method.label}</strong><span>{method.detail}</span></p>{method.isDefault && <b>Default</b>}</article>
            ))}
            <label className="payment-method-select" htmlFor="payment-method">
              <span>Use for payment</span>
              <select id="payment-method" value={selectedPaymentMethodId} onChange={(event) => setSelectedPaymentMethodId(event.target.value)}>
                {billing.paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}
              </select>
            </label>
            {canManagePaymentMethods && <button type="button" onClick={() => setMethodOpen(true)}><Add size={20} /> Add New Method</button>}
          </section>
        </div>

        <section className="invoice-panel">
          <header><h2>Invoice History</h2><div>{(['All', 'Paid', 'Pending', 'Overdue'] as const).map((filter) => <button className={invoiceFilter === filter ? 'active' : ''} type="button" key={filter} onClick={() => setInvoiceFilter(filter)}>{filter}</button>)}<label><Search size={15} /><input aria-label="Search invoices" placeholder="Search invoices..." value={invoiceQuery} onChange={(event) => setInvoiceQuery(event.target.value)} /></label></div></header>
          <div className="invoice-table-wrap">
            <table><thead><tr><th>Invoice ID</th><th>Date</th><th>Service / Description</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>
              {invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.id}</td><td>{invoice.date}</td><td>{invoice.description}</td><td>${invoice.amount.toFixed(2)}</td><td><span className={`invoice-status invoice-status--${invoice.status.toLowerCase()}`}>● {invoice.status}</span></td><td>{invoice.status === 'Overdue' || invoice.status === 'Pending' ? <button type="button" disabled={!canPay || paying} onClick={() => handlePayment(invoice)}>{!canPay ? 'Restricted' : payingInvoiceId === invoice.id ? 'Processing...' : 'Pay Now'}</button> : <button type="button" onClick={() => void onInvoice(invoice.id)}><Download size={14} /> PDF</button>}</td></tr>)}
            </tbody></table>
          </div>
          <footer><span>Showing {invoices.length ? `1-${invoices.length}` : '0'} of {billing.invoices.length} invoices</span><span>{'<'} &nbsp; <b>1</b> &nbsp; {'>'}</span></footer>
        </section>

        <section className="billing-resources">
          {(billing.resources || []).map((resource, index) => {
            const Icon = index === 0 ? Document : Security;
            return <article key={resource.id}><Icon size={23} /><p><strong>{resource.title}</strong><span>{resource.detail}</span></p><button type="button" onClick={() => void onResource(resource.id)}>Open</button></article>;
          })}
          <aside><h3>Need help with your bill?</h3><p>Contact our financial counselors for payment plans or insurance disputes.</p><button type="button" onClick={onSupport}>Speak with Support</button></aside>
        </section>
        <button className="billing-qr" aria-label="Open billing QR code" title="Open billing QR code" type="button" onClick={() => void onPaymentSession()}><QrCode size={22} /></button>
      </main>

      <ComposedModal open={methodOpen} onClose={() => setMethodOpen(false)} size="sm">
        <ModalHeader title="Add payment method" />
        <ModalBody>
          <Stack gap={5}>
            <label className="payment-method-select" htmlFor="new-payment-method-type">
              <span>Method type</span>
              <select
                id="new-payment-method-type"
                value={methodForm.type}
                onChange={(event) => setMethodForm((current) => ({ ...current, type: event.target.value as BillingPaymentMethodInput['type'] }))}
              >
                <option>Card</option>
                <option>Bank</option>
              </select>
            </label>
            <TextInput id="new-payment-method-label" labelText="Label" placeholder="Visa **** 4242" value={methodForm.label} onChange={(event) => setMethodForm((current) => ({ ...current, label: event.target.value }))} />
            <TextInput id="new-payment-method-detail" labelText="Details" placeholder="Expires 12/28" value={methodForm.detail} onChange={(event) => setMethodForm((current) => ({ ...current, detail: event.target.value }))} />
            <label className="auth-check" htmlFor="new-payment-method-default">
              <input id="new-payment-method-default" type="checkbox" checked={Boolean(methodForm.isDefault)} onChange={(event) => setMethodForm((current) => ({ ...current, isDefault: event.target.checked }))} />
              <span>Set as default payment method</span>
            </label>
            {methodError && <InlineNotification kind="error" lowContrast title="Cannot add method" subtitle={methodError} />}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setMethodOpen(false)}>Cancel</Button>
          <Button onClick={handlePaymentMethodSave} disabled={methodSaving}>{methodSaving ? 'Saving...' : 'Add method'}</Button>
        </ModalFooter>
      </ComposedModal>
    </>
  );
}

function ProfileSettingsPage({
  profile,
  accountStatus,
  insuranceDetails,
  emergencyContacts,
  onSave,
  onInsuranceSave,
  onContactSave,
  onContactDelete,
  onUploadInsurance,
  canUpdate,
  canConfigureAccess,
  canManageRoles,
  canManageUsers,
}: {
  profile: ProfileSettings;
  accountStatus: PortalData['accountStatus'];
  insuranceDetails: PortalData['insuranceDetails'];
  emergencyContacts: PortalData['emergencyContacts'];
  onSave: (profile: ProfileSettings) => Promise<void>;
  onInsuranceSave: (insurance: PortalData['insuranceDetails']) => Promise<void>;
  onContactSave: (contact: Omit<EmergencyContact, 'id'>, contactId?: string) => Promise<void>;
  onContactDelete: (contactId: string) => Promise<void>;
  onUploadInsurance: () => Promise<void>;
  canUpdate: boolean;
  canConfigureAccess: boolean;
  canManageRoles: boolean;
  canManageUsers: boolean;
}) {
  const [form, setForm] = useState(profile);
  const [insuranceForm, setInsuranceForm] = useState(insuranceDetails);
  const [insuranceOpen, setInsuranceOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState('');
  const [contactForm, setContactForm] = useState<Omit<EmergencyContact, 'id'>>(emptyEmergencyContact);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => setForm(profile), [profile]);
  useEffect(() => setInsuranceForm(insuranceDetails), [insuranceDetails]);
  const update = (field: keyof ProfileSettings, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const updateInsurance = (field: keyof typeof insuranceForm, value: string) => setInsuranceForm((current) => ({ ...current, [field]: value }));
  const updateContact = (field: keyof typeof contactForm, value: string) => setContactForm((current) => ({ ...current, [field]: value }));
  const handleSave = async () => {
    setSaving(true);
    setNotice('');
    try {
      await onSave(form);
      setNotice('Profile changes saved.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const saveInsurance = async () => {
    setSaving(true);
    setNotice('');
    try {
      await onInsuranceSave(insuranceForm);
      setInsuranceOpen(false);
      setNotice('Insurance details saved.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save insurance details.');
    } finally {
      setSaving(false);
    }
  };

  const openContact = (contact?: EmergencyContact) => {
    setEditingContactId(contact?.id || '');
    setContactForm(contact ? {
      name: contact.name,
      relationship: contact.relationship,
      primaryPhone: contact.primaryPhone,
      alternatePhone: contact.alternatePhone,
      access: contact.access,
    } : emptyEmergencyContact);
    setContactOpen(true);
  };

  const saveContact = async () => {
    setSaving(true);
    setNotice('');
    try {
      await onContactSave(contactForm, editingContactId || undefined);
      setContactOpen(false);
      setNotice(editingContactId ? 'Emergency contact updated.' : 'Emergency contact added.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save emergency contact.');
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (contact: EmergencyContact) => {
    setSaving(true);
    setNotice('');
    try {
      await onContactDelete(contact.id);
      setNotice(`${contact.name} removed from emergency contacts.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove emergency contact.');
    } finally {
      setSaving(false);
    }
  };

  const uploadInsurance = async () => {
    setSaving(true);
    setNotice('');
    try {
      await onUploadInsurance();
      setNotice('Insurance card metadata saved.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not upload insurance card metadata.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="portal-main profile-settings-page">
      <section className="settings-title"><div><p>Settings / <strong>Profile Settings</strong></p><h1>Profile Settings</h1><span>Update your personal information, insurance details, and emergency contacts.</span></div><div className="page-actions">{canUpdate && <button className="secondary-action" type="button" onClick={() => { setForm(profile); setNotice(''); }}>Discard changes</button>}<button className="primary-action" type="button" disabled={!canUpdate || saving} onClick={handleSave}>{!canUpdate ? 'View Only' : saving ? 'Saving...' : 'Save Profile'}</button></div></section>
      {notice && <p className="workspace-notice">{notice}</p>}

      <section className="profile-settings-shell">
        <div className="personal-info">
          <h2><UserProfile size={19} /> Personal Information</h2>
          <div className="profile-field-grid">
            <label><span>Full Name</span><input aria-label="Full Name" disabled={!canUpdate} value={form.fullName} onChange={(event) => update('fullName', event.target.value)} /></label>
            <label><span>Email Address</span><input aria-label="Email Address" disabled={!canUpdate} value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
            <label><span>Phone Number</span><input aria-label="Phone Number" disabled={!canUpdate} value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
            <label><span>Date of Birth</span><input aria-label="Date of Birth" disabled={!canUpdate} value={form.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} /></label>
            <label className="wide"><span>Residential Address</span><input aria-label="Residential Address" disabled={!canUpdate} value={form.address} onChange={(event) => update('address', event.target.value)} /></label>
            <label><span>Preferred Language</span><select aria-label="Preferred Language" disabled={!canUpdate} value={form.language} onChange={(event) => update('language', event.target.value)}><option>English (US)</option><option>Spanish</option></select></label>
            <label><span>Timezone</span><select aria-label="Timezone" disabled={!canUpdate} value={form.timezone} onChange={(event) => update('timezone', event.target.value)}><option>(GMT-08:00) Pacific Time</option><option>(GMT-05:00) Eastern Time</option></select></label>
          </div>
        </div>
        <aside className="account-status">
          <h2><Security size={19} /> Account Status</h2>
          <p><span>Profile Completion</span><strong>{accountStatus.profileCompletion}%</strong></p><p><span>2FA Security</span><b>{accountStatus.twoFactorEnabled ? 'Enabled' : 'Not enabled'}</b></p><p><span>Last Login</span><small>{accountStatus.lastLogin}</small></p>
          <blockquote>"{accountStatus.privacyNotice}"</blockquote>
        </aside>
        <section className="insurance-details">
          <h2><Security size={19} /> Insurance Details</h2>
          <div><article><span>Primary Provider</span><button className="link-button" type="button" onClick={() => openPrintableView('Insurance Details', insuranceDetails)}>{insuranceDetails.primaryProvider} <Launch size={12} /></button><button type="button" disabled={!canUpdate} onClick={() => setInsuranceOpen(true)}>Change <Launch size={11} /></button></article><article><span>Member ID</span><strong>{insuranceDetails.memberId}</strong></article><article><span>Group Number</span><strong>{insuranceDetails.groupNumber}</strong></article><article><span>Policy Holder</span><strong>{insuranceDetails.policyHolder}</strong></article></div>
          <p><CheckmarkOutline size={14} /> Active through {insuranceDetails.activeThrough} &nbsp;&nbsp; Info verified on {insuranceDetails.verifiedAt}</p>
          <button className="secondary-action" type="button" disabled={!canUpdate || saving} onClick={uploadInsurance}><Attachment size={16} /> Upload Insurance Card</button>
        </section>
        <section className="emergency-contacts">
          <header><h2><UserProfile size={19} /> Emergency Contacts</h2><button type="button" disabled={!canUpdate} onClick={() => openContact()}><Add size={17} /> Add Contact</button></header>
          <div className="contacts-table-wrap"><table><thead><tr><th>Name</th><th>Relationship</th><th>Primary Phone</th><th>Alt Phone</th><th>Access Level</th><th>Actions</th></tr></thead><tbody>{emergencyContacts.map((contact) => <tr key={contact.id}><td><strong>{contact.name}</strong></td><td>{contact.relationship}</td><td>{contact.primaryPhone}</td><td>{contact.alternatePhone}</td><td><span>{contact.access}</span></td><td><button type="button" disabled={!canUpdate || saving} aria-label={`Edit ${contact.name}`} onClick={() => openContact(contact)}><Edit size={17} /></button><button type="button" disabled={!canUpdate || saving} aria-label={`Delete ${contact.name}`} onClick={() => deleteContact(contact)}><TrashCan size={17} /></button></td></tr>)}</tbody></table></div>
        </section>
        <footer className="profile-security-footer"><span>End-to-End Encrypted Data</span><span>HIPAA Compliant Environment</span><small>Internal Build: v4.2.1-stable - Last Sync: {portalSyncLabel()}</small></footer>
      </section>
      {canConfigureAccess && <AdminAccessPage canManageRoles={canManageRoles} canManageUsers={canManageUsers} />}

      <ComposedModal open={insuranceOpen} onClose={() => setInsuranceOpen(false)} size="sm">
        <ModalHeader title="Edit insurance details" />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="insurance-provider" labelText="Primary provider" value={insuranceForm.primaryProvider} onChange={(event) => updateInsurance('primaryProvider', event.target.value)} />
            <TextInput id="insurance-member" labelText="Member ID" value={insuranceForm.memberId} onChange={(event) => updateInsurance('memberId', event.target.value)} />
            <TextInput id="insurance-group" labelText="Group number" value={insuranceForm.groupNumber} onChange={(event) => updateInsurance('groupNumber', event.target.value)} />
            <TextInput id="insurance-holder" labelText="Policy holder" value={insuranceForm.policyHolder} onChange={(event) => updateInsurance('policyHolder', event.target.value)} />
            <TextInput id="insurance-active" labelText="Active through" value={insuranceForm.activeThrough} onChange={(event) => updateInsurance('activeThrough', event.target.value)} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setInsuranceOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={saveInsurance}>{saving ? 'Saving...' : 'Save insurance'}</Button>
        </ModalFooter>
      </ComposedModal>

      <ComposedModal open={contactOpen} onClose={() => setContactOpen(false)} size="sm">
        <ModalHeader title={editingContactId ? 'Edit emergency contact' : 'Add emergency contact'} />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="contact-name" labelText="Name" value={contactForm.name} onChange={(event) => updateContact('name', event.target.value)} />
            <TextInput id="contact-relationship" labelText="Relationship" value={contactForm.relationship} onChange={(event) => updateContact('relationship', event.target.value)} />
            <TextInput id="contact-primary-phone" labelText="Primary phone" value={contactForm.primaryPhone} onChange={(event) => updateContact('primaryPhone', event.target.value)} />
            <TextInput id="contact-alt-phone" labelText="Alternate phone" value={contactForm.alternatePhone} onChange={(event) => updateContact('alternatePhone', event.target.value)} />
            <TextInput id="contact-access" labelText="Access level" value={contactForm.access} onChange={(event) => updateContact('access', event.target.value)} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setContactOpen(false)}>Cancel</Button>
          <Button disabled={saving || !contactForm.name.trim() || !contactForm.relationship.trim() || !contactForm.primaryPhone.trim() || !contactForm.access.trim()} onClick={saveContact}>{saving ? 'Saving...' : 'Save contact'}</Button>
        </ModalFooter>
      </ComposedModal>
    </main>
  );
}

function ResourcesPage({
  resources,
  onInteraction,
  onDetail,
}: {
  resources: PortalData['educationalResources'];
  onInteraction: (resourceId: string, action: string) => Promise<void>;
  onDetail: (resourceId: string) => Promise<void>;
}) {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [format, setFormat] = useState('All Formats');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const visibleLibrary = resources.library
    .filter((item) => format === 'All Formats' || item.format === format)
    .filter((item) => {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) return true;
      return [item.title, item.detail, item.category, item.format].some((value) => value.toLowerCase().includes(normalizedQuery));
    });

  const record = async (resourceId: string, action: string) => {
    await onInteraction(resourceId, action);
    setNotice(`${action} recorded.`);
  };

  const toggleSaved = async (resourceId: string) => {
    setSavedIds((current) => current.includes(resourceId)
      ? current.filter((id) => id !== resourceId)
      : [...current, resourceId]);
    await record(resourceId, savedIds.includes(resourceId) ? 'Unsave' : 'Save');
  };

  return (
    <main className="portal-main resources-page">
      <section className="page-title resources-title">
        <div>
          <h1>Educational Resources</h1>
          <p>Access medical articles, videos, and guides curated specifically for your health profile and recent laboratory results.</p>
        </div>
      </section>
      {notice && <p className="workspace-notice">{notice}</p>}
      <label className="record-search">
        <Search size={18} />
        <input aria-label="Search resources" placeholder="Search resources..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>

      <section className="featured-resource">
        <header><h2>Featured for You</h2><button type="button" onClick={() => setQuery('')}>View All Recommendation</button></header>
        <div className="featured-resource-grid">
          <article>
            <span>{resources.featured.category}</span>
            <h3>{resources.featured.title}</h3>
            <p>{resources.featured.detail}</p>
            <small>{resources.featured.meta} - {resources.featured.updated}</small>
            <button className="primary-action" type="button" onClick={() => { void onDetail(resources.featured.id); void record(resources.featured.id, 'Read'); }}>{resources.featured.actionLabel}<Launch size={18} /></button>
          </article>
          <aside className="resource-media">
            <div className="resource-image resource-image--bp">
              {resources.featured.imageUrl && <img src={resources.featured.imageUrl} alt="" />}
            </div>
          </aside>
          <article className="resource-video">
            <div className="resource-image resource-image--heart">
              {resources.video.imageUrl && <img src={resources.video.imageUrl} alt="" />}
              <span>{resources.video.duration}</span>
            </div>
            <h3>{resources.video.title}</h3>
            <p>{resources.video.detail}</p>
            <footer><span>{resources.video.category}</span><button type="button" aria-label="Save video" onClick={() => void toggleSaved(resources.video.id)}>{savedIds.includes(resources.video.id) ? 'Saved' : 'Save'}</button></footer>
          </article>
        </div>
      </section>

      <section className="resource-group-grid">
        {resources.groups.map((group) => (
          <article className="resource-group" key={group.id}>
            <h2>{group.title}</h2>
            {group.items.map((item, index) => {
              const resourceId = `${group.id}-${index}`;
              return (
                <button type="button" key={resourceId} onClick={() => { void onDetail(resourceId); void record(resourceId, item.action); }}>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                  <small>{item.action}</small>
                </button>
              );
            })}
          </article>
        ))}
      </section>

      <section className="portal-table-panel">
        <header>
          <h2>Resource Library</h2>
          <select aria-label="Resource format" value={format} onChange={(event) => setFormat(event.target.value)}>
            <option>All Formats</option>
            <option>Article</option>
            <option>Video</option>
            <option>PDF</option>
          </select>
        </header>
        <div className="portal-table-wrap">
          <table>
            <thead><tr><th>Title & Description</th><th>Category</th><th>Last Updated</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleLibrary.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.title}</strong><small>{item.detail}</small></td>
                  <td>{item.category}</td>
                  <td>{item.updated}</td>
                  <td><button type="button" onClick={() => { void onDetail(item.id); void toggleSaved(item.id); }}>{savedIds.includes(item.id) ? 'Saved' : item.format}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function ReferralsPage({
  referrals,
  canManage,
  onRequest,
  onAction,
  onExport,
  onDetail,
}: {
  referrals: PortalData['referrals'];
  canManage: boolean;
  onRequest: (input: { provider?: string; specialty: string; reason: string; clinic?: string }) => Promise<void>;
  onAction: (referralId: string, action: string, note?: string) => Promise<void>;
  onExport: () => Promise<void>;
  onDetail: (referralId: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<'All Status' | 'Pending' | 'Scheduled' | 'Completed'>('All Status');
  const [requestOpen, setRequestOpen] = useState(false);
  const [referralForm, setReferralForm] = useState({ provider: 'Care Team', specialty: 'General Medicine', reason: '', clinic: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const visibleRows = referrals.rows.filter((row) => filter === 'All Status' || row.status === filter);
  const focusReferralId = referrals.rows.find((row) => row.id.replace(/\D/g, '') === referrals.focus.caseId.replace(/\D/g, ''))?.id
    || referrals.rows[0]?.id
    || referrals.focus.caseId.toLowerCase().replace(/^ref-?/, 'ref-');

  const submitReferral = async () => {
    if (!referralForm.specialty.trim() || !referralForm.reason.trim()) return;
    setSaving(true);
    try {
      await onRequest(referralForm);
      setRequestOpen(false);
      setReferralForm({ provider: 'Care Team', specialty: 'General Medicine', reason: '', clinic: '' });
      setNotice('Referral request submitted.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (referralId: string, action: string) => {
    if (action === 'Details' || action === 'View Results' || action === 'View Calendar') {
      await onDetail(referralId);
    }
    if (action === 'Contact') {
      await onDetail(referralId);
    }
    await onAction(referralId, action, `${action} from patient portal`);
    setNotice(`${action} recorded.`);
  };

  return (
    <main className="portal-main referrals-page">
      <section className="records-title">
        <div><p>Health Records / Referrals</p><h1>Referrals Tracking</h1></div>
        {canManage && <button className="primary-action" type="button" onClick={() => setRequestOpen(true)}><Add size={18} /> Request New Referral</button>}
      </section>
      {notice && <p className="workspace-notice">{notice}</p>}

      <section className="referral-summary">
        <article><span>Active Referrals</span><strong>{referrals.summary.active}</strong></article>
        <article><span>Pending Action</span><strong>{String(referrals.rows.filter((row) => row.status === 'Pending').length).padStart(2, '0')}</strong></article>
        <article><span>Completed (Year)</span><strong>{String(referrals.summary.completedYear).padStart(2, '0')}</strong></article>
        <button type="button" onClick={onExport}><Download size={20} /> Export Report</button>
      </section>

      <section className="portal-table-panel">
        <header>
          <h2>Filters:</h2>
          <div className="segmented-filter">
            {(['All Status', 'Pending', 'Scheduled', 'Completed'] as const).map((status) => (
              <button className={filter === status ? 'active' : ''} type="button" key={status} onClick={() => setFilter(status)}>{status}</button>
            ))}
          </div>
        </header>
        <div className="portal-table-wrap">
          <table>
            <thead><tr><th>Issued Date</th><th>Specialist / Provider</th><th>Reason / Clinic</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.issuedDate}</td>
                  <td><strong>{row.provider}</strong><small>{row.specialty}</small></td>
                  <td><em>{row.reason}</em></td>
                  <td><span className={`referral-status referral-status--${row.status.toLowerCase()}`}>{row.status}</span></td>
                  <td>{row.appointment && <small>{row.appointment}</small>} {row.actions.map((action) => <button type="button" key={action} onClick={() => void runAction(row.id, action)}>{action}</button>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="referral-detail-grid">
        <section className="referral-focus">
          <h2>{referrals.focus.title}</h2>
          <p>Ongoing specialist communication for Case #{referrals.focus.caseId}</p>
          <blockquote><strong>Physician's Clinical Note</strong>{referrals.focus.note}</blockquote>
          <div><article><span>Attachment</span><button className="link-button" type="button" onClick={() => void onDetail(focusReferralId)}>{referrals.focus.attachment}</button></article><article><span>Last Update</span><strong>{referrals.focus.lastUpdate}</strong></article></div>
        </section>
        <aside className="clinic-card">
          <strong>{referrals.focus.clinic}</strong>
          <p>{referrals.focus.address}</p>
          <p>{referrals.focus.phone}</p>
          <p>{referrals.focus.email}</p>
          <button type="button" onClick={() => void onDetail(focusReferralId)}>Clinic Profile</button>
        </aside>
      </div>

      <ComposedModal open={requestOpen} onClose={() => setRequestOpen(false)} size="sm">
        <ModalHeader title="Request new referral" />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="referral-provider" labelText="Provider" value={referralForm.provider} onChange={(event) => setReferralForm((current) => ({ ...current, provider: event.target.value }))} />
            <TextInput id="referral-specialty" labelText="Specialty" value={referralForm.specialty} onChange={(event) => setReferralForm((current) => ({ ...current, specialty: event.target.value }))} />
            <TextInput id="referral-clinic" labelText="Clinic" value={referralForm.clinic} onChange={(event) => setReferralForm((current) => ({ ...current, clinic: event.target.value }))} />
            <TextArea id="referral-reason" labelText="Reason" value={referralForm.reason} onChange={(event) => setReferralForm((current) => ({ ...current, reason: event.target.value }))} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setRequestOpen(false)}>Cancel</Button>
          <Button disabled={saving || !referralForm.specialty.trim() || !referralForm.reason.trim()} onClick={submitReferral}>{saving ? 'Submitting...' : 'Submit referral'}</Button>
        </ModalFooter>
      </ComposedModal>
    </main>
  );
}

function ImmunizationsPage({
  records,
  onBook,
  onDownload,
  onDetail,
  canBook,
}: {
  records: PortalData['immunizationRecords'];
  onBook: () => void;
  onDownload: () => Promise<void>;
  onDetail: (recordId: string) => Promise<void>;
  canBook: boolean;
}) {
  return (
    <main className="portal-main immunizations-page">
      <section className="records-title">
        <div><p>Health Records / Immunizations</p><h1>Immunization Records</h1></div>
        <button className="secondary-action" type="button" onClick={() => void onDownload()}><Download size={17} /> Download</button>
      </section>
      <section className="immunization-alerts">
        {records.alerts.map((alert) => <article className={`immunization-alert immunization-alert--${alert.tone}`} key={alert.id}><strong>{alert.title}</strong><span>{alert.detail}</span></article>)}
      </section>
      <section className="portal-table-panel">
        <header><h2>Completed Immunizations</h2><span>Showing {records.completed.length} entries</span></header>
        <div className="portal-table-wrap">
          <table>
            <thead><tr><th>Vaccine Name</th><th>Date Administered</th><th>Dose / Series</th><th>Administering Provider</th><th>Site / Route</th><th>Actions</th></tr></thead>
            <tbody>{records.completed.map((item) => <tr key={item.id}><td>{item.vaccine}</td><td>{item.date}</td><td>{item.dose}</td><td>{item.provider}</td><td>{item.route}</td><td><button type="button" onClick={() => void onDetail(item.id)}>View</button></td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="immunization-bottom-grid">
        <article className="compliance-card"><h2>Vaccination Compliance</h2><strong>{records.compliance.percent}%</strong><i><b style={{ width: `${records.compliance.percent}%` }} /></i><p>{records.compliance.detail}</p><small>Compliance calculated based on CDC guidelines for your age and health profile.</small></article>
        <article className="schedule-card"><h2>Need an Appointment?</h2><p>Schedule your seasonal flu shot or overdue boosters with your primary care provider.</p><button className="primary-action" type="button" disabled={!canBook} onClick={onBook}>{canBook ? 'Schedule Now' : 'Scheduling Restricted'}</button></article>
      </section>
    </main>
  );
}

function HealthTrendsPage({ trends, onExport }: { trends: PortalData['healthTrends']; onExport: (range: string) => Promise<void> }) {
  const [range, setRange] = useState('12m');
  return (
    <main className="portal-main trends-page">
      <section className="records-title">
        <div><h1>Health Trends & Vitals</h1><p>Longitudinal patient data analysis (Last 12 Months)</p></div>
        <div className="page-actions">
          <select aria-label="Date range" value={range} onChange={(event) => setRange(event.target.value)}>
            <option value="3m">Past 3 Months</option>
            <option value="6m">Past 6 Months</option>
            <option value="12m">Past 12 Months</option>
          </select>
          <button className="secondary-action" type="button" onClick={() => onExport(range)}><Download size={17} /> Download</button>
        </div>
      </section>
      <section className="trend-summary-strip">
        <article><span>Within Range</span><strong>{trends.summary.withinRange}</strong><small>Metrics</small></article>
        <article><span>Attention Required</span><strong>{trends.summary.attentionRequired}</strong><small>Metrics</small></article>
        <article><span>Last Update Summary</span>{trends.summary.updates.map((item) => <small key={item}>{item}</small>)}</article>
      </section>
      <section className="trend-metric-grid">
        {trends.metrics.map((metric) => (
          <article className="trend-metric-card" key={metric.id}>
            <header><h2>{metric.label}</h2><span>{metric.status}</span></header>
            <svg viewBox="0 0 260 110" role="img" aria-label={`${metric.label} trend`}>
              <polyline points={metric.points.map((point, index) => `${20 + index * 55},${point}`).join(' ')} fill="none" stroke="#0043ce" strokeWidth="4" />
            </svg>
            <footer><p><span>Latest</span><strong>{metric.latest}</strong><small>{metric.unit}</small></p><p><span>{metric.averageLabel}</span><strong>{metric.average}</strong></p></footer>
          </article>
        ))}
      </section>
      <section className="portal-table-panel">
        <header><h2>Recent Lab Comparison</h2><span>Baseline: 2023-08-12 / Latest: 2024-02-15</span></header>
        <div className="portal-table-wrap"><table><thead><tr><th>Test Parameter</th><th>Baseline</th><th>Current</th><th>Change</th><th>Status</th></tr></thead><tbody>{trends.labComparison.map((lab) => <tr key={lab.parameter}><td>{lab.parameter}</td><td>{lab.baseline}</td><td>{lab.current}</td><td>{lab.change}</td><td><span className={`referral-status referral-status--${lab.status.toLowerCase()}`}>{lab.status}</span></td></tr>)}</tbody></table></div>
      </section>
      <section className="health-goals">
        <article><h2>Clinician Interpretation</h2><p>Dr. Sarah Jenkins, Endocrinologist</p><blockquote>Blood pressure remains elevated while glucose markers are improving. Continue current adherence plan and review LDL goals at the next appointment.</blockquote></article>
        <article><h2>Health Goals Status</h2>{trends.goals.map((goal) => <p key={goal.id}><span>{goal.label}</span><i><b style={{ width: `${goal.progress}%` }} /></i><strong>{goal.progress}%</strong></p>)}</article>
      </section>
    </main>
  );
}

function FamilyAccessPage({
  familyAccess,
  shareRecords,
  mentalHealthNotes,
  onShareRecordsChange,
  onInviteProxy,
  onProxyPermissionChange,
  onResendProxy,
  onRevokeProxy,
  onAddDependent,
  onDownloadPolicy,
  onReportUnauthorized,
  canManage,
}: {
  familyAccess: PortalData['familyAccess'];
  shareRecords: boolean;
  mentalHealthNotes: boolean;
  onShareRecordsChange: (input: { shareRecords?: boolean; mentalHealthNotes?: boolean }) => Promise<void>;
  onInviteProxy: (input: { name: string; relationship: string; permissions: string }) => Promise<void>;
  onProxyPermissionChange: (proxyId: string, permissions: string) => Promise<void>;
  onResendProxy: (proxyId: string) => Promise<void>;
  onRevokeProxy: (proxyId: string) => Promise<void>;
  onAddDependent: (input: { name: string; relationship: string; detail?: string; access?: string }) => Promise<void>;
  onDownloadPolicy: () => Promise<void>;
  onReportUnauthorized: (summary: string) => Promise<void>;
  canManage: boolean;
}) {
  const [savingShare, setSavingShare] = useState(false);
  const [notice, setNotice] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [dependentOpen, setDependentOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [proxyForm, setProxyForm] = useState({ name: '', relationship: 'Spouse', permissions: 'View Only' });
  const [dependentForm, setDependentForm] = useState({ name: '', relationship: 'Dependent', detail: 'Last Visit: Pending', access: 'View Only' });
  const [reportSummary, setReportSummary] = useState('');

  const toggleShareRecords = async () => {
    setSavingShare(true);
    try {
      await onShareRecordsChange({ shareRecords: !shareRecords });
    } finally {
      setSavingShare(false);
    }
  };

  const toggleMentalHealthNotes = async () => {
    setSavingShare(true);
    try {
      await onShareRecordsChange({ mentalHealthNotes: !mentalHealthNotes });
    } finally {
      setSavingShare(false);
    }
  };

  const submitProxy = async () => {
    await onInviteProxy(proxyForm);
    setInviteOpen(false);
    setProxyForm({ name: '', relationship: 'Spouse', permissions: 'View Only' });
    setNotice('Proxy invite sent.');
  };

  const submitDependent = async () => {
    await onAddDependent(dependentForm);
    setDependentOpen(false);
    setDependentForm({ name: '', relationship: 'Dependent', detail: 'Last Visit: Pending', access: 'View Only' });
    setNotice('Dependent added.');
  };

  const submitReport = async () => {
    await onReportUnauthorized(reportSummary);
    setReportOpen(false);
    setReportSummary('');
    setNotice('Unauthorized access report submitted.');
  };

  return (
    <main className="portal-main family-page">
      <section className="records-title"><div><h1>Family & Proxy Access</h1><p>Manage who can view your healthcare information and which accounts you are authorized to manage on behalf of others. All access is logged for your security.</p></div></section>
      {notice && <p className="workspace-notice">{notice}</p>}
      <div className="family-grid">
        <section className="portal-table-panel">
          <header><h2>Access to My Records</h2>{canManage && <button className="primary-action" type="button" onClick={() => setInviteOpen(true)}><Add size={17} /> Invite Proxy</button>}</header>
          <div className="portal-table-wrap"><table><thead><tr><th>Proxy Name</th><th>Relationship</th><th>Permissions</th><th>Actions</th></tr></thead><tbody>{familyAccess.proxies.map((proxy) => <tr key={proxy.id}><td><strong>{proxy.name}</strong><small>{proxy.status !== 'Active' ? proxy.status : ''}</small></td><td>{proxy.relationship}</td><td>{proxy.status === 'Active' ? <select disabled={!canManage} value={proxy.permissions} onChange={(event) => void onProxyPermissionChange(proxy.id, event.target.value)}><option>Full Access</option><option>View Only</option><option>Billing Only</option></select> : <em>{proxy.permissions}</em>}</td><td>{canManage ? proxy.status === 'Active' ? <button type="button" onClick={() => void onRevokeProxy(proxy.id)}>Revoke</button> : <><button type="button" onClick={() => void onResendProxy(proxy.id)}>Resend</button><button type="button" onClick={() => void onRevokeProxy(proxy.id)}>Cancel</button></> : <span>View only</span>}</td></tr>)}</tbody></table></div>
        </section>
        <aside className="accounts-access">
          <h2>Accounts I Access</h2>
          {familyAccess.accounts.map((account) => <article key={account.id}><strong>{account.name}</strong><span>{account.detail}</span><b>{account.access}</b></article>)}
          {canManage && <button type="button" onClick={() => setDependentOpen(true)}>Request access to another account</button>}
        </aside>
      </div>
      <section className="access-activity">
        <h2>Recent Access Activity</h2>
        <div>{familyAccess.activity.map((item) => <p key={item.id} className={`activity-dot activity-dot--${item.tone}`}><strong>{item.title}</strong><span>{item.detail}</span></p>)}</div>
        <button className="link-button" type="button" onClick={() => openPrintableView('Security Audit Trail', familyAccess.activity)}>View full security audit trail</button>
      </section>
      <section className="privacy-settings">
        <div><h2>Global Privacy Settings</h2><p>Manage universal visibility for all proxies.</p></div>
        <label><input type="checkbox" checked={shareRecords} disabled={!canManage || savingShare} onChange={toggleShareRecords} /> Share HIV/STI Results<span>{shareRecords ? 'Currently Enabled' : 'Currently Disabled'}</span></label>
        <label><input type="checkbox" checked={mentalHealthNotes} disabled={!canManage || savingShare} onChange={toggleMentalHealthNotes} /> Share Mental Health Notes<span>{mentalHealthNotes ? 'Enabled' : 'Strict Privacy Mode'}</span></label>
      </section>
      <footer className="family-footer"><Information size={22} /><p>Under HIPAA and O3 Portal security protocols, all proxy access is tracked. You can revoke access at any time.</p><button type="button" onClick={onDownloadPolicy}>Download Access Policy</button><button type="button" onClick={() => setReportOpen(true)}>Report Unauthorized Access</button></footer>

      <ComposedModal open={inviteOpen} onClose={() => setInviteOpen(false)} size="sm">
        <ModalHeader title="Invite proxy" />
        <ModalBody><Stack gap={5}><TextInput id="proxy-name" labelText="Name" value={proxyForm.name} onChange={(event) => setProxyForm((current) => ({ ...current, name: event.target.value }))} /><TextInput id="proxy-relationship" labelText="Relationship" value={proxyForm.relationship} onChange={(event) => setProxyForm((current) => ({ ...current, relationship: event.target.value }))} /><TextInput id="proxy-permissions" labelText="Permissions" value={proxyForm.permissions} onChange={(event) => setProxyForm((current) => ({ ...current, permissions: event.target.value }))} /></Stack></ModalBody>
        <ModalFooter><Button kind="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button><Button disabled={!proxyForm.name.trim()} onClick={submitProxy}>Send invite</Button></ModalFooter>
      </ComposedModal>

      <ComposedModal open={dependentOpen} onClose={() => setDependentOpen(false)} size="sm">
        <ModalHeader title="Add dependent" />
        <ModalBody><Stack gap={5}><TextInput id="dependent-name" labelText="Name" value={dependentForm.name} onChange={(event) => setDependentForm((current) => ({ ...current, name: event.target.value }))} /><TextInput id="dependent-relationship" labelText="Relationship" value={dependentForm.relationship} onChange={(event) => setDependentForm((current) => ({ ...current, relationship: event.target.value }))} /><TextInput id="dependent-detail" labelText="Detail" value={dependentForm.detail} onChange={(event) => setDependentForm((current) => ({ ...current, detail: event.target.value }))} /></Stack></ModalBody>
        <ModalFooter><Button kind="secondary" onClick={() => setDependentOpen(false)}>Cancel</Button><Button disabled={!dependentForm.name.trim()} onClick={submitDependent}>Add dependent</Button></ModalFooter>
      </ComposedModal>

      <ComposedModal open={reportOpen} onClose={() => setReportOpen(false)} size="sm">
        <ModalHeader title="Report unauthorized access" />
        <ModalBody><TextArea id="unauthorized-report" labelText="What happened?" value={reportSummary} onChange={(event) => setReportSummary(event.target.value)} /></ModalBody>
        <ModalFooter><Button kind="secondary" onClick={() => setReportOpen(false)}>Cancel</Button><Button disabled={!reportSummary.trim()} onClick={submitReport}>Submit report</Button></ModalFooter>
      </ComposedModal>
    </main>
  );
}

function AdminAccessPage({
  canManageRoles,
  canManageUsers,
}: {
  canManageRoles: boolean;
  canManageUsers: boolean;
}) {
  const [overview, setOverview] = useState<AccessControlOverview | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [roleDraft, setRoleDraft] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getAccessControlOverview();
      setOverview(data);
      setSelectedRoleId((current) => current || data.roles[0]?.id || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load access control.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const selectedRole = overview?.roles.find((role) => role.id === selectedRoleId) || overview?.roles[0] || null;

  useEffect(() => {
    if (selectedRole) setRoleDraft(selectedRole.permissions);
  }, [selectedRole]);

  const permissionGroups = overview
    ? [...new Set(overview.permissionCatalog.map((permission) => permission.group))]
      .map((group) => ({
        group,
        permissions: overview.permissionCatalog.filter((permission) => permission.group === group),
      }))
    : [];
  const activeAdmins = overview?.users.filter((user) => user.status === 'Active' && user.permissions.includes('admin.access.manage')).length || 0;
  const isRoleDirty = Boolean(selectedRole) && [...roleDraft].sort().join('|') !== [...(selectedRole?.permissions || [])].sort().join('|');

  const togglePermission = (permissionId: string) => {
    setRoleDraft((current) => current.includes(permissionId)
      ? current.filter((item) => item !== permissionId)
      : [...current, permissionId]);
  };

  const saveRole = async () => {
    if (!selectedRole) return;
    setIsSavingRole(true);
    setNotice('');
    setError('');
    try {
      const nextOverview = await updateRolePermissions(selectedRole.id, roleDraft);
      setOverview(nextOverview);
      setNotice(`${selectedRole.label} permissions updated.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update role.');
    } finally {
      setIsSavingRole(false);
    }
  };

  const saveUserAccess = async (userId: string, roles: string[], status: AccessStatus) => {
    const nextOverview = await updateUserAccess(userId, roles, status);
    setOverview(nextOverview);
    setNotice('User access updated.');
  };

  if (isLoading) return <section className="settings-configuration admin-page"><InlineLoading description="Loading configuration" /></section>;

  return (
    <section className="settings-configuration admin-page" aria-label="Settings configuration">
      <section className="records-title admin-title">
        <div>
          <p>Settings / <strong>Configuration</strong></p>
          <h1>Configuration</h1>
          <span>Configure role permissions, user assignments, account status, and audit review from the Settings workspace.</span>
        </div>
      </section>

      {notice && <p className="workspace-notice">{notice}</p>}
      {error && <InlineNotification kind="error" lowContrast title="Access control issue" subtitle={error} />}

      {overview && (
        <>
          <section className="access-summary">
            <article><span>Roles</span><strong>{overview.roles.length}</strong></article>
            <article><span>Users</span><strong>{overview.users.length}</strong></article>
            <article><span>Active access admins</span><strong>{activeAdmins}</strong></article>
            <article><span>Permissions</span><strong>{overview.permissionCatalog.length}</strong></article>
          </section>

          <section className="access-shell">
            <aside className="role-list">
              <h2>Roles</h2>
              {overview.roles.map((role) => (
                <button className={role.id === selectedRole?.id ? 'active' : ''} type="button" key={role.id} onClick={() => setSelectedRoleId(role.id)}>
                  <strong>{role.label}</strong>
                  <span>{role.userCount || 0} user{role.userCount === 1 ? '' : 's'}</span>
                </button>
              ))}
            </aside>

            <section className="role-editor">
              {selectedRole && (
                <>
                  <header>
                    <div>
                      <h2>{selectedRole.label}</h2>
                      <p>{selectedRole.description}</p>
                    </div>
                    <button className="primary-action" type="button" disabled={!canManageRoles || !isRoleDirty || isSavingRole} onClick={saveRole}>
                      {isSavingRole ? 'Saving...' : canManageRoles ? 'Save Permissions' : 'View Only'}
                    </button>
                  </header>
                  <div className="permission-groups">
                    {permissionGroups.map(({ group, permissions }) => (
                      <fieldset key={group}>
                        <legend>{group}</legend>
                        {permissions.map((permission) => (
                          <label key={permission.id}>
                            <input
                              type="checkbox"
                              checked={roleDraft.includes(permission.id)}
                              disabled={!canManageRoles || (selectedRole.id === 'admin' && permission.id.startsWith('admin.'))}
                              onChange={() => togglePermission(permission.id)}
                            />
                            <span><strong>{permission.label}</strong><small>{permission.description}</small></span>
                          </label>
                        ))}
                      </fieldset>
                    ))}
                  </div>
                </>
              )}
            </section>
          </section>

          <section className="user-access-panel">
            <header><h2>User Access</h2><span>{canManageUsers ? 'Role and status changes are audited.' : 'View-only access'}</span></header>
            <div className="portal-table-wrap">
              <table>
                <thead><tr><th>User</th><th>Assigned roles</th><th>Status</th><th>Effective access</th><th>Action</th></tr></thead>
                <tbody>
                  {overview.users.map((user) => (
                    <UserAccessRow
                      key={user.id}
                      user={user}
                      roles={overview.roles}
                      canManage={canManageUsers}
                      onSave={saveUserAccess}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="access-audit">
            <header><h2>Audit Trail</h2><span>Latest {overview.auditLog.length} events</span></header>
            {overview.auditLog.length ? overview.auditLog.map((event) => (
              <article key={event.id}>
                <strong>{event.summary}</strong>
                <span>{event.actorName} - {formatAuditTime(event.createdAt)}</span>
              </article>
            )) : <p className="empty-appointments">No access-control changes have been recorded yet.</p>}
          </section>
        </>
      )}
    </section>
  );
}

function UserAccessRow({
  user,
  roles,
  canManage,
  onSave,
}: {
  user: AccessControlOverview['users'][number];
  roles: AccessRole[];
  canManage: boolean;
  onSave: (userId: string, roles: string[], status: AccessStatus) => Promise<void>;
}) {
  const [selectedRoles, setSelectedRoles] = useState(user.roles);
  const [status, setStatus] = useState<AccessStatus>(user.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedRoles(user.roles);
    setStatus(user.status);
  }, [user.roles, user.status]);

  const dirty = [...selectedRoles].sort().join('|') !== [...user.roles].sort().join('|') || status !== user.status;

  const toggleRole = (roleId: string) => {
    setSelectedRoles((current) => current.includes(roleId)
      ? current.filter((item) => item !== roleId)
      : [...current, roleId]);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(user.id, selectedRoles, status);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update user access.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td><strong>{user.fullName}</strong><small>{user.email}</small></td>
      <td>
        <div className="user-role-checks">
          {roles.map((role) => (
            <label key={role.id}>
              <input type="checkbox" disabled={!canManage} checked={selectedRoles.includes(role.id)} onChange={() => toggleRole(role.id)} />
              <span>{role.label}</span>
            </label>
          ))}
        </div>
      </td>
      <td>
        <select disabled={!canManage} value={status} onChange={(event) => setStatus(event.target.value as AccessStatus)}>
          <option>Active</option>
          <option>Suspended</option>
        </select>
      </td>
      <td><span>{user.permissions.length} permission{user.permissions.length === 1 ? '' : 's'}</span>{error && <small className="composer-error">{error}</small>}</td>
      <td><button type="button" disabled={!canManage || !dirty || !selectedRoles.length || saving} onClick={save}>{saving ? 'Saving...' : 'Save'}</button></td>
    </tr>
  );
}

function formatAuditTime(value: string) {
  if (!value) return 'Unknown time';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function medicationSummaryFromPortal(portal: PortalData) {
  return {
    activeMedications: portal.prescriptions.filter((item) => item.status === 'Active' || item.status === 'Refill Due').length,
    dueForRefill: portal.prescriptions.filter((item) => item.status === 'Refill Due').length,
    pendingRequests: portal.medicationRequests.filter((item) => item.status === 'Pending').length + portal.refillRequests.filter((item) => item.status === 'Queued').length,
  };
}

function PortalApp({ onLogout }: { onLogout: () => void }) {
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState<PortalRoute>(getHashRoute);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [reschedulingAppointmentId, setReschedulingAppointmentId] = useState('');
  const [visitForm, setVisitForm] = useState(initialVisitForm);
  const [messageForm, setMessageForm] = useState(initialMessageForm);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getPortalData()
      .then((data) => setPortal(data))
      .catch((error: Error) => {
        if (error.message === 'Authentication required') {
          onLogout();
          return;
        }
        setLoadError(error.message);
      })
      .finally(() => setIsLoading(false));
  }, [onLogout]);

  useEffect(() => {
    const updateRoute = () => setRoute(getHashRoute());
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  const navigate = useCallback((nextRoute: PortalRoute) => {
    location.hash = nextRoute;
    setRoute(nextRoute);
  }, []);

  useEffect(() => {
    if (!portal) return;
    if (!canAccessRoute(route, portal.access.permissions)) {
      navigate(firstAllowedRoute(portal.access.permissions));
    }
  }, [navigate, portal, route]);

  const refreshPortal = useCallback(async () => {
    const refreshedPortal = await getPortalData();
    setPortal(refreshedPortal);
    return refreshedPortal;
  }, []);

  const openBooking = useCallback((preset: Partial<typeof initialVisitForm> = {}, appointmentId = '') => {
    const nextDate = preset.date || preset.preferredDate || initialVisitForm.date;
    setFormError('');
    setReschedulingAppointmentId(appointmentId);
    setVisitForm({
      ...initialVisitForm,
      ...preset,
      date: nextDate,
      preferredDate: nextDate,
    });
    setBookingOpen(true);
  }, []);

  const openMessage = useCallback((subject = initialMessageForm.subject, body = '') => {
    setFormError('');
    setMessageForm({ subject, body });
    setMessageOpen(true);
  }, []);

  const handleVisitSubmit = async () => {
    const date = visitForm.date.trim() || visitForm.preferredDate.trim();
    const missingFields = [
      ['service', visitForm.service],
      ['department', visitForm.department],
      ['provider', visitForm.provider],
      ['date', date],
      ['time', visitForm.time],
      ['reason', visitForm.reason],
    ].filter(([, value]) => !String(value).trim()).map(([field]) => field);

    if (missingFields.length) {
      setFormError(`Missing required scheduling fields: ${missingFields.join(', ')}.`);
      return;
    }
    const requiredPermission = reschedulingAppointmentId ? 'appointments.manage' : 'appointments.request';
    if (!portal || !hasPermission(portal.access.permissions, requiredPermission)) {
      setFormError(reschedulingAppointmentId ? 'You do not have permission to reschedule appointments.' : 'You do not have permission to request appointments.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      const payload = {
        ...visitForm,
        date,
        preferredDate: date,
      };
      if (reschedulingAppointmentId) {
        await rescheduleAppointment(reschedulingAppointmentId, {
          date: payload.date,
          time: payload.time,
          provider: payload.provider,
          department: payload.department,
          notes: payload.notes || payload.reason,
        });
      } else {
        await createVisitRequest(payload);
        await scheduleAppointment(payload);
      }
      await refreshPortal();
      setBookingOpen(false);
      setReschedulingAppointmentId('');
      setVisitForm(initialVisitForm);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not send appointment request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMessageSubmit = async () => {
    if (!messageForm.subject.trim() || !messageForm.body.trim()) {
      setFormError('Subject and message are required.');
      return;
    }
    if (!portal || !hasPermission(portal.access.permissions, 'messages.send')) {
      setFormError('You do not have permission to send messages.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      await sendMessage(messageForm.subject, messageForm.body);
      await refreshPortal();
      setMessageOpen(false);
      setMessageForm(initialMessageForm);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThreadReply = async (conversationId: string, body: string) => {
    await sendConversationMessage(conversationId, body);
    await refreshPortal();
  };

  const handleThreadAttachment = async (conversationId: string) => {
    const uploaded = await uploadFileMetadata({
      fileName: `secure-message-attachment-${new Date().toISOString().slice(0, 10)}.pdf`,
      category: 'Secure message attachment',
      size: '128 KB',
      source: 'patient portal',
      relatedId: conversationId,
    });
    await sendConversationAttachment(conversationId, `Attached ${uploaded.fileName}.`, {
      fileName: uploaded.fileName,
      size: uploaded.size,
    });
    await refreshPortal();
  };

  const handleConversationResolve = async (conversationId: string, resolved: boolean) => {
    await resolveConversation(conversationId, resolved);
    await refreshPortal();
  };

  const handleAppointmentCancel = async (appointmentId: string) => {
    await cancelAppointment(appointmentId);
    await refreshPortal();
  };

  const handleAppointmentReschedule = async (appointmentId: string) => {
    const appointment = portal?.appointments.find((item) => item.id === appointmentId);
    const slot = portal?.appointmentSlots.find((item) => item.status === 'Available' && (!appointment?.department || item.department === appointment.department))
      || portal?.appointmentSlots.find((item) => item.status === 'Available');
    openBooking({
      service: appointment?.service || initialVisitForm.service,
      department: appointment?.department || initialVisitForm.department,
      provider: appointment?.provider || appointment?.clinician || initialVisitForm.provider,
      date: slot?.date || appointment?.date || initialVisitForm.date,
      preferredDate: slot?.date || appointment?.date || initialVisitForm.preferredDate,
      time: slot?.time || appointment?.time || initialVisitForm.time,
      location: appointment?.location || initialVisitForm.location,
      reason: appointment?.reason || `Reschedule ${appointment?.service || 'appointment'}`,
      notes: appointment?.notes || 'Rescheduled from the patient portal',
    }, appointmentId);
  };

  const handleAppointmentDetail = async (appointmentId: string) => {
    const detail = await getAppointmentDetail(appointmentId);
    openPrintableView('Appointment Details', detail);
  };

  const handleAppointmentsExport = async (status: 'upcoming' | 'past' | 'cancelled', provider: string) => {
    const payload = await getAppointmentsExport(status, provider);
    openPrintableView('Appointments Export', payload);
  };

  const handlePrescriptionRefill = async (prescriptionId: string) => {
    await requestPrescriptionRefill(prescriptionId);
    await refreshPortal();
  };

  const handleMedicationRequest = async (medicationName: string, notes: string) => {
    await requestNewMedication(medicationName, notes);
    await refreshPortal();
  };

  const handlePreferredPharmacy = async (input: ReturnType<typeof defaultPharmacyForm>) => {
    await updatePreferredPharmacy(input);
    await refreshPortal();
  };

  const handlePrintablePrescriptions = async () => {
    const payload = await getPrintablePrescriptions();
    openPrintableView('Prescription List', payload);
  };

  const handleMedicationLeaflet = async (prescriptionId: string) => {
    const payload = await getMedicationLeaflet(prescriptionId);
    openPrintableView('Medication Leaflet', payload);
  };

  const handleInteractionCheck = async (medicationName: string) => {
    const payload = await checkDrugInteractions(medicationName);
    await refreshPortal();
    return payload;
  };

  const handleBalancePayment = async (input: BillingPaymentInput = {}) => {
    if (input.invoiceId && input.amount !== undefined) {
      await payInvoice(input.invoiceId, input.amount, input.paymentMethodId);
    } else {
      await payFullBalance(input.paymentMethodId);
    }
    await refreshPortal();
  };

  const handlePaymentMethodCreate = async (input: BillingPaymentMethodInput) => {
    const method = await addBillingPaymentMethod(input);
    await refreshPortal();
    return method;
  };

  const handleBillingStatement = async () => {
    const statement = await getBillingStatement();
    openPrintableView('Billing Statement', statement);
  };

  const handleInvoiceDetail = async (invoiceId: string) => {
    const invoice = await getInvoiceDetail(invoiceId);
    openPrintableView(`Invoice ${invoiceId}`, invoice);
  };

  const handleBillingResource = async (resourceId: string) => {
    const resource = await getBillingResource(resourceId);
    openPrintableView('Billing Resource', resource);
  };

  const handlePaymentSession = async (invoiceId?: string) => {
    const session = await createPaymentSession(invoiceId);
    openPrintableView('Payment Session', session);
  };

  const handleProfileSave = async (profileSettings: ProfileSettings) => {
    await saveProfileSettings(profileSettings);
    await refreshPortal();
  };

  const handleInsuranceSave = async (insurance: PortalData['insuranceDetails']) => {
    await updateInsuranceDetails(insurance);
    await refreshPortal();
  };

  const handleEmergencyContactSave = async (contact: Omit<EmergencyContact, 'id'>, contactId?: string) => {
    if (contactId) {
      await updateEmergencyContact(contactId, contact);
    } else {
      await addEmergencyContact(contact);
    }
    await refreshPortal();
  };

  const handleEmergencyContactDelete = async (contactId: string) => {
    await deleteEmergencyContact(contactId);
    await refreshPortal();
  };

  const handleFileUpload = async (category: string, relatedId?: string) => {
    const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'portal-file';
    await uploadFileMetadata({
      fileName: `${slug}-${new Date().toISOString().slice(0, 10)}.pdf`,
      category,
      size: '256 KB',
      source: 'patient portal',
      relatedId,
    });
    await refreshPortal();
  };

  const handleRecordExport = async () => {
    const printable = await getPrintableRecord();
    openPrintableView('Printable Health Record', printable);
  };

  const handleDocumentDetail = async (documentId: string) => {
    const detail = await getDocumentDetail(documentId);
    openPrintableView('Clinical Document', detail);
  };

  const handlePatientNote = async (input: { title: string; text: string; type?: string }) => {
    await addPatientNote(input);
    await refreshPortal();
  };

  const handleLabDetail = async (lab: LabResult) => {
    const detail = await getLabDetail(lab.id || labKey(lab.label));
    openPrintableView(`Lab Narrative: ${lab.label}`, detail);
  };

  const handleTrendsExport = async (range: string) => {
    const trendsExport = await getTrendsExport(range);
    openPrintableView('Health Trends Export', trendsExport);
  };

  const handleReferralRequest = async (input: { provider?: string; specialty: string; reason: string; clinic?: string }) => {
    await requestReferral(input);
    await refreshPortal();
  };

  const handleReferralAction = async (referralId: string, action: string, note?: string) => {
    await updateReferralAction(referralId, action, note);
    await refreshPortal();
  };

  const handleReferralExport = async () => {
    const referralExport = await getReferralExport();
    openPrintableView('Referral Report', referralExport);
  };

  const handleReferralDetail = async (referralId: string) => {
    const detail = await getReferralDetail(referralId);
    openPrintableView('Referral Detail', detail);
  };

  const handleResourceInteraction = async (resourceId: string, action: string) => {
    await recordResourceInteraction(resourceId, action);
    await refreshPortal();
  };

  const handleResourceDetail = async (resourceId: string) => {
    const detail = await getResourceDetail(resourceId);
    openPrintableView('Educational Resource', detail);
  };

  const handlePrintableImmunizations = async () => {
    const printable = await getPrintableImmunizations();
    openPrintableView('Official Immunization Record', printable);
  };

  const handleImmunizationDetail = async (recordId: string) => {
    const detail = await getImmunizationDetail(recordId);
    openPrintableView('Immunization Detail', detail);
  };

  const handleShareRecordsChange = async (input: { shareRecords?: boolean; mentalHealthNotes?: boolean }) => {
    await updateFamilyPrivacy(input);
    await refreshPortal();
  };

  const handleInviteProxy = async (input: { name: string; relationship: string; permissions: string }) => {
    await inviteProxy(input);
    await refreshPortal();
  };

  const handleProxyPermissionChange = async (proxyId: string, permissions: string) => {
    await updateProxyPermissions(proxyId, permissions);
    await refreshPortal();
  };

  const handleResendProxy = async (proxyId: string) => {
    await resendProxyInvite(proxyId);
    await refreshPortal();
  };

  const handleRevokeProxy = async (proxyId: string) => {
    await revokeProxy(proxyId);
    await refreshPortal();
  };

  const handleAddDependent = async (input: { name: string; relationship: string; detail?: string; access?: string }) => {
    await addDependent(input);
    await refreshPortal();
  };

  const handleAccessPolicy = async () => {
    const policy = await getAccessPolicy();
    openPrintableView('Proxy Access Policy', policy);
  };

  const handleUnauthorizedReport = async (summary: string) => {
    await reportUnauthorizedAccess({ summary });
    await refreshPortal();
  };

  const handleNotifications = () => {
    if (!portal) return;
    openPrintableView('Portal Notifications', {
      summary: {
        unreadMessages: portal.dashboard.summary.unreadMessages,
        refillsDue: portal.dashboard.summary.refillsDue,
        upcomingAppointments: portal.dashboard.summary.appointmentsUpcoming,
        outstandingBalance: portal.dashboard.summary.outstandingBalance,
      },
      pendingAppointmentRequests: portal.appointmentRequests,
      recentActivity: portal.dashboard.recentActivity,
      latestLabResults: portal.dashboard.latestLabResults,
    });
  };

  const handleHelp = () => {
    openPrintableView('Patient Portal Help', {
      supportChannels: [
        { topic: 'Appointments', action: 'Use Schedule New Appointment or Contact Support from Appointments.' },
        { topic: 'Messages', action: 'Use Compose Message to start a secure thread with the care team.' },
        { topic: 'Billing', action: 'Use Speak with Support from Billing for payment plans or invoice questions.' },
        { topic: 'Configuration', action: 'Open Settings, then Configuration for role and user access control.' },
      ],
      localLimitations: [
        'Uploads store metadata in the local JSON backend.',
        'Printable views use the browser print workflow.',
        'Payments are local demo transactions recorded in the JSON store.',
      ],
    });
  };

  const handleConversationActions = (conversation: MessageConversation) => {
    openPrintableView('Conversation Summary', {
      id: conversation.id,
      participant: conversation.participantName,
      role: conversation.participantRole,
      subject: conversation.subject,
      resolved: conversation.resolved,
      unread: conversation.unread,
      messages: conversation.messages,
    });
  };

  if (isLoading) return <main className="app-loading"><InlineLoading description="Loading patient portal" /></main>;
  if (loadError || !portal) return <main className="app-loading"><InlineNotification kind="error" title="Could not load portal" subtitle={loadError || 'The API did not return portal data.'} /></main>;

  const currentPatient = portal.dashboard.patient;
  const permissions = portal.access.permissions;
  const activeRoute = canAccessRoute(route, permissions) ? route : firstAllowedRoute(permissions);
  const canRequestAppointments = hasPermission(permissions, 'appointments.request');
  const canManageAppointments = hasPermission(permissions, 'appointments.manage');
  const canSendMessages = hasPermission(permissions, 'messages.send');
  const canResolveMessages = hasPermission(permissions, 'messages.resolve');
  const canRequestRefills = hasPermission(permissions, 'prescriptions.refill');
  const canRequestMedication = hasPermission(permissions, 'prescriptions.request');
  const canPayBills = hasPermission(permissions, 'billing.pay');
  const canManagePaymentMethods = hasPermission(permissions, 'billing.paymentMethods.manage');
  const canUpdateProfile = hasPermission(permissions, 'profile.update');
  const canManageFamilyAccess = hasPermission(permissions, 'family.manage');
  const canManageReferrals = hasPermission(permissions, 'referrals.manage');
  const canConfigureAccess = hasPermission(permissions, 'admin.access.view');
  const canManageRoles = hasPermission(permissions, 'admin.access.manage');
  const canManageUsers = hasPermission(permissions, 'admin.users.manage');
  const providerOptions = portal.providers.length ? portal.providers : [{
    id: 'default-provider',
    name: initialVisitForm.provider,
    department: initialVisitForm.department,
    role: 'Provider',
    location: initialVisitForm.location,
    available: true,
  }];
  const departmentOptions = Array.from(new Set(providerOptions.map((provider) => provider.department).filter(Boolean)));
  const slotOptions = portal.appointmentSlots.filter((slot) => slot.status === 'Available');
  const canSubmitBooking = reschedulingAppointmentId ? canManageAppointments : canRequestAppointments;
  const closeBooking = () => {
    setBookingOpen(false);
    setReschedulingAppointmentId('');
    setFormError('');
  };

  return (
    <div className="portal-app">
      <PortalHeader route={activeRoute} onNavigate={navigate} onNotifications={handleNotifications} onHelp={handleHelp} patientName={currentPatient.name} permissions={permissions} />
      <div className="portal-frame">
        <PortalSidebar route={activeRoute} onNavigate={navigate} onLogout={onLogout} patient={currentPatient} permissions={permissions} />
        {activeRoute === 'records' && (
          <RecordsPage
            portal={portal}
            onBookConsult={(reason) => openBooking({
              service: 'Clinical consult',
              department: providerOptions[0]?.department || initialVisitForm.department,
              provider: providerOptions[0]?.name || initialVisitForm.provider,
              location: providerOptions[0]?.location || initialVisitForm.location,
              reason,
            })}
            onAddNote={handlePatientNote}
            onExport={handleRecordExport}
            onUpload={(category) => handleFileUpload(category)}
            onLabDetail={handleLabDetail}
            onDocumentDetail={handleDocumentDetail}
          />
        )}
        {activeRoute === 'appointments' && (
          <AppointmentsPageLive
            appointments={portal.appointments}
            appointmentRequests={portal.appointmentRequests}
            onBook={() => openBooking()}
            onCancel={handleAppointmentCancel}
            onReschedule={handleAppointmentReschedule}
            onDetail={handleAppointmentDetail}
            onExport={handleAppointmentsExport}
            onSupport={() => openMessage('Appointment support', 'I need help with an appointment change.')}
            canRequest={canRequestAppointments}
            canManage={canManageAppointments}
          />
        )}
        {activeRoute === 'messages' && (
          <MessagesPageLive
            conversations={portal.messageConversations}
            onSend={handleThreadReply}
            onAttach={handleThreadAttachment}
            onResolve={handleConversationResolve}
            onCompose={() => openMessage()}
            onMoreActions={handleConversationActions}
            canSend={canSendMessages}
            canResolve={canResolveMessages}
          />
        )}
        {activeRoute === 'prescriptions' && (
          <PrescriptionsPage
            preferredPharmacy={portal.preferredPharmacy}
            medicationSummary={medicationSummaryFromPortal(portal)}
            prescriptions={portal.prescriptions}
            refillRequestIds={portal.refillRequests.map((request) => request.prescriptionId)}
            onRefill={handlePrescriptionRefill}
            onRequestMedication={handleMedicationRequest}
            onChangePharmacy={handlePreferredPharmacy}
            onStartMessage={openMessage}
            onPrintList={handlePrintablePrescriptions}
            onViewLeaflet={handleMedicationLeaflet}
            onCheckInteraction={handleInteractionCheck}
            canRefill={canRequestRefills}
            canRequestMedication={canRequestMedication}
          />
        )}
        {activeRoute === 'billing' && (
          <BillingPage
            billing={portal.billing}
            onPay={handleBalancePayment}
            onAddPaymentMethod={handlePaymentMethodCreate}
            onStatement={handleBillingStatement}
            onInvoice={handleInvoiceDetail}
            onResource={handleBillingResource}
            onPaymentSession={handlePaymentSession}
            onSupport={() => openMessage('Billing support', 'I need help with a bill or payment plan.')}
            canPay={canPayBills}
            canManagePaymentMethods={canManagePaymentMethods}
          />
        )}
        {activeRoute === 'resources' && <ResourcesPage resources={portal.educationalResources} onInteraction={handleResourceInteraction} onDetail={handleResourceDetail} />}
        {activeRoute === 'family' && (
          <FamilyAccessPage
            familyAccess={portal.familyAccess}
            shareRecords={portal.preferences.shareRecords}
            mentalHealthNotes={Boolean(portal.preferences.mentalHealthNotes)}
            onShareRecordsChange={handleShareRecordsChange}
            onInviteProxy={handleInviteProxy}
            onProxyPermissionChange={handleProxyPermissionChange}
            onResendProxy={handleResendProxy}
            onRevokeProxy={handleRevokeProxy}
            onAddDependent={handleAddDependent}
            onDownloadPolicy={handleAccessPolicy}
            onReportUnauthorized={handleUnauthorizedReport}
            canManage={canManageFamilyAccess}
          />
        )}
        {activeRoute === 'referrals' && (
          <ReferralsPage
            referrals={portal.referrals}
            canManage={canManageReferrals}
            onRequest={handleReferralRequest}
            onAction={handleReferralAction}
            onExport={handleReferralExport}
            onDetail={handleReferralDetail}
          />
        )}
        {activeRoute === 'immunizations' && <ImmunizationsPage records={portal.immunizationRecords} onBook={() => openBooking({ service: 'Immunization visit', department: 'Primary Care', reason: 'Immunization appointment' })} onDownload={handlePrintableImmunizations} onDetail={handleImmunizationDetail} canBook={canRequestAppointments} />}
        {activeRoute === 'trends' && <HealthTrendsPage trends={portal.healthTrends} onExport={handleTrendsExport} />}
        {activeRoute === 'settings' && (
          <ProfileSettingsPage
            profile={portal.profileSettings}
            accountStatus={portal.accountStatus}
            insuranceDetails={portal.insuranceDetails}
            emergencyContacts={portal.emergencyContacts}
            onSave={handleProfileSave}
            onInsuranceSave={handleInsuranceSave}
            onContactSave={handleEmergencyContactSave}
            onContactDelete={handleEmergencyContactDelete}
            onUploadInsurance={() => handleFileUpload('Insurance card')}
            canUpdate={canUpdateProfile}
            canConfigureAccess={canConfigureAccess}
            canManageRoles={canManageRoles}
            canManageUsers={canManageUsers}
          />
        )}
        {activeRoute === 'dashboard' && <Dashboard portal={portal} onBook={() => openBooking()} onNavigate={navigate} onPrintRecord={handleRecordExport} canBook={canRequestAppointments} />}
      </div>

      <ComposedModal open={bookingOpen} onClose={closeBooking} size="sm">
        <ModalHeader title={reschedulingAppointmentId ? 'Reschedule appointment' : 'Schedule new appointment'} />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="visit-service" labelText="Service" value={visitForm.service} onChange={(event) => setVisitForm((current) => ({ ...current, service: event.target.value }))} />
            <label className="modal-field-select" htmlFor="visit-department">
              <span>Department</span>
              <select id="visit-department" value={visitForm.department} onChange={(event) => setVisitForm((current) => ({ ...current, department: event.target.value }))}>
                {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
            </label>
            <label className="modal-field-select" htmlFor="visit-provider">
              <span>Provider</span>
              <select
                id="visit-provider"
                value={visitForm.provider}
                onChange={(event) => {
                  const provider = providerOptions.find((item) => item.name === event.target.value);
                  setVisitForm((current) => ({
                    ...current,
                    provider: event.target.value,
                    department: provider?.department || current.department,
                    location: provider?.location || current.location,
                  }));
                }}
              >
                {providerOptions.map((provider) => <option key={provider.id} value={provider.name}>{provider.name} - {provider.department}</option>)}
              </select>
            </label>
            <TextInput id="visit-date" labelText="Date" placeholder="Nov 08, 2023" value={visitForm.date} onChange={(event) => setVisitForm((current) => ({ ...current, date: event.target.value, preferredDate: event.target.value }))} />
            <label className="modal-field-select" htmlFor="visit-time">
              <span>Time</span>
              <select id="visit-time" value={visitForm.time} onChange={(event) => setVisitForm((current) => ({ ...current, time: event.target.value }))}>
                {[visitForm.time, ...slotOptions.map((slot) => slot.time), '9:00 AM', '10:30 AM', '2:00 PM'].filter((time, index, list) => time && list.indexOf(time) === index).map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </label>
            <TextInput id="visit-location" labelText="Location" value={visitForm.location} onChange={(event) => setVisitForm((current) => ({ ...current, location: event.target.value }))} />
            <TextInput id="visit-reason" labelText="Reason for visit" value={visitForm.reason} onChange={(event) => setVisitForm((current) => ({ ...current, reason: event.target.value }))} />
            <TextArea id="visit-notes" labelText="Notes for care team" value={visitForm.notes} onChange={(event) => setVisitForm((current) => ({ ...current, notes: event.target.value }))} />
            {formError && <InlineNotification kind="error" lowContrast title="Cannot send request" subtitle={formError} />}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={closeBooking}>Cancel</Button>
          <Button onClick={handleVisitSubmit} disabled={!canSubmitBooking || isSubmitting}>{!canSubmitBooking ? 'Restricted' : isSubmitting ? 'Sending...' : reschedulingAppointmentId ? 'Reschedule' : 'Send request'}</Button>
        </ModalFooter>
      </ComposedModal>

      <ComposedModal open={messageOpen} onClose={() => setMessageOpen(false)} size="sm">
        <ModalHeader title="Message my doctor" />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="message-subject" labelText="Subject" value={messageForm.subject} onChange={(event) => setMessageForm((current) => ({ ...current, subject: event.target.value }))} />
            <TextArea id="message-body" labelText="Message" value={messageForm.body} onChange={(event) => setMessageForm((current) => ({ ...current, body: event.target.value }))} />
            {formError && <InlineNotification kind="error" lowContrast title="Cannot send message" subtitle={formError} />}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setMessageOpen(false)}>Cancel</Button>
          <Button onClick={handleMessageSubmit} disabled={!canSendMessages || isSubmitting}>{!canSendMessages ? 'Restricted' : isSubmitting ? 'Sending...' : 'Send message'}</Button>
        </ModalFooter>
      </ComposedModal>
    </div>
  );
}

export default PortalApp;
