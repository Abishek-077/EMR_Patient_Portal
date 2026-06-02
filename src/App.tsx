import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionItem,
  Button,
  Checkbox,
  ClickableTile,
  ComposedModal,
  Content,
  DataTableSkeleton,
  DatePicker,
  DatePickerInput,
  Grid,
  Header,
  HeaderContainer,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderMenuItem,
  HeaderName,
  HeaderNavigation,
  InlineLoading,
  InlineNotification,
  Layer,
  ModalBody,
  ModalFooter,
  ModalHeader,
  OverflowMenu,
  OverflowMenuItem,
  ProgressBar,
  Search,
  SideNav,
  SideNavItems,
  SideNavLink,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  TextArea,
  TextInput,
  Tile,
  Toggle,
} from '@carbon/react';
import {
  Add,
  Calendar,
  CaretRight,
  Chat,
  Document,
  Download,
  Home,
  Hospital,
  Medication,
  Notification,
  Phone,
  Renew,
  Search as SearchIcon,
  Settings,
  TaskComplete,
  TestTool,
  UserAvatar,
  Video,
} from '@carbon/icons-react';
import {
  createVisitRequest,
  getPortalData,
  sendMessage,
  updateShareRecords,
  updateTask,
} from './api';
import type { AppointmentRequest, PortalData, Task } from './types';

const documentHeaders = [
  { key: 'name', header: 'Document' },
  { key: 'category', header: 'Category' },
  { key: 'updated', header: 'Updated' },
  { key: 'status', header: 'Status' },
];

const initialVisitForm = {
  reason: 'Diabetes follow-up',
  preferredDate: '',
  notes: '',
};

const initialMessageForm = {
  subject: 'Question for care team',
  body: '',
};

function PriorityTag({ priority }: { priority: Task['priority'] }) {
  const type = priority === 'High' ? 'red' : priority === 'Medium' ? 'magenta' : 'gray';
  return <Tag type={type}>{priority}</Tag>;
}

function AppointmentIcon({ type }: { type: string }) {
  if (type === 'Video visit') return <Video size={20} />;
  if (type === 'Phone call') return <Phone size={20} />;
  return <Hospital size={20} />;
}

function formatCreatedAt(request: AppointmentRequest) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(request.createdAt));
}

function App() {
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [visitForm, setVisitForm] = useState(initialVisitForm);
  const [messageForm, setMessageForm] = useState(initialMessageForm);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getPortalData()
      .then((data) => {
        setPortal(data);
        setLoadError('');
      })
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }, []);

  const completion = useMemo(() => {
    if (!portal?.tasks.length) return 0;
    return Math.round((portal.tasks.filter((task) => task.completed).length / portal.tasks.length) * 100);
  }, [portal?.tasks]);

  const filteredMessages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const messages = portal?.messages ?? [];
    if (!normalizedQuery) return messages;
    return messages.filter((message) =>
      [message.from, message.subject, message.preview].some((field) =>
        field.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [portal?.messages, query]);

  if (isLoading) {
    return (
      <main className="app-loading">
        <InlineLoading description="Loading patient portal" />
      </main>
    );
  }

  if (loadError || !portal) {
    return (
      <main className="app-loading">
        <InlineNotification
          kind="error"
          title="Could not load portal"
          subtitle={loadError || 'The API did not return portal data.'}
        />
      </main>
    );
  }

  const {
    patient,
    preferences,
    tasks,
    appointments,
    appointmentRequests,
    medications,
    labResults,
    documents,
  } = portal;

  const activeMedicationCount = medications.filter((medication) => medication.status === 'Active').length;
  const flaggedResultsCount = labResults.filter((result) => result.tone === 'warning').length;
  const openTaskCount = tasks.filter((task) => !task.completed).length;
  const nextAppointment = appointments[0];

  const updatePortal = (updater: (current: PortalData) => PortalData) => {
    setPortal((current) => (current ? updater(current) : current));
  };

  const handleTaskToggle = async (taskId: string, completed: boolean) => {
    setActionError('');
    updatePortal((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, completed } : task)),
    }));

    try {
      await updateTask(taskId, completed);
    } catch (error) {
      updatePortal((current) => ({
        ...current,
        tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, completed: !completed } : task)),
      }));
      setActionError(error instanceof Error ? error.message : 'Could not update task');
    }
  };

  const handleShareToggle = async (shareRecords: boolean) => {
    setActionError('');
    updatePortal((current) => ({
      ...current,
      preferences: { ...current.preferences, shareRecords },
    }));

    try {
      await updateShareRecords(shareRecords);
    } catch (error) {
      updatePortal((current) => ({
        ...current,
        preferences: { ...current.preferences, shareRecords: !shareRecords },
      }));
      setActionError(error instanceof Error ? error.message : 'Could not update sharing preference');
    }
  };

  const handleVisitSubmit = async () => {
    if (!visitForm.reason.trim() || !visitForm.preferredDate.trim()) {
      setFormError('Reason and preferred date are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    setActionError('');

    try {
      const request = await createVisitRequest(visitForm);
      updatePortal((current) => ({
        ...current,
        appointmentRequests: [request, ...current.appointmentRequests],
      }));
      setBookingOpen(false);
      setVisitForm(initialVisitForm);
      setNotice('Appointment request sent to the care team.');
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
    setActionError('');

    try {
      const message = await sendMessage(messageForm.subject, messageForm.body);
      updatePortal((current) => ({
        ...current,
        messages: [message, ...current.messages],
      }));
      setMessageOpen(false);
      setMessageForm(initialMessageForm);
      setNotice('Message sent to the care team.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <HeaderContainer
      render={({ isSideNavExpanded, onClickSideNavExpand }) => (
        <>
          <Header aria-label="OpenMRS O3 Patient Portal">
            <HeaderMenuButton
              aria-label={isSideNavExpanded ? 'Close menu' : 'Open menu'}
              isCollapsible
              onClick={onClickSideNavExpand}
              isActive={isSideNavExpanded}
            />
            <HeaderName href="#" prefix="OpenMRS O3">
              Patient Portal
            </HeaderName>
            <HeaderNavigation aria-label="Patient portal">
              <HeaderMenuItem href="#dashboard">Home</HeaderMenuItem>
              <HeaderMenuItem href="#visits">Visits</HeaderMenuItem>
              <HeaderMenuItem href="#results">Results</HeaderMenuItem>
              <HeaderMenuItem href="#messages">Messages</HeaderMenuItem>
            </HeaderNavigation>
            <HeaderGlobalBar>
              <HeaderGlobalAction aria-label="Search">
                <SearchIcon size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction aria-label="Notifications">
                <Notification size={20} />
              </HeaderGlobalAction>
              <HeaderGlobalAction aria-label="Account">
                <UserAvatar size={20} />
              </HeaderGlobalAction>
            </HeaderGlobalBar>
            <SideNav
              aria-label="Portal navigation"
              expanded={isSideNavExpanded}
              isPersistent={false}
            >
              <SideNavItems>
                <SideNavLink href="#dashboard" renderIcon={Home}>
                  Dashboard
                </SideNavLink>
                <SideNavLink href="#visits" renderIcon={Calendar}>
                  Appointments
                </SideNavLink>
                <SideNavLink href="#medications" renderIcon={Medication}>
                  Medications
                </SideNavLink>
                <SideNavLink href="#results" renderIcon={TestTool}>
                  Lab results
                </SideNavLink>
                <SideNavLink href="#records" renderIcon={Document}>
                  Records
                </SideNavLink>
                <SideNavLink href="#messages" renderIcon={Chat}>
                  Messages
                </SideNavLink>
                <SideNavLink href="#settings" renderIcon={Settings}>
                  Settings
                </SideNavLink>
              </SideNavItems>
            </SideNav>
          </Header>

          <Content id="main-content" className="portal-shell">
            <section className="patient-banner" id="dashboard">
              <div className="patient-banner__identity">
                <Tag type="cyan">OpenMRS ID verified</Tag>
                <h1>{patient.name}</h1>
                <p>
                  {patient.age} years old - {patient.identifier} - {patient.location}
                </p>
              </div>
              <div className="patient-banner__context" aria-label="Care plan summary">
                <div>
                  <span>Active program</span>
                  <strong>{patient.primaryCondition}</strong>
                </div>
                <div>
                  <span>Care team</span>
                  <strong>{patient.careTeam}</strong>
                </div>
              </div>
              <div className="patient-banner__actions">
                <Button renderIcon={Add} onClick={() => setBookingOpen(true)}>
                  Book visit
                </Button>
                <Button kind="tertiary" renderIcon={Chat} onClick={() => setMessageOpen(true)}>
                  Message team
                </Button>
              </div>
            </section>

            {notice && (
              <InlineNotification
                className="status-alert"
                kind="success"
                lowContrast
                title="Saved"
                subtitle={notice}
                onClose={() => setNotice('')}
              />
            )}

            {actionError && (
              <InlineNotification
                className="status-alert"
                kind="error"
                lowContrast
                title="Action failed"
                subtitle={actionError}
                onClose={() => setActionError('')}
              />
            )}

            <InlineNotification
              className="care-alert"
              kind="warning"
              lowContrast
              title="Clinical follow-up recommended"
              subtitle="A1c increased from 6.9% to 7.4%. Review readings with your care team before the next visit."
            />

            <Grid fullWidth className="dashboard-grid">
              <Layer as="section" className="summary-panel">
                <Stack gap={5}>
                  <div className="section-heading">
                    <div>
                      <p>Today</p>
                      <h2>Care overview</h2>
                    </div>
                    <Button kind="ghost" size="sm" renderIcon={Download}>
                      Export
                    </Button>
                  </div>
                  <div className="metric-grid">
                    <ClickableTile href="#visits" className="metric-tile metric-tile--blue">
                      <Calendar size={24} />
                      <span>Next appointment</span>
                      <strong>{nextAppointment?.date.split(',')[0] ?? 'None'}</strong>
                      <small>{nextAppointment ? `${nextAppointment.type} with ${nextAppointment.clinician}` : 'No visit scheduled'}</small>
                    </ClickableTile>
                    <ClickableTile href="#medications" className="metric-tile metric-tile--green">
                      <Medication size={24} />
                      <span>Medication status</span>
                      <strong>{activeMedicationCount} active</strong>
                      <small>{medications.filter((medication) => medication.refill.includes('ready')).length} refill ready</small>
                    </ClickableTile>
                    <ClickableTile href="#tasks" className="metric-tile metric-tile--purple">
                      <TaskComplete size={24} />
                      <span>Care tasks</span>
                      <strong>{completion}% done</strong>
                      <small>{openTaskCount} open tasks</small>
                    </ClickableTile>
                    <ClickableTile href="#results" className="metric-tile metric-tile--orange">
                      <TestTool size={24} />
                      <span>New results</span>
                      <strong>{flaggedResultsCount} flagged</strong>
                      <small>A1c requires review</small>
                    </ClickableTile>
                  </div>
                </Stack>
              </Layer>

              <Layer as="aside" className="profile-panel">
                <div className="profile-card">
                  <div className="avatar-block">
                    <UserAvatar size={40} />
                    <div>
                      <strong>{patient.name}</strong>
                      <span>Patient access enabled</span>
                    </div>
                  </div>
                  <div className="profile-list">
                    <p>
                      <span>Insurance</span>
                      <strong>{patient.insurance}</strong>
                    </p>
                    <p>
                      <span>Preferred language</span>
                      <strong>{patient.preferredLanguage}</strong>
                    </p>
                    <p>
                      <span>Emergency contact</span>
                      <strong>{patient.emergencyContact}</strong>
                    </p>
                  </div>
                  <Toggle
                    id="share-records"
                    labelText="Share visit summary with care team"
                    toggled={preferences.shareRecords}
                    onToggle={(value) => handleShareToggle(value)}
                  />
                </div>
              </Layer>

              <Layer as="section" className="work-panel" id="tasks">
                <div className="section-heading">
                  <div>
                    <p>Care plan</p>
                    <h2>Tasks and timeline</h2>
                  </div>
                  <ProgressBar
                    className="completion-progress"
                    label={`${completion}% complete`}
                    value={completion}
                    max={100}
                    size="small"
                  />
                </div>
                <div className="task-list">
                  {tasks.map((task) => (
                    <Tile className="task-row" key={task.id}>
                      <Checkbox
                        id={task.id}
                        labelText={task.label}
                        checked={task.completed}
                        onChange={(_, { checked }) => handleTaskToggle(task.id, checked)}
                      />
                      <div className="task-row__meta">
                        <span>{task.due}</span>
                        <span>{task.owner}</span>
                        <PriorityTag priority={task.priority} />
                      </div>
                    </Tile>
                  ))}
                </div>
              </Layer>

              <Layer as="section" className="results-panel" id="results">
                <div className="section-heading">
                  <div>
                    <p>Latest observations</p>
                    <h2>Lab results</h2>
                  </div>
                  <Button kind="ghost" size="sm" renderIcon={CaretRight}>
                    View trends
                  </Button>
                </div>
                <div className="lab-grid">
                  {labResults.map((result) => (
                    <Tile className={`lab-card lab-card--${result.tone}`} key={result.label}>
                      <span>{result.label}</span>
                      <strong>
                        {result.value}
                        <small>{result.unit}</small>
                      </strong>
                      <p>{result.range}</p>
                      <div className="sparkline" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                    </Tile>
                  ))}
                </div>
              </Layer>

              <Layer as="section" className="appointments-panel" id="visits">
                <Tabs>
                  <TabList aria-label="Visit management tabs">
                    <Tab>Upcoming</Tab>
                    <Tab>Past visits</Tab>
                    <Tab>Requests</Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel>
                      <Stack gap={4}>
                        {appointments.map((appointment) => (
                          <Tile className="appointment-row" key={appointment.id}>
                            <div className="appointment-row__icon">
                              <AppointmentIcon type={appointment.type} />
                            </div>
                            <div>
                              <h3>{appointment.service}</h3>
                              <p>
                                {appointment.clinician} - {appointment.date}
                              </p>
                              <Tag type={appointment.status === 'Confirmed' ? 'green' : 'purple'}>
                                {appointment.status}
                              </Tag>
                            </div>
                            <OverflowMenu size="sm" flipped>
                              <OverflowMenuItem itemText="Reschedule" />
                              <OverflowMenuItem itemText="Add to calendar" />
                              <OverflowMenuItem hasDivider itemText="Cancel visit" isDelete />
                            </OverflowMenu>
                          </Tile>
                        ))}
                      </Stack>
                    </TabPanel>
                    <TabPanel>
                      <DataTableSkeleton columnCount={4} rowCount={3} showHeader={false} />
                    </TabPanel>
                    <TabPanel>
                      {appointmentRequests.length ? (
                        <Stack gap={4}>
                          {appointmentRequests.map((request) => (
                            <Tile className="appointment-row" key={request.id}>
                              <div className="appointment-row__icon">
                                <Calendar size={20} />
                              </div>
                              <div>
                                <h3>{request.reason}</h3>
                                <p>
                                  Preferred {request.preferredDate} - requested {formatCreatedAt(request)}
                                </p>
                                <Tag type="cyan">{request.status}</Tag>
                              </div>
                            </Tile>
                          ))}
                        </Stack>
                      ) : (
                        <InlineLoading description="No open appointment requests" status="finished" />
                      )}
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </Layer>

              <Layer as="section" className="medications-panel" id="medications">
                <div className="section-heading">
                  <div>
                    <p>Pharmacy</p>
                    <h2>Medications</h2>
                  </div>
                  <Button size="sm" kind="tertiary" renderIcon={Renew}>
                    Request refill
                  </Button>
                </div>
                <Accordion align="start">
                  {medications.map((medication) => (
                    <AccordionItem
                      key={medication.name}
                      title={`${medication.name} - ${medication.dose}`}
                    >
                      <div className="medication-detail">
                        <p>{medication.schedule}</p>
                        <Tag type={medication.status === 'Active' ? 'green' : 'gray'}>
                          {medication.status}
                        </Tag>
                        <span>{medication.refill}</span>
                      </div>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Layer>

              <Layer as="section" className="messages-panel" id="messages">
                <div className="section-heading section-heading--stacked">
                  <div>
                    <p>Inbox</p>
                    <h2>Messages</h2>
                  </div>
                  <Search
                    id="message-search"
                    labelText="Search messages"
                    placeholder="Search messages"
                    size="md"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <div className="message-list">
                  {filteredMessages.map((message) => (
                    <ClickableTile href="#messages" className="message-row" key={message.id}>
                      <div>
                        <strong>{message.from}</strong>
                        <span>{message.time}</span>
                      </div>
                      <h3>
                        {message.subject}
                        {message.outbound && <Tag type="blue">Sent</Tag>}
                      </h3>
                      <p>{message.preview}</p>
                    </ClickableTile>
                  ))}
                </div>
              </Layer>

              <Layer as="section" className="records-panel" id="records">
                <div className="section-heading">
                  <div>
                    <p>FHIR-ready exports</p>
                    <h2>Records</h2>
                  </div>
                  <Button size="sm" kind="ghost" renderIcon={Download}>
                    Download all
                  </Button>
                </div>
                <table className="records-table">
                  <thead>
                    <tr>
                      {documentHeaders.map((header) => (
                        <th key={header.key}>{header.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.category}</td>
                        <td>{row.updated}</td>
                        <td>{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Layer>
            </Grid>
          </Content>

          <ComposedModal
            open={bookingOpen}
            onClose={() => {
              setBookingOpen(false);
              setFormError('');
            }}
            size="sm"
          >
            <ModalHeader title="Book a visit" />
            <ModalBody>
              <Stack gap={5}>
                <TextInput
                  id="visit-reason"
                  labelText="Reason for visit"
                  value={visitForm.reason}
                  onChange={(event) =>
                    setVisitForm((current) => ({ ...current, reason: event.target.value }))
                  }
                />
                <DatePicker
                  datePickerType="single"
                  onChange={(_, dateString) =>
                    setVisitForm((current) => ({ ...current, preferredDate: dateString }))
                  }
                >
                  <DatePickerInput
                    id="visit-date"
                    placeholder="mm/dd/yyyy"
                    labelText="Preferred date"
                    size="md"
                  />
                </DatePicker>
                <TextArea
                  id="visit-notes"
                  labelText="Notes for care team"
                  placeholder="Share symptoms, readings, or scheduling constraints"
                  value={visitForm.notes}
                  onChange={(event) =>
                    setVisitForm((current) => ({ ...current, notes: event.target.value }))
                  }
                />
                {formError ? (
                  <InlineNotification kind="error" lowContrast title="Cannot send request" subtitle={formError} />
                ) : (
                  <InlineNotification
                    kind="info"
                    lowContrast
                    title="Care team queue"
                    subtitle="This request will be queued for care team review."
                  />
                )}
              </Stack>
            </ModalBody>
            <ModalFooter>
              <Button kind="secondary" onClick={() => setBookingOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleVisitSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send request'}
              </Button>
            </ModalFooter>
          </ComposedModal>

          <ComposedModal
            open={messageOpen}
            onClose={() => {
              setMessageOpen(false);
              setFormError('');
            }}
            size="sm"
          >
            <ModalHeader title="Message care team" />
            <ModalBody>
              <Stack gap={5}>
                <TextInput
                  id="message-subject"
                  labelText="Subject"
                  value={messageForm.subject}
                  onChange={(event) =>
                    setMessageForm((current) => ({ ...current, subject: event.target.value }))
                  }
                />
                <TextArea
                  id="message-body"
                  labelText="Message"
                  placeholder="Write a message for your care team"
                  value={messageForm.body}
                  onChange={(event) =>
                    setMessageForm((current) => ({ ...current, body: event.target.value }))
                  }
                />
                {formError && (
                  <InlineNotification kind="error" lowContrast title="Cannot send message" subtitle={formError} />
                )}
              </Stack>
            </ModalBody>
            <ModalFooter>
              <Button kind="secondary" onClick={() => setMessageOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleMessageSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send message'}
              </Button>
            </ModalFooter>
          </ComposedModal>
        </>
      )}
    />
  );
}

export default App;
