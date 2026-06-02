import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  ComposedModal,
  DatePicker,
  DatePickerInput,
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
  createVisitRequest,
  getPortalData,
  payFullBalance,
  requestNewMedication,
  requestPrescriptionRefill,
  saveProfileSettings,
  sendMessage,
} from './api';
import type { BillingData, PortalData, Prescription, ProfileSettings } from './types';

type PortalRoute = 'dashboard' | 'records' | 'appointments' | 'messages' | 'prescriptions' | 'billing' | 'settings';

const initialVisitForm = {
  reason: 'Annual physical',
  preferredDate: '',
  notes: '',
};

const initialMessageForm = {
  subject: 'Question for Dr. Wilson',
  body: '',
};

const dashboardLabs = [
  { name: 'Glucose, Fasting', value: '94 mg/dL', range: '65 - 99 mg/dL', status: 'NORMAL', tone: 'normal' },
  { name: 'Cholesterol, Total', value: '210 mg/dL', range: '< 200 mg/dL', status: 'HIGH', tone: 'high' },
  { name: 'Hemoglobin A1c', value: '5.4 %', range: '4.8 - 5.6 %', status: 'NORMAL', tone: 'normal' },
  { name: 'Vitamin D, 25-OH', value: '28 ng/mL', range: '30 - 100 ng/mL', status: 'LOW', tone: 'low' },
];

const appointments = [
  { day: '31', month: 'OCT', title: 'Annual Physical', doctor: 'Dr. James Wilson', detail: '09:30 AM - Health Center 1', tone: 'blue' },
  { day: '14', month: 'NOV', title: 'Dental Cleaning', doctor: 'Dr. Emily Chen', detail: '02:15 PM - Suite 405', tone: 'gray' },
];

const activity = [
  { icon: Document, tone: 'blue', title: 'Medical Record Updated:', text: 'Visit summary from Cardiology Consultation is now available.', time: 'Today, 10:45 AM' },
  { icon: TaskComplete, tone: 'green', title: 'Prescription Refilled:', text: 'Lisinopril 10mg is ready for pickup at Main Pharmacy.', time: 'Yesterday, 4:20 PM' },
  { icon: Chat, tone: 'purple', title: 'New Message:', text: 'Dr. Wilson replied to your query about recent labs.', time: 'Oct 25, 11:15 AM' },
];

const clinicalNotes = [
  { type: 'Follow-up Visit', date: 'Oct 12, 2023', title: 'Post-operative Management', text: 'Patient reports significant reduction in abdominal pain. Surgical incision site is healing well with no signs of infection or erythema...' },
  { type: 'Telehealth', date: 'Sep 28, 2023', title: 'Medication Review', text: 'Discussed adjustment to Metformin dosage. Patient experiencing mild GI distress. Suggested evening dosing with food. Monitoring...' },
];

const recordLabs = [
  { name: 'Complete Blood Count', detail: 'Panel Analysis', value: 'Normal', status: 'Verified', tone: 'normal', date: 'Oct 14' },
  { name: 'Serum Creatinine', detail: 'Chemistry', value: '1.4 mg/dL', status: 'High', tone: 'high', date: 'Oct 14' },
  { name: 'Urinalysis', detail: 'Routine', value: 'Pending', status: 'In Lab', tone: 'neutral', date: 'Oct 23' },
  { name: 'Lipid Profile', detail: 'Annual Review', value: 'Optimal', status: 'Verified', tone: 'normal', date: 'Sep 15' },
];

const immunizations = [
  { title: 'Influenza (Seasonal)', last: 'Last: Oct 02, 2023', doses: '2 doses', status: 'Up to date', tone: 'green' },
  { title: 'COVID-19 Booster', last: 'Last: Jan 15, 2023', doses: '3 doses', status: 'Due Jan 2024', tone: 'yellow' },
  { title: 'Tetanus (Tdap)', last: 'Last: Aug 12, 2019', doses: '1 dose', status: 'Up to date', tone: 'green' },
];

const conversations = [
  { name: 'Dr. Sarah Jenkins', time: '10:24 AM', subject: 'Lab Results Follow-up', preview: 'I have reviewed your blood work from Mon...', active: true },
  { name: 'Nursing Team', time: 'Yesterday', subject: 'Prescription Refill Request', preview: 'Your request for Lipitor has been sent to the...', unread: true },
  { name: 'Dr. Michael Chen', time: 'Oct 12', subject: 'Follow-up: Surgery Prep', preview: 'Please remember to fast for 12 hours prior t...' },
  { name: 'Billing Department', time: 'Oct 10', subject: 'Statement Available', preview: 'Your October billing statement is now availa...' },
];

const appointmentRows = [
  { date: 'Oct 26, 2023', time: '10:30 AM (Thursday)', initials: 'SJ', provider: 'Dr. Sarah Jenkins', department: 'Cardiology', location: 'Main Clinic, Suite 402', action: 'Details', secondary: 'Cancel' },
  { date: 'Nov 02, 2023', time: '02:15 PM (Thursday)', initials: 'RM', provider: 'Dr. Robert Miller', department: 'Gastroenterology', location: 'West Wing, Room 12-B', action: 'Details', secondary: 'Cancel' },
  { date: 'Nov 15, 2023', time: '08:00 AM (Wednesday)', initials: 'LW', provider: 'Lab Technician', department: 'Diagnostics', location: 'Central Lab, Floor 1', action: 'Instructions', secondary: 'Reschedule' },
];

const menuItems = [
  { label: 'Dashboard', route: 'dashboard' as const, icon: Home },
  { label: 'Health Records', route: 'records' as const, icon: Document },
  { label: 'Appointments', route: 'appointments' as const, icon: Calendar },
  { label: 'Messages', route: 'messages' as const, icon: Chat },
  { label: 'Prescriptions', route: 'prescriptions' as const, icon: Medication },
  { label: 'Billing', route: 'billing' as const, icon: Money },
  { label: 'Resources', icon: Document },
  { label: 'Family Access', icon: UserAvatar },
];

function getHashRoute(): PortalRoute {
  if (location.hash === '#records') return 'records';
  if (location.hash === '#appointments') return 'appointments';
  if (location.hash === '#messages') return 'messages';
  if (location.hash === '#prescriptions') return 'prescriptions';
  if (location.hash === '#billing') return 'billing';
  if (location.hash === '#settings') return 'settings';
  return 'dashboard';
}

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return <button className="icon-button" type="button" aria-label={label} title={label}>{children}</button>;
}

function PortalHeader({
  route,
  onNavigate,
}: {
  route: PortalRoute;
  onNavigate: (route: PortalRoute) => void;
}) {
  return (
    <header className="o3-header">
      <strong>OpenMRS O3</strong>
      <nav aria-label="Primary navigation">
        <button className={route === 'dashboard' ? 'active' : ''} type="button" onClick={() => onNavigate('dashboard')}>Dashboard</button>
        <button className={route === 'records' ? 'active' : ''} type="button" onClick={() => onNavigate('records')}>Records</button>
        <button className={route === 'messages' ? 'active' : ''} type="button" onClick={() => onNavigate('messages')}>Messages</button>
      </nav>
      {route !== 'messages' && (
        <label className="o3-search">
          <Search size={16} />
          <input aria-label="Search portal" placeholder={route === 'records' ? 'Search records...' : 'Search...'} />
        </label>
      )}
      <div className="o3-header-actions">
        <IconButton label="Notifications"><Notification size={20} /></IconButton>
        <IconButton label="Help"><span className="header-symbol">?</span></IconButton>
        <IconButton label="Settings"><Settings size={20} /></IconButton>
        <img src="/assets/patient-profile.png" alt="Sarah profile" />
      </div>
    </header>
  );
}

function PortalSidebar({
  route,
  onNavigate,
  onLogout,
}: {
  route: PortalRoute;
  onNavigate: (route: PortalRoute) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="portal-sidebar">
      <div className="sidebar-profile">
        <div className="sidebar-avatar">
          {route === 'records' || route === 'messages' ? <img src="/assets/patient-profile.png" alt="" /> : <UserAvatar size={25} />}
        </div>
        <div>
          <strong>Patient Portal</strong>
          <span>Health ID: 100-234-567</span>
        </div>
      </div>
      <nav className="sidebar-menu" aria-label="Portal sections">
        {menuItems.map(({ label, route: itemRoute, icon: Icon }) => (
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
        <button className={route === 'settings' ? 'active' : ''} type="button" onClick={() => onNavigate('settings')}><Settings size={20} /><span>Settings</span></button>
        <button type="button" onClick={onLogout}><Logout size={20} /><span>Logout</span></button>
      </div>
    </aside>
  );
}

function Dashboard({
  onBook,
  onMessage,
  onNavigate,
}: {
  onBook: () => void;
  onMessage: () => void;
  onNavigate: (route: PortalRoute) => void;
}) {
  return (
    <main className="portal-main dashboard-page">
      <section className="page-title dashboard-title">
        <div>
          <h1>Welcome back, Sarah</h1>
          <p>Your health overview for Friday, October 27, 2023</p>
        </div>
        <div className="page-actions">
          <button className="secondary-action" type="button"><Download size={16} /> Print Record</button>
          <button className="primary-action" type="button" onClick={onBook}><Add size={16} /> New Request</button>
        </div>
      </section>

      <section className="quick-grid" aria-label="Quick actions">
        <button className="quick-card quick-card--blue" type="button" onClick={onMessage}>
          <Chat size={29} />
          <strong>Message my Doctor</strong>
          <span>Last message: Oct 20</span>
        </button>
        <button className="quick-card" type="button">
          <Medication size={29} />
          <strong>Refill Prescriptions</strong>
          <span>2 refills available</span>
        </button>
        <button className="quick-card quick-card--gray" type="button" onClick={() => onNavigate('records')}>
          <Document size={29} />
          <strong>View Records</strong>
          <span>Updated 2 days ago</span>
        </button>
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
              {dashboardLabs.map((lab) => (
                <tr key={lab.name}>
                  <td>{lab.name}</td>
                  <td className={lab.tone === 'high' ? 'result-high' : ''}><strong>{lab.value}</strong></td>
                  <td><small>{lab.range}</small></td>
                  <td><span className={`status-pill status-pill--${lab.tone}`}>{lab.status}</span></td>
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
            {appointments.map((appointment) => (
              <article className={`appointment-card appointment-card--${appointment.tone}`} key={appointment.title}>
                <time><strong>{appointment.day}</strong><span>{appointment.month}</span></time>
                <div>
                  <h3>{appointment.title}</h3>
                  <p>{appointment.doctor}</p>
                  <a href="#dashboard">{appointment.detail}</a>
                </div>
              </article>
            ))}
          </div>
          <button className="wide-secondary" type="button" onClick={onBook}>Schedule New Appointment</button>
        </section>

        <section className="o3-panel activity-panel">
          <div className="panel-heading"><h2><Renew size={22} /> Recent Activity</h2></div>
          <div className="activity-list">
            {activity.map(({ icon: Icon, tone, title, text, time }) => (
              <article className="activity-row" key={title}>
                <span className={`activity-icon activity-icon--${tone}`}><Icon size={18} /></span>
                <div>
                  <p><strong>{title}</strong> {text}</p>
                  <small>{time}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="vitals-grid" aria-label="Recent vital signs">
          <article className="vital-card"><span>Blood Pressure</span><strong>118/76<small> mmHg</small></strong><i><b style={{ width: '60%' }} /></i><em>Optimal</em></article>
          <article className="vital-card"><span>Heart Rate</span><strong>72<small> BPM</small></strong><i><b style={{ width: '45%' }} /></i><em>Normal</em></article>
          <article className="vital-card"><span>Weight</span><strong>164<small> lbs</small></strong><p>-2 lbs since last visit</p></article>
          <article className="vital-card"><span>BMI</span><strong>24.2</strong><em>Healthy range</em></article>
        </section>
      </div>
    </main>
  );
}

function TrendChart() {
  return (
    <div className="trend-chart" aria-label="Blood pressure trend">
      <div className="chart-tabs"><button className="active" type="button">Blood Pressure</button><button type="button">Weight</button><button type="button">Glucose</button></div>
      <svg viewBox="0 0 640 220" role="img" aria-label="Stable blood pressure trend chart">
        <polyline points="35,145 145,132 255,141 365,114 475,122 585,96" fill="none" stroke="#0f62fe" strokeWidth="4" />
        {[['35','145'], ['145','132'], ['255','141'], ['365','114'], ['475','122'], ['585','96']].map(([cx, cy]) => <circle cx={cx} cy={cy} fill="#0f62fe" key={`${cx}-${cy}`} r="6" />)}
      </svg>
      <div className="trend-tooltip">
        <strong>Last Reading: 120/80<br />mmHg</strong>
        <span>Stable Trend - Oct 14, 2023</span>
      </div>
    </div>
  );
}

function RecordsPage() {
  return (
    <main className="portal-main records-page">
      <section className="records-title">
        <div>
          <h1>Health Records</h1>
          <p>Comprehensive clinical summary including longitudinal vital trends, laboratory results, and documented patient history.</p>
        </div>
        <div className="page-actions">
          <button className="secondary-action" type="button"><Download size={16} /> Export PDF</button>
          <button className="primary-action" type="button"><Add size={16} /> Add Note</button>
        </div>
      </section>

      <div className="records-grid">
        <section className="records-trends">
          <h2><Renew size={22} /> Health Trends</h2>
          <TrendChart />
        </section>
        <aside className="observations-panel">
          <h2>Critical Observations</h2>
          <article className="observation observation--red"><strong>High Blood Glucose</strong><span>Reported 2 hours post-prandial: 184 mg/dL</span></article>
          <article className="observation observation--yellow"><strong>Upcoming Lab: HbA1c</strong><span>Due in 3 days. Patient notified.</span></article>
          <div className="records-sync"><span>Last Update</span><strong>10:45 AM, Oct 24, 2023</strong><a href="#records">Syncing with Central Registry...</a></div>
        </aside>

        <section className="clinical-notes">
          <div className="records-subheading"><h2>Clinical Notes</h2><a href="#records">View All History</a></div>
          {clinicalNotes.map((note) => (
            <article className="note-card" key={note.date}>
              <div><span>{note.type}</span><time>{note.date}</time></div>
              <h3>{note.title}</h3>
              <p>{note.text}</p>
            </article>
          ))}
        </section>

        <section className="record-labs">
          <div className="records-subheading"><h2>Laboratory Results</h2><span>Filter &nbsp; &#8942;</span></div>
          <table>
            <thead><tr><th>Test Name</th><th>Result</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {recordLabs.map((lab) => (
                <tr key={lab.name}>
                  <td>{lab.name}<small>{lab.detail}</small></td>
                  <td className={lab.tone === 'high' ? 'result-high' : ''}><strong>{lab.value}</strong></td>
                  <td><span className={`status-pill status-pill--${lab.tone}`}>{lab.status}</span></td>
                  <td>{lab.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="immunization-panel">
          <h2>Immunization History</h2>
          <div className="immunization-grid">
            {immunizations.map((item) => (
              <article className="immunization-card" key={item.title}>
                <div><span><Medication size={22} /></span><small>{item.doses}</small></div>
                <strong>{item.title}</strong>
                <p>{item.last}</p>
                <i><b className={`bar--${item.tone}`} style={{ width: item.tone === 'green' ? '100%' : '72%' }} /></i>
                <em className={`text--${item.tone}`}>{item.status}</em>
              </article>
            ))}
            <button className="log-immunization" type="button"><Add size={22} /> Log New Immunization</button>
          </div>
        </section>
      </div>
      <button className="floating-add" aria-label="Add record" title="Add record" type="button"><Add size={27} /></button>
    </main>
  );
}

function MessagesPage({ onSend }: { onSend: (body: string) => Promise<void> }) {
  const [reply, setReply] = useState('');
  const [sentReplies, setSentReplies] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const handleSend = async () => {
    const message = reply.trim();
    if (!message) return;
    setIsSending(true);
    setSendError('');
    try {
      await onSend(message);
      setSentReplies((current) => [...current, message]);
      setReply('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="messages-page">
      <section className="conversation-pane">
        <div className="conversation-tools">
          <div><h1>Messages</h1><IconButton label="Compose message"><Edit size={25} /></IconButton></div>
          <label><input aria-label="Search conversations" placeholder="Search conversations..." /><Search size={23} /></label>
        </div>
        <div className="conversation-list">
          {conversations.map((conversation) => (
            <button className={`conversation-row ${conversation.active ? 'active' : ''}`} key={conversation.name} type="button">
              <span><strong>{conversation.name}</strong>{conversation.unread && <i />}</span>
              <time>{conversation.time}</time>
              <b>{conversation.subject}</b>
              <small>{conversation.preview}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="message-thread">
        <header className="thread-heading">
          <img src="/assets/clinician-sarah-jenkins.png" alt="Dr. Sarah Jenkins" />
          <div>
            <h2>Dr. Sarah Jenkins</h2>
            <p><i /> Internal Medicine - Active Now</p>
          </div>
          <button className="secondary-action" type="button">Mark as Resolved</button>
          <IconButton label="More conversation actions"><OverflowMenuVertical size={22} /></IconButton>
        </header>
        <div className="thread-body">
          <time className="thread-date">Monday, October 14, 2024</time>
          <article className="outbound-bubble">
            <p>Hello Dr. Jenkins, I received my blood test results on the portal this morning. Most values seem normal, but I noticed my LDL cholesterol is higher than it was last year. Should I be concerned or adjust my medication?</p>
            <time>9:15 AM <span>✓✓</span></time>
          </article>
          <article className="inbound-bubble">
            <div className="lab-reference"><strong>Lab Result Reference</strong><span>Lipid Panel (LDL) <b>142 mg/dL</b></span></div>
            <p>I have reviewed your blood work from Monday and noticed the slight increase as well. At 142 mg/dL, it is above our target for you, but not in the critical range yet. I'd like to try adjusting your diet for the next 3 months before we consider increasing your Atorvastatin dosage.</p>
            <p>I've attached a Mediterranean diet guide that has shown great success with my patients. Let's schedule a follow-up lab in January.</p>
            <button className="message-attachment" type="button">
              <Document size={24} />
              <span>Dietary_Guidelines_Lipid_Control.pdf<small>2.4 MB</small></span>
              <Download size={22} />
            </button>
            <time>10:24 AM</time>
          </article>
          {sentReplies.map((message, index) => (
            <article className="outbound-bubble sent-reply" key={`${message}-${index}`}>
              <p>{message}</p>
              <time>Just now <span>✓</span></time>
            </article>
          ))}
        </div>
        <div className="thread-composer">
          <div className="composer-tools">
            <strong>B</strong><em>I</em><span>☷</span>
            <IconButton label="Attach file"><Attachment size={20} /></IconButton>
          </div>
          <textarea aria-label="Message reply" placeholder="Type a secure message..." value={reply} onChange={(event) => setReply(event.target.value)} />
          <div className="composer-footer">
            {sendError ? <span className="composer-error">{sendError}</span> : <span>Secure message to Dr. Sarah Jenkins</span>}
            <button className="primary-action" type="button" disabled={isSending || !reply.trim()} onClick={handleSend}>
              {isSending ? 'Sending...' : 'Send'} <Send size={20} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function AppointmentsPage({ onBook }: { onBook: () => void }) {
  const [tab, setTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [providerFilter, setProviderFilter] = useState('');
  const visibleRows = tab === 'upcoming'
    ? appointmentRows.filter((appointment) => appointment.provider.toLowerCase().includes(providerFilter.trim().toLowerCase()))
    : [];

  return (
    <main className="portal-main appointments-page">
      <section className="appointments-title">
        <div>
          <p>Patient Portal <span>/</span> Appointments</p>
          <h1>Appointments Management <b>3 Upcoming</b></h1>
        </div>
        <button className="primary-action" type="button" onClick={onBook}><Add size={18} /> Schedule New Appointment</button>
      </section>

      <section className="appointments-summary">
        <article><span>Next Visit</span><strong>Tomorrow, 10:30 AM</strong><p>Dr. Sarah Jenkins - Cardiology</p></article>
        <article><span>Pending Requests</span><strong>1 Request</strong><p>Lab Work - Awaiting approval</p></article>
        <article><span>Last Visit</span><strong>Oct 12, 2023</strong><p>Annual Physical - General Medicine</p></article>
        <article><span>Fast Actions</span><div><button type="button">Reschedule</button><button type="button">Cancel</button></div></article>
      </section>

      <section className="appointments-table-panel">
        <div className="appointments-table-tools">
          <nav aria-label="Appointment status">
            <button className={tab === 'upcoming' ? 'active' : ''} type="button" onClick={() => setTab('upcoming')}>Upcoming</button>
            <button className={tab === 'past' ? 'active' : ''} type="button" onClick={() => setTab('past')}>Past Visits</button>
            <button className={tab === 'cancelled' ? 'active' : ''} type="button" onClick={() => setTab('cancelled')}>Cancelled</button>
          </nav>
          <label><input aria-label="Filter by provider" placeholder="Filter by provider..." value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} /><Filter size={18} /></label>
          <IconButton label="Download appointments"><Download size={21} /></IconButton>
        </div>
        <div className="appointments-table-wrap">
          <table>
            <thead><tr><th>Date & Time</th><th>Provider</th><th>Department</th><th>Location</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleRows.map((appointment) => (
                <tr key={appointment.date}>
                  <td><strong>{appointment.date}</strong><span>{appointment.time}</span></td>
                  <td><i>{appointment.initials}</i> {appointment.provider}</td>
                  <td><b>{appointment.department}</b></td>
                  <td><Location size={17} /> {appointment.location}</td>
                  <td><button type="button">{appointment.action}</button><em /> <button type="button">{appointment.secondary}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleRows.length && <p className="empty-appointments">No {tab} appointments match this view.</p>}
        </div>
        <footer><span>Showing {visibleRows.length ? `1 - ${visibleRows.length}` : '0'} of {tab === 'upcoming' ? '12' : '0'} appointments</span><span>Items per page: 10 &nbsp; ‹ &nbsp; ›</span></footer>
      </section>

      <aside className="reschedule-note">
        <Information size={28} />
        <p><strong>Need to reschedule within 24 hours?</strong><span>For urgent changes or appointments within the next 24 hours, please contact the clinic directly at +1 (555) 010-9988.</span></p>
        <button className="secondary-action" type="button">Contact Support</button>
      </aside>
    </main>
  );
}

function PrescriptionsPage({
  prescriptions,
  refillRequestIds,
  onRefill,
  onRequestMedication,
}: {
  prescriptions: Prescription[];
  refillRequestIds: string[];
  onRefill: (prescriptionId: string) => Promise<void>;
  onRequestMedication: (medicationName: string, notes: string) => Promise<void>;
}) {
  const [pendingRefill, setPendingRefill] = useState('');
  const [notice, setNotice] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [medicationName, setMedicationName] = useState('');
  const [notes, setNotes] = useState('');
  const [requestingMedication, setRequestingMedication] = useState(false);

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

  return (
    <main className="portal-main prescriptions-page">
      <section className="prescriptions-title">
        <div><h1>Active Prescriptions</h1><p>Manage your current medications and refill requests.</p></div>
        <div className="page-actions">
          <button className="primary-action" type="button" onClick={() => setRequestOpen(true)}><Add size={18} /> Request New Medication</button>
          <button className="secondary-action" type="button"><Printer size={17} /> Print List</button>
        </div>
      </section>

      {notice && <p className="workspace-notice">{notice}</p>}

      <section className="pharmacy-summary">
        <article>
          <div><span>Preferred Pharmacy</span><button type="button"><Edit size={15} /> Change</button></div>
          <a href="#prescriptions">CVS Pharmacy #04322</a>
          <p>123 Health Ave, Medical District<br />Boston, MA 02115</p>
          <footer><p><span>Phone</span><strong>(617) 555-0199</strong></p><p><span>Hours</span><strong>Open 24 Hours</strong></p></footer>
        </article>
        <aside>
          <h2>Medication Summary</h2>
          <p><span>Active Medications</span><strong>06</strong></p>
          <p><span>Due for Refill</span><strong className="text-red">02</strong></p>
          <p><span>Pending Requests</span><strong>01</strong></p>
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
                        disabled={prescription.status === 'Pending Request' || requested || pendingRefill === prescription.id}
                        onClick={() => handleRefill(prescription.id)}
                      >
                        {requested || prescription.status === 'Pending Request' ? 'Pending' : pendingRefill === prescription.id ? 'Sending...' : 'Refill'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer><span>Showing 1-5 of 12 prescriptions</span><span>‹ &nbsp; Page 1 of 3 &nbsp; ›</span></footer>
      </section>

      <aside className="safety-note"><Information size={25} /><p><strong>Safety Information</strong><span>Always consult with your doctor before starting or stopping any medications. If you experience severe side effects, please contact your primary care provider or visit the nearest emergency department immediately.</span></p></aside>

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
    </main>
  );
}

function BillingPage({ billing, onPay }: { billing: BillingData; onPay: () => Promise<void> }) {
  const [invoiceFilter, setInvoiceFilter] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState('');
  const invoices = billing.invoices.filter((invoice) => invoiceFilter === 'All' || invoice.status === invoiceFilter);

  const handlePayment = async () => {
    setPaying(true);
    try {
      await onPay();
      setNotice('Your full outstanding balance has been paid.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <main className="portal-main billing-page">
      <section className="billing-title"><h1>Billing & Payments</h1><p>Review your medical statements, track invoice history, and manage payment methods.</p></section>
      {notice && <p className="workspace-notice">{notice}</p>}

      <div className="billing-top-grid">
        <section className="balance-panel">
          <div><span>Total Outstanding Balance</span>{billing.paymentStatus === 'Due' ? <b>Payment Due: Oct 25</b> : <b className="paid-label">Paid in Full</b>}</div>
          <strong>${billing.outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
          <div className="balance-breakdown">
            <p><span>Consultation</span><strong>$450.00</strong></p><p><span>Laboratory</span><strong>$320.50</strong></p><p><span>Radiology</span><strong>$478.00</strong></p><p><span>Pharmacy</span><strong>$0.00</strong></p>
          </div>
          <footer><button className="primary-action" type="button" disabled={billing.outstandingBalance === 0 || paying} onClick={handlePayment}><Money size={19} /> {paying ? 'Processing...' : billing.outstandingBalance === 0 ? 'Balance Paid' : 'Pay Full Balance'}</button><button className="secondary-action" type="button"><Report size={19} /> View Statement</button></footer>
        </section>
        <section className="payment-methods">
          <h2>Payment Methods</h2>
          {billing.paymentMethods.map((method) => (
            <article key={method.id}>{method.type === 'Card' ? <Wallet size={22} /> : <Building size={22} />}<p><strong>{method.label}</strong><span>{method.detail}</span></p>{method.isDefault && <b>Default</b>}</article>
          ))}
          <button type="button"><Add size={20} /> Add New Method</button>
        </section>
      </div>

      <section className="invoice-panel">
        <header><h2>Invoice History</h2><div>{(['All', 'Paid', 'Pending'] as const).map((filter) => <button className={invoiceFilter === filter ? 'active' : ''} type="button" key={filter} onClick={() => setInvoiceFilter(filter)}>{filter}</button>)}<label><Search size={15} /><input aria-label="Search invoices" placeholder="Search invoices..." /></label></div></header>
        <div className="invoice-table-wrap">
          <table><thead><tr><th>Invoice ID</th><th>Date</th><th>Service / Description</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.id}</td><td>{invoice.date}</td><td>{invoice.description}</td><td>${invoice.amount.toFixed(2)}</td><td><span className={`invoice-status invoice-status--${invoice.status.toLowerCase()}`}>● {invoice.status}</span></td><td>{invoice.status === 'Overdue' ? <button type="button" onClick={handlePayment}>Pay Now</button> : invoice.status === 'Paid' ? <button type="button"><Download size={14} /> PDF</button> : <button type="button">Details</button>}</td></tr>)}
          </tbody></table>
        </div>
        <footer><span>Showing 1-{invoices.length} of 24 invoices</span><span>‹ &nbsp; <b>1</b> &nbsp; 2 &nbsp; 3 &nbsp; ›</span></footer>
      </section>

      <section className="billing-resources">
        <article><Document size={23} /><p><strong>Tax Form 1095-B</strong><span>2023 Annual Report</span></p></article>
        <article><Security size={23} /><p><strong>Insurance Policy</strong><span>Current: BlueShield Gold</span></p></article>
        <aside><h3>Need help with your bill?</h3><p>Contact our financial counselors for payment plans or insurance disputes.</p><button type="button">Speak with Support</button></aside>
      </section>
      <button className="billing-qr" aria-label="Open billing QR code" title="Open billing QR code" type="button"><QrCode size={22} /></button>
    </main>
  );
}

const emergencyContacts = [
  { name: 'Sarah Smith', relationship: 'Spouse', primaryPhone: '(555) 012-9988', alternatePhone: '—', access: 'Full Proxy' },
  { name: 'Robert Wilson', relationship: 'Close Friend', primaryPhone: '(555) 123-4567', alternatePhone: '(555) 765-4321', access: 'Emergency Only' },
];

function ProfileSettingsPage({ profile, onSave }: { profile: ProfileSettings; onSave: (profile: ProfileSettings) => Promise<void> }) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => setForm(profile), [profile]);
  const update = (field: keyof ProfileSettings, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      setNotice('Profile changes saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="portal-main profile-settings-page">
      <section className="settings-title"><div><p>Settings / <strong>Profile Settings</strong></p><h1>Profile Settings</h1><span>Update your personal information, insurance details, and emergency contacts.</span></div><div className="page-actions"><button className="secondary-action" type="button" onClick={() => setForm(profile)}>Discard changes</button><button className="primary-action" type="button" disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save Profile'}</button></div></section>
      {notice && <p className="workspace-notice">{notice}</p>}

      <section className="profile-settings-shell">
        <div className="personal-info">
          <h2><UserProfile size={19} /> Personal Information</h2>
          <div className="profile-field-grid">
            <label><span>Full Name</span><input aria-label="Full Name" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} /></label>
            <label><span>Email Address</span><input aria-label="Email Address" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
            <label><span>Phone Number</span><input aria-label="Phone Number" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
            <label><span>Date of Birth</span><input aria-label="Date of Birth" value={form.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} /></label>
            <label className="wide"><span>Residential Address</span><input aria-label="Residential Address" value={form.address} onChange={(event) => update('address', event.target.value)} /></label>
            <label><span>Preferred Language</span><select aria-label="Preferred Language" value={form.language} onChange={(event) => update('language', event.target.value)}><option>English (US)</option><option>Spanish</option></select></label>
            <label><span>Timezone</span><select aria-label="Timezone" value={form.timezone} onChange={(event) => update('timezone', event.target.value)}><option>(GMT-08:00) Pacific Time</option><option>(GMT-05:00) Eastern Time</option></select></label>
          </div>
        </div>
        <aside className="account-status">
          <h2><Security size={19} /> Account Status</h2>
          <p><span>Profile Completion</span><strong>92%</strong></p><p><span>2FA Security</span><b>Enabled</b></p><p><span>Last Login</span><small>Oct 24, 2023 · 08:42 AM</small></p>
          <blockquote>"Ensure your residential address is current for mailing laboratory results and official health documentation."</blockquote>
        </aside>
        <section className="insurance-details">
          <h2><Security size={19} /> Insurance Details</h2>
          <div><article><span>Primary Provider</span><a href="#settings">BlueCross BlueShield <Launch size={12} /></a><button type="button">Change <Launch size={11} /></button></article><article><span>Member ID</span><strong>BCBS-992033481</strong></article><article><span>Group Number</span><strong>TX-9001-ALPHA</strong></article><article><span>Policy Holder</span><strong>Self (Johnathan Smith)</strong></article></div>
          <p><CheckmarkOutline size={14} /> Active through 12/2024 &nbsp;&nbsp; ⓘ Verified on Oct 01, 2023</p>
        </section>
        <section className="emergency-contacts">
          <header><h2><UserProfile size={19} /> Emergency Contacts</h2><button type="button"><Add size={17} /> Add Contact</button></header>
          <div className="contacts-table-wrap"><table><thead><tr><th>Name</th><th>Relationship</th><th>Primary Phone</th><th>Alt Phone</th><th>Access Level</th><th>Actions</th></tr></thead><tbody>{emergencyContacts.map((contact) => <tr key={contact.name}><td><strong>{contact.name}</strong></td><td>{contact.relationship}</td><td>{contact.primaryPhone}</td><td>{contact.alternatePhone}</td><td><span>{contact.access}</span></td><td><button type="button" aria-label={`Edit ${contact.name}`}><Edit size={17} /></button><button type="button" aria-label={`Delete ${contact.name}`}><TrashCan size={17} /></button></td></tr>)}</tbody></table></div>
        </section>
        <footer className="profile-security-footer"><span>▣ End-to-End Encrypted Data</span><span>⌁ HIPAA Compliant Environment</span><small>Internal Build: v4.2.1-stable · Last Sync: 2 mins ago</small></footer>
      </section>
    </main>
  );
}

function PortalApp({ onLogout }: { onLogout: () => void }) {
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState<PortalRoute>(getHashRoute);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
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

  const handleVisitSubmit = async () => {
    if (!visitForm.reason.trim() || !visitForm.preferredDate.trim()) {
      setFormError('Reason and preferred date are required.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      await createVisitRequest(visitForm);
      setBookingOpen(false);
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
    setIsSubmitting(true);
    setFormError('');
    try {
      await sendMessage(messageForm.subject, messageForm.body);
      setMessageOpen(false);
      setMessageForm(initialMessageForm);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThreadReply = async (body: string) => {
    const message = await sendMessage('Lab Results Follow-up', body);
    setPortal((current) => current ? { ...current, messages: [message, ...current.messages] } : current);
  };

  const handlePrescriptionRefill = async (prescriptionId: string) => {
    const refillRequest = await requestPrescriptionRefill(prescriptionId);
    setPortal((current) => current && !current.refillRequests.some((request) => request.id === refillRequest.id)
      ? { ...current, refillRequests: [refillRequest, ...current.refillRequests] }
      : current);
  };

  const handleMedicationRequest = async (medicationName: string, notes: string) => {
    const medicationRequest = await requestNewMedication(medicationName, notes);
    setPortal((current) => current ? { ...current, medicationRequests: [medicationRequest, ...current.medicationRequests] } : current);
  };

  const handleBalancePayment = async () => {
    const billing = await payFullBalance();
    setPortal((current) => current ? { ...current, billing } : current);
  };

  const handleProfileSave = async (profileSettings: ProfileSettings) => {
    const savedProfile = await saveProfileSettings(profileSettings);
    setPortal((current) => current ? { ...current, profileSettings: savedProfile } : current);
  };

  if (isLoading) return <main className="app-loading"><InlineLoading description="Loading patient portal" /></main>;
  if (loadError || !portal) return <main className="app-loading"><InlineNotification kind="error" title="Could not load portal" subtitle={loadError || 'The API did not return portal data.'} /></main>;

  return (
    <div className="portal-app">
      <PortalHeader route={route} onNavigate={navigate} />
      <div className="portal-frame">
        <PortalSidebar route={route} onNavigate={navigate} onLogout={onLogout} />
        {route === 'records' && <RecordsPage />}
        {route === 'appointments' && <AppointmentsPage onBook={() => setBookingOpen(true)} />}
        {route === 'messages' && <MessagesPage onSend={handleThreadReply} />}
        {route === 'prescriptions' && <PrescriptionsPage prescriptions={portal.prescriptions} refillRequestIds={portal.refillRequests.map((request) => request.prescriptionId)} onRefill={handlePrescriptionRefill} onRequestMedication={handleMedicationRequest} />}
        {route === 'billing' && <BillingPage billing={portal.billing} onPay={handleBalancePayment} />}
        {route === 'settings' && <ProfileSettingsPage profile={portal.profileSettings} onSave={handleProfileSave} />}
        {route === 'dashboard' && <Dashboard onBook={() => setBookingOpen(true)} onMessage={() => navigate('messages')} onNavigate={navigate} />}
      </div>

      <ComposedModal open={bookingOpen} onClose={() => setBookingOpen(false)} size="sm">
        <ModalHeader title="Schedule new appointment" />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="visit-reason" labelText="Reason for visit" value={visitForm.reason} onChange={(event) => setVisitForm((current) => ({ ...current, reason: event.target.value }))} />
            <DatePicker datePickerType="single" onChange={(_, dateString) => setVisitForm((current) => ({ ...current, preferredDate: dateString }))}>
              <DatePickerInput id="visit-date" placeholder="mm/dd/yyyy" labelText="Preferred date" size="md" />
            </DatePicker>
            <TextArea id="visit-notes" labelText="Notes for care team" value={visitForm.notes} onChange={(event) => setVisitForm((current) => ({ ...current, notes: event.target.value }))} />
            {formError && <InlineNotification kind="error" lowContrast title="Cannot send request" subtitle={formError} />}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setBookingOpen(false)}>Cancel</Button>
          <Button onClick={handleVisitSubmit} disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send request'}</Button>
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
          <Button onClick={handleMessageSubmit} disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send message'}</Button>
        </ModalFooter>
      </ComposedModal>
    </div>
  );
}

export default PortalApp;
