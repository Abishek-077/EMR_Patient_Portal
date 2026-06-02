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
  Calendar,
  Chat,
  Document,
  Download,
  Home,
  Hospital,
  Logout,
  Medication,
  Notification,
  Renew,
  Search,
  Settings,
  TaskComplete,
  TestTool,
  UserAvatar,
} from '@carbon/icons-react';
import {
  createVisitRequest,
  getPortalData,
  sendMessage,
} from './api';
import type { PortalData } from './types';

type PortalRoute = 'dashboard' | 'records';

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

const menuItems = [
  { label: 'Dashboard', route: 'dashboard' as const, icon: Home },
  { label: 'Health Records', route: 'records' as const, icon: Document },
  { label: 'Appointments', icon: Calendar },
  { label: 'Messages', icon: Chat },
  { label: 'Prescriptions', icon: Medication },
  { label: 'Billing', icon: Hospital },
  { label: 'Resources', icon: Document },
  { label: 'Family Access', icon: UserAvatar },
];

function getHashRoute(): PortalRoute {
  return location.hash === '#records' ? 'records' : 'dashboard';
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
        <button type="button">Messages</button>
      </nav>
      <label className="o3-search">
        <Search size={16} />
        <input aria-label="Search portal" placeholder={route === 'records' ? 'Search records...' : 'Search portal...'} />
      </label>
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
          {route === 'records' ? <img src="/assets/patient-profile.png" alt="" /> : <UserAvatar size={25} />}
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
        <button type="button"><Settings size={20} /><span>Settings</span></button>
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

  if (isLoading) return <main className="app-loading"><InlineLoading description="Loading patient portal" /></main>;
  if (loadError || !portal) return <main className="app-loading"><InlineNotification kind="error" title="Could not load portal" subtitle={loadError || 'The API did not return portal data.'} /></main>;

  return (
    <div className="portal-app">
      <PortalHeader route={route} onNavigate={navigate} />
      <div className="portal-frame">
        <PortalSidebar route={route} onNavigate={navigate} onLogout={onLogout} />
        {route === 'records'
          ? <RecordsPage />
          : <Dashboard onBook={() => setBookingOpen(true)} onMessage={() => setMessageOpen(true)} onNavigate={navigate} />}
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
