import { useCallback, useEffect, useRef, useState } from 'react';
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
  Calendar,
  Chat,
  CheckmarkOutline,
  Document,
  Download,
  Edit,
  Filter,
  Information,
  Launch,
  Location,
  Medication,
  OverflowMenuVertical,
  Printer,
  Renew,
  Search,
  Send,
  Security,
  TaskComplete,
  TestTool,
  TrashCan,
  UserProfile,
} from '@carbon/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  addBillingPaymentMethod,
  addDependent,
  addEmergencyContact,
  addImmunizationAlert,
  addImmunizationRecord,
  addVerifiedImmunization,
  addPatientNote,
  addTrendGoal,
  addTrendReading,
  archiveConversation,
  cancelAppointment,
  cancelAppointmentRequest,
  cancelMedicationRequest,
  cancelReferral,
  checkDrugInteractions,
  createInvoice,
  createPaymentSession,
  createVisitRequest,
  deleteEmergencyContact,
  deleteDependent,
  deleteFile,
  deleteImmunizationRecord,
  deleteInvoice,
  deletePatientNote,
  deleteTrendReading,
  deleteTrendGoal,
  dismissImmunizationAlert,
  downloadApiExport,
  generateStatement,
  getAccessPolicy,
  getAppointmentDetail,
  getAppointmentsExport,
  getBillingResource,
  getBillingStatement,
  getDocumentDetail,
  getImmunizationDetail,
  getInvoiceDetail,
  getLabDetail,
  getMedicationLeaflet,
  getMessageRecipients,
  getNotifications,
  getPortalData,
  getPrintableImmunizations,
  getPrintablePrescriptions,
  getPrintableRecord,
  getReferralCalendar,
  getReferralContact,
  getReferralDetail,
  getReferralExport,
  getResourceDetail,
  getResources,
  getTrendsExport,
  inviteProxy,
  markAllNotificationsRead,
  markNotificationRead,
  payFullBalance,
  payInvoice,
  recordResourceInteraction,
  reportUnauthorizedAccess,
  requestNewMedication,
  requestPrescriptionRefill,
  requestReferral,
  reviewAccessReport,
  reviewAppointmentRequest,
  reviewMedicationRequest,
  reviewRefillRequest,
  resendProxyInvite,
  rescheduleAppointment,
  resolveConversation,
  revokeProxy,
  saveProfileSettings,
  scheduleAppointment,
  selectPatientContext,
  sendConversationAttachment,
  sendConversationMessage,
  sendMessage,
  submitSupportRequest,
  setDefaultPaymentMethod,
  updateBillingPaymentMethod,
  deleteBillingPaymentMethod,
  downloadFile,
  downloadResource,
  updateDependent,
  updateEmergencyContact,
  updateFamilyPrivacy,
  updateImmunizationRecord,
  updateInsuranceDetails,
  updateInvoice,
  updateFileMetadata,
  updatePatientNote,
  updatePreferredPharmacy,
  updateProxyPermissions,
  updateReferralAction,
  updateReferralStatus,
  updateTrendGoal,
  updateTrendReading,
  updateVisitRequest,
  uploadFile,
  verifyImmunization,
} from '../../../shared/api/api';
import type { PortalNotification } from '../../../shared/api/api';
import {
  canAccessRoute,
  firstAllowedRoute,
  hasPermission,
  pathForRoute,
  routeFromPath,
} from '../../access-control';
import type { PortalRoute } from '../../access-control';
import type {
  Appointment,
  BillingInvoiceInput,
  BillingPaymentMethodInput,
  DashboardActivity,
  EmergencyContact,
  ImmunizationCompletedRecord,
  ImmunizationRecordInput,
  LabResult,
  MessageConversation,
  PortalData,
  Prescription,
  ProfileSettings,
  TrendGoal,
  TrendGoalInput,
  TrendReadingInput,
} from '../../../shared/types';
import {
  openPrintableView,
  subscribeToPrintableView,
} from '../controller/printable-view';
import type { PrintableViewRequest } from '../controller/printable-view';
import {
  defaultPharmacyForm,
  emptyEmergencyContact,
  initialMessageForm,
  initialVisitForm,
} from '../model/forms';
import {
  appointmentDateParts,
  labKey,
  labStatus,
  labTone,
  labValue,
  medicationSummaryFromPortal,
} from '../model/formatters';
import { IconButton, PortalHeader, PortalSidebar } from './layout/PortalLayout';
import { PrintablePreviewModal } from './PrintablePreviewModal';
import { AdminAccessPage } from './pages/AdminAccessPage';
import { BillingPage, type BillingPaymentInput } from './pages/BillingPage';
import {
  AccessibleFormError,
  ConfirmActionModal,
  HelpPanel,
  OperationStatus,
  StatusTag,
  WorkflowConfirmation,
  type ConfirmAction,
  type WorkflowConfirmationData,
} from './components/UXEvidenceComponents';
import { HomePage } from '../../home';
import { RegistrationPage } from '../../registration';

function activityPresentation(activity: DashboardActivity) {
  if (activity.tone === 'success') return { icon: TaskComplete, tone: 'green' };
  if (activity.tone === 'message') return { icon: Chat, tone: 'purple' };
  return { icon: Document, tone: 'blue' };
}

function formatPatientDate(value?: string) {
  if (!value) return 'Date pending';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-NP', { dateStyle: 'medium' }).format(date);
}

function quickActionIcon(target: PortalRoute) {
  if (target === 'messages') return Chat;
  if (target === 'prescriptions') return Medication;
  return Calendar;
}

function Dashboard({
  portal,
  onBook,
  onMessage,
  onRefill,
  onNavigate,
}: {
  portal: PortalData;
  onBook: () => void;
  onMessage: () => void;
  onRefill: () => void;
  onNavigate: (route: PortalRoute) => void;
}) {
  const { dashboard } = portal;
  const upcomingAppointments = dashboard.upcomingAppointments.slice(0, 2);
  const runQuickAction = (target: PortalRoute) => {
    if (target === 'appointments') onBook();
    else if (target === 'messages') onMessage();
    else onRefill();
  };

  return (
    <main
      className="portal-main dashboard-page"
      data-ux-laws="hicks-law jakobs-law millers-law von-restorff-effect"
      data-nielsen-heuristics="consistency-and-standards aesthetic-and-minimalist-design match-system-real-world"
      data-evidence-id="minimalist-dashboard"
    >
      {/* UX Law: Miller’s Law — dashboard information chunked into meaningful groups */}
      <section className="page-title dashboard-title" data-evidence-id="dashboard-welcome-summary">
        <div>
          <h1>Welcome back, {dashboard.summary.welcomeName}</h1>
          <p>Your health overview for {dashboard.summary.overviewDate}</p>
        </div>
        <div className="dashboard-health-summary" aria-label="Health summary">
          <span><strong>{dashboard.summary.appointmentsUpcoming}</strong> upcoming</span>
          <span><strong>{dashboard.summary.unreadMessages}</strong> unread</span>
          <span><strong>{dashboard.summary.refillsDue}</strong> refills due</span>
        </div>
      </section>

      <section
        className="dashboard-section"
        data-ux-laws="fitts-law hicks-law"
        data-nielsen-heuristics="flexibility-and-efficiency aesthetic-and-minimalist-design"
        data-evidence-id="dashboard-quick-actions"
      >
        {/* UX Law: Fitts’s Law — large labelled action targets */}
        <div className="dashboard-section__heading">
          <div><h2>Quick actions</h2><p>Start a common task</p></div>
          <span>3 primary actions</span>
        </div>
        <div className="quick-grid" aria-label="Quick actions">
        {dashboard.quickActions.map((action) => {
          const Icon = quickActionIcon(action.target);
          return (
            <button
              className="quick-card"
              key={action.id}
              type="button"
              disabled={!action.enabled}
              aria-describedby={!action.enabled ? `${action.id}-restriction` : undefined}
              onClick={() => runQuickAction(action.target)}
            >
              <Icon size={29} />
              <strong>{action.label}</strong>
              <span>{action.detail}</span>
              {!action.enabled && <small id={`${action.id}-restriction`}>{action.restrictedReason}</small>}
            </button>
          );
        })}
        </div>
      </section>

      <section
        className="dashboard-section attention-center"
        data-ux-law="zeigarnik-effect"
        data-nielsen-heuristic="visibility-of-system-status recognition-rather-than-recall"
        data-evidence-id="dashboard-attention-center"
      >
        {/* UX Law: Zeigarnik Effect — unresolved tasks derived from live workflow data */}
        <div className="dashboard-section__heading">
          <div><h2>Needs your attention</h2><p>Unresolved requests and balances</p></div>
          <StatusTag label={`${dashboard.attentionItems.length} open`} tone={dashboard.attentionItems.length ? 'warning' : 'success'} />
        </div>
        {dashboard.attentionItems.length ? (
          <div className="attention-list">
            {dashboard.attentionItems.map((item) => (
              <article className={`attention-item attention-item--${item.tone}`} key={item.id}>
                <div>
                  <StatusTag label={item.status} tone={item.tone} />
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                  <small>Reference {item.referenceId}</small>
                </div>
                <button type="button" onClick={() => onNavigate(item.target)}>{item.actionLabel}</button>
              </article>
            ))}
          </div>
        ) : (
          <div className="attention-empty" role="status">
            <CheckmarkOutline aria-hidden="true" size={22} />
            <p><strong>You’re all caught up.</strong> Resolved items are removed automatically.</p>
          </div>
        )}
      </section>

      <div className="dashboard-content" data-evidence-id="dashboard-status-evidence">
        <section
          className="o3-panel labs-panel"
          data-ux-law="law-of-proximity"
          data-evidence-id="dashboard-laboratory-results"
        >
          {/* UX Law: Law of Proximity — each laboratory row keeps related values together */}
          <div className="panel-heading">
            <h2><TestTool size={22} /> Recent laboratory results</h2>
            <button type="button" onClick={() => onNavigate('records')}>View all results</button>
          </div>
          <table className="lab-table">
            <thead>
              <tr><th scope="col">Test</th><th scope="col">Value</th><th scope="col">Reference range</th><th scope="col">Status</th><th scope="col">Date</th></tr>
            </thead>
            <tbody>
              {dashboard.latestLabResults.map((lab) => (
                <tr key={lab.label}>
                  <th scope="row">{lab.label}</th>
                  <td className={labTone(lab) === 'high' ? 'result-high' : ''}><strong>{labValue(lab)}</strong></td>
                  <td><small>{lab.range}</small></td>
                  <td><span className={`status-pill status-pill--${labTone(lab)}`}>{labStatus(lab)}</span></td>
                  <td>{formatPatientDate(lab.observedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="o3-panel appointment-panel" data-evidence-id="dashboard-upcoming-appointments">
          <div className="panel-heading">
            <h2><Calendar size={22} /> Upcoming appointments</h2>
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
  onSaveNote,
  onDeleteNote,
  onExport,
  onUpload,
  onDownloadFile,
  onRenameFile,
  onDeleteFile,
  onLabDetail,
  onDocumentDetail,
  canManageNotes,
  canManageFiles,
}: {
  portal: PortalData;
  onBookConsult: (reason: string) => void;
  onSaveNote: (input: { title: string; text: string; type?: string }, noteId?: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onExport: () => Promise<void>;
  onUpload: (category: string, file: File) => Promise<void>;
  onDownloadFile: (fileId: string) => Promise<void>;
  onRenameFile: (fileId: string, name: string, category: string) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
  onLabDetail: (lab: LabResult) => Promise<void>;
  onDocumentDetail: (documentId: string) => Promise<void>;
  canManageNotes: boolean;
  canManageFiles: boolean;
}) {
  const [query, setQuery] = useState('');
  const [selectedLab, setSelectedLab] = useState(portal.labResults[0]?.label || '');
  const [noteOpen, setNoteOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [recordNotice, setRecordNotice] = useState('');
  const [fileBusyId, setFileBusyId] = useState('');
  const recordUploadRef = useRef<HTMLInputElement>(null);
  const warningLabs = portal.labResults.filter((lab) => lab.tone === 'warning');
  const latestDocument = portal.documents[0];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleLabs = portal.labResults.filter((lab) => !normalizedQuery || [lab.label, lab.range, lab.unit].some((value) => value.toLowerCase().includes(normalizedQuery)));
  const visibleNotes = portal.clinicalNotes.filter((note) => !normalizedQuery || [note.title, note.type, note.text].some((value) => value.toLowerCase().includes(normalizedQuery)));
  const visibleDocuments = portal.documents.filter((document) => !normalizedQuery || [document.name, document.category, document.status].some((value) => value.toLowerCase().includes(normalizedQuery)));
  const visibleFiles = portal.uploadedFiles.filter((file) => !file.deletedAt && (!normalizedQuery || [file.fileName, file.category, file.source].some((value) => value.toLowerCase().includes(normalizedQuery))));
  const detailLab = portal.labResults.find((lab) => lab.label === selectedLab) || portal.labResults[0];

  const saveNote = async () => {
    if (!noteTitle.trim() || !noteText.trim()) return;
    setSavingNote(true);
    try {
      await onSaveNote({ title: noteTitle, text: noteText, type: 'Patient Note' }, editingNoteId || undefined);
      setNoteOpen(false);
      setEditingNoteId('');
      setNoteTitle('');
      setNoteText('');
    } finally {
      setSavingNote(false);
    }
  };

  const openAddNote = () => {
    setEditingNoteId('');
    setNoteTitle('');
    setNoteText('');
    setNoteOpen(true);
  };

  const openEditNote = (note: PortalData['clinicalNotes'][number]) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteText(note.text);
    setNoteOpen(true);
  };

  const removeNote = async (noteId: string) => {
    if (!window.confirm('Delete this patient-entered note?')) return;
    try {
      await onDeleteNote(noteId);
      setRecordNotice('Patient note deleted.');
    } catch (error) {
      setRecordNotice(error instanceof Error ? error.message : 'Could not delete note.');
    }
  };

  const pickUpload = () => recordUploadRef.current?.click();

  const handlePickedFile = async (file?: File) => {
    if (!file) return;
    setRecordNotice('');
    try {
      await onUpload('Health records upload', file);
      setRecordNotice(`${file.name} uploaded.`);
    } catch (error) {
      setRecordNotice(error instanceof Error ? error.message : 'Could not upload file.');
    } finally {
      if (recordUploadRef.current) recordUploadRef.current.value = '';
    }
  };

  const renameFile = async (file: PortalData['uploadedFiles'][number]) => {
    const name = window.prompt('New file name', file.fileName)?.trim();
    if (!name || name === file.fileName) return;
    setFileBusyId(file.id);
    try {
      await onRenameFile(file.id, name, file.category);
      setRecordNotice('File renamed.');
    } catch (error) {
      setRecordNotice(error instanceof Error ? error.message : 'Could not rename file.');
    } finally {
      setFileBusyId('');
    }
  };

  const removeFile = async (file: PortalData['uploadedFiles'][number]) => {
    if (!window.confirm(`Delete ${file.fileName}?`)) return;
    setFileBusyId(file.id);
    try {
      await onDeleteFile(file.id);
      setRecordNotice('File deleted.');
    } catch (error) {
      setRecordNotice(error instanceof Error ? error.message : 'Could not delete file.');
    } finally {
      setFileBusyId('');
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
          {canManageFiles && <input ref={recordUploadRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.csv" hidden onChange={(event) => void handlePickedFile(event.target.files?.[0])} />}
          {canManageFiles && <button className="secondary-action" type="button" onClick={pickUpload}><Attachment size={16} /> Upload File</button>}
          {canManageNotes && <button className="primary-action" type="button" onClick={openAddNote}><Add size={16} /> Add Note</button>}
        </div>
      </section>
      {recordNotice && <p className="workspace-notice" role="status">{recordNotice}</p>}
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
            <button type="button" disabled={!latestDocument} onClick={() => latestDocument && void onDocumentDetail(latestDocument.id)}>{latestDocument ? `${latestDocument.name} - ${latestDocument.status}` : 'No clinical documents available'}</button>
          </div>
        </aside>

        <section className="clinical-notes">
          <div className="records-subheading"><h2>Clinical Notes</h2><button type="button" onClick={() => setQuery('')}>View All History</button></div>
          {visibleNotes.map((note) => (
            <article className="note-card" key={note.id}>
              <div><span>{note.type}{note.provenance ? ` - ${note.provenance}` : ''}</span><time>{note.date}</time></div>
              <h3>{note.title}</h3>
              <p>{note.text}</p>
              {canManageNotes && (note.provenance === 'patient-reported' || /patient/i.test(note.type)) && !/^verified$/i.test(note.verificationStatus || '') && <div className="page-actions"><button type="button" onClick={() => openEditNote(note)}><Edit size={14} /> Edit</button><button type="button" onClick={() => void removeNote(note.id)}><TrashCan size={14} /> Delete</button></div>}
            </article>
          ))}
          {!visibleNotes.length && <p className="empty-appointments">No clinical notes match your search.</p>}
        </section>

        <section className="clinical-notes">
          <div className="records-subheading"><h2>Documents & Uploaded Files</h2><span>{visibleDocuments.length + visibleFiles.length} visible</span></div>
          {visibleDocuments.map((document) => <article className="note-card" key={document.id}><div><span>{document.category}</span><time>{document.updated}</time></div><h3>{document.name}</h3><p>{document.status}</p><button type="button" onClick={() => void onDocumentDetail(document.id)}>View details</button></article>)}
          {visibleFiles.map((file) => <article className="note-card" key={file.id}><div><span>{file.category}</span><time>{file.uploadedAt}</time></div><h3>{file.fileName}</h3><p>{file.size} - {file.source}</p>{canManageFiles && <div className="page-actions"><button type="button" onClick={() => void onDownloadFile(file.id)}><Download size={14} /> Download</button><button type="button" disabled={fileBusyId === file.id} onClick={() => void renameFile(file)}><Edit size={14} /> Rename</button><button type="button" disabled={fileBusyId === file.id} onClick={() => void removeFile(file)}><TrashCan size={14} /> Delete</button></div>}</article>)}
          {!visibleDocuments.length && !visibleFiles.length && <p className="empty-appointments">No documents or files match your search.</p>}
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
            {canManageFiles && <button className="log-immunization" type="button" onClick={pickUpload}><Add size={22} /> Upload Immunization Record</button>}
          </div>
        </section>
      </div>
      {canManageNotes && <button className="floating-add" aria-label="Add record" title="Add record" type="button" onClick={openAddNote}><Add size={27} /></button>}

      <ComposedModal open={noteOpen} onClose={() => setNoteOpen(false)} size="sm">
        <ModalHeader title={editingNoteId ? 'Edit patient note' : 'Add patient note'} />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="patient-note-title" labelText="Note title" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} />
            <TextArea id="patient-note-text" labelText="Note" value={noteText} onChange={(event) => setNoteText(event.target.value)} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setNoteOpen(false)}>Cancel</Button>
          <Button disabled={!noteTitle.trim() || !noteText.trim() || savingNote} onClick={saveNote}>{savingNote ? 'Saving...' : editingNoteId ? 'Update note' : 'Save note'}</Button>
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
  onArchive,
  onDownloadAttachment,
  onCompose,
  onMoreActions,
  canSend,
  canResolve,
}: {
  conversations: MessageConversation[];
  onSend: (conversationId: string, body: string) => Promise<void>;
  onAttach: (conversationId: string, file: File) => Promise<void>;
  onResolve: (conversationId: string, resolved: boolean) => Promise<void>;
  onArchive: (conversationId: string) => Promise<void>;
  onDownloadAttachment: (fileId: string) => Promise<void>;
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
  const attachmentInputRef = useRef<HTMLInputElement>(null);

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

  const handleAttach = async (file?: File) => {
    if (!activeConversation) return;
    if (!file) return;
    setIsSending(true);
    setSendError('');
    try {
      await onAttach(activeConversation.id, file);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not attach file');
    } finally {
      setIsSending(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  const handleArchive = async () => {
    if (!activeConversation || !window.confirm(`Archive "${activeConversation.subject}"?`)) return;
    setIsResolving(true);
    setSendError('');
    try {
      await onArchive(activeConversation.id);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not archive conversation');
    } finally {
      setIsResolving(false);
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
        <section className="message-thread"><p className="empty-appointments">No portal messages yet.</p></section>
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
            <p><i /> {activeConversation.participantRole} - {activeConversation.activeNow ? 'Active Now' : activeConversation.resolved ? 'Resolved' : 'Portal Thread'}</p>
          </div>
          {canResolve && <button className="secondary-action" type="button" disabled={isResolving} onClick={handleResolve}>
            {isResolving ? 'Updating...' : activeConversation.resolved ? 'Reopen Thread' : 'Mark as Resolved'}
          </button>}
          {canResolve && <button className="secondary-action" type="button" disabled={isResolving} onClick={handleArchive}>Archive</button>}
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
                  <button className="message-attachment" type="button" onClick={() => message.attachment?.fileId ? void onDownloadAttachment(message.attachment.fileId) : openPrintableView('Message Attachment', message.attachment)}>
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
            <input ref={attachmentInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.csv" hidden onChange={(event) => void handleAttach(event.target.files?.[0])} />
            <IconButton label="Attach file" onClick={() => attachmentInputRef.current?.click()}><Attachment size={20} /></IconButton>
          </div>
          <textarea aria-label="Message reply" placeholder="Type a portal message..." value={reply} onChange={(event) => setReply(event.target.value)} />
          <div className="composer-footer">
            {sendError ? <span className="composer-error">{sendError}</span> : <span>Portal message to {activeConversation.participantName}</span>}
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
  onCancelRequest,
  onUpdateRequest,
  onReviewRequest,
  onDetail,
  onExport,
  onSupport,
  canRequest,
  canManage,
  canApprove,
}: {
  appointments: Appointment[];
  appointmentRequests: PortalData['appointmentRequests'];
  onBook: () => void;
  onCancel: (appointmentId: string) => Promise<void>;
  onReschedule: (appointmentId: string) => Promise<void>;
  onCancelRequest: (requestId: string) => Promise<void>;
  onUpdateRequest: (requestId: string, input: { reason: string; preferredDate: string; notes: string }) => Promise<void>;
  onReviewRequest: (request: PortalData['appointmentRequests'][number], decision: 'Approved' | 'Rejected') => Promise<void>;
  onDetail: (appointmentId: string) => Promise<void>;
  onExport: (status: 'upcoming' | 'past' | 'cancelled', provider: string) => Promise<void>;
  onSupport: () => void;
  canRequest: boolean;
  canManage: boolean;
  canApprove: boolean;
}) {
  const [tab, setTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [providerFilter, setProviderFilter] = useState('');
  const [pendingAppointmentId, setPendingAppointmentId] = useState('');
  const [appointmentError, setAppointmentError] = useState('');
  const [pendingRequestId, setPendingRequestId] = useState('');
  const [editingRequest, setEditingRequest] = useState<PortalData['appointmentRequests'][number] | null>(null);
  const [requestEditForm, setRequestEditForm] = useState({ reason: '', preferredDate: '', notes: '' });
  const pendingRequests = appointmentRequests.filter((request) => !['Cancelled', 'Rejected', 'Approved'].includes(request.status));
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

  const removeRequest = async (requestId: string) => {
    if (!window.confirm('Cancel this pending appointment request?')) return;
    setPendingRequestId(requestId);
    setAppointmentError('');
    try {
      await onCancelRequest(requestId);
    } catch (error) {
      setAppointmentError(error instanceof Error ? error.message : 'Could not cancel appointment request');
    } finally {
      setPendingRequestId('');
    }
  };

  const openRequestEdit = (request: PortalData['appointmentRequests'][number]) => {
    setEditingRequest(request);
    setRequestEditForm({ reason: request.reason, preferredDate: request.preferredDate, notes: request.notes });
    setAppointmentError('');
  };

  const saveRequestEdit = async () => {
    if (!editingRequest || !requestEditForm.reason.trim() || !requestEditForm.preferredDate) return;
    const date = new Date(`${requestEditForm.preferredDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(date.getTime()) || date < today) {
      setAppointmentError('Choose a valid future preferred date.');
      return;
    }
    setPendingRequestId(editingRequest.id);
    try {
      await onUpdateRequest(editingRequest.id, requestEditForm);
      setEditingRequest(null);
    } catch (error) {
      setAppointmentError(error instanceof Error ? error.message : 'Could not update appointment request');
    } finally {
      setPendingRequestId('');
    }
  };

  const processRequest = async (request: PortalData['appointmentRequests'][number], decision: 'Approved' | 'Rejected') => {
    if (decision === 'Rejected' && !window.confirm('Reject this appointment request?')) return;
    setPendingRequestId(request.id);
    setAppointmentError('');
    try {
      await onReviewRequest(request, decision);
    } catch (error) {
      setAppointmentError(error instanceof Error ? error.message : `Could not ${decision.toLowerCase()} request`);
    } finally {
      setPendingRequestId('');
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
        <article><span>Pending Requests</span><strong>{pendingRequests.length} Request{pendingRequests.length === 1 ? '' : 's'}</strong><p>{pendingRequests[0] ? `${pendingRequests[0].reason} - Awaiting approval` : 'No pending requests'}</p></article>
        <article><span>Last Visit</span><strong>{lastVisit?.date || 'No prior visits'}</strong><p>{lastVisit ? `${lastVisit.service} - ${lastVisit.department || lastVisit.type}` : 'Clinical history unavailable'}</p></article>
        <article><span>Fast Actions</span><div><button type="button" disabled={!canManage || !nextVisit || pendingAppointmentId === nextVisit.id} onClick={() => nextVisit && void onReschedule(nextVisit.id)}>Reschedule</button><button type="button" disabled={!canManage || !nextVisit || pendingAppointmentId === nextVisit.id} onClick={() => nextVisit && void onCancel(nextVisit.id)}>Cancel</button></div></article>
      </section>

      {pendingRequests.length > 0 && <section className="portal-table-panel">
        <header><h2>Pending appointment requests</h2><span>Requests remain pending until staff approval.</span></header>
        <div className="portal-table-wrap"><table><thead><tr><th>Preferred date</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead><tbody>{pendingRequests.map((request) => <tr key={request.id}><td>{request.preferredDate}</td><td><strong>{request.reason}</strong><small>{request.notes}</small></td><td>{request.status}</td><td>{canApprove ? <><button type="button" disabled={pendingRequestId === request.id} onClick={() => void processRequest(request, 'Approved')}>Approve</button><button type="button" disabled={pendingRequestId === request.id} onClick={() => void processRequest(request, 'Rejected')}>Reject</button></> : canRequest ? <><button type="button" disabled={pendingRequestId === request.id} onClick={() => openRequestEdit(request)}>Edit</button><button type="button" disabled={pendingRequestId === request.id} onClick={() => void removeRequest(request.id)}>{pendingRequestId === request.id ? 'Updating...' : 'Cancel request'}</button></> : <span>View only</span>}</td></tr>)}</tbody></table></div>
      </section>}

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
        <footer><span>{appointmentError || `Showing ${visibleRows.length ? `1 - ${visibleRows.length}` : '0'} of ${tab === 'upcoming' ? upcomingRows.length : tab === 'past' ? pastRows.length : cancelledRows.length} appointments`}</span></footer>
      </section>

      <aside className="reschedule-note">
        <Information size={28} />
        <p><strong>Need to reschedule within 24 hours?</strong><span>For urgent changes or appointments within the next 24 hours, please contact the clinic directly at +1 (555) 010-9988.</span></p>
        <button className="secondary-action" type="button" onClick={onSupport}>Contact Support</button>
      </aside>
      <ComposedModal open={Boolean(editingRequest)} onClose={() => setEditingRequest(null)} size="sm">
        <ModalHeader title="Edit appointment request" />
        <ModalBody><Stack gap={5}><TextInput id="request-edit-date" type="date" min={new Date().toISOString().slice(0, 10)} labelText="Preferred date" value={requestEditForm.preferredDate} onChange={(event) => setRequestEditForm((current) => ({ ...current, preferredDate: event.target.value }))} /><TextInput id="request-edit-reason" labelText="Reason" value={requestEditForm.reason} onChange={(event) => setRequestEditForm((current) => ({ ...current, reason: event.target.value }))} /><TextArea id="request-edit-notes" labelText="Notes" value={requestEditForm.notes} onChange={(event) => setRequestEditForm((current) => ({ ...current, notes: event.target.value }))} />{appointmentError && <InlineNotification kind="error" lowContrast title="Cannot update request" subtitle={appointmentError} />}</Stack></ModalBody>
        <ModalFooter><Button kind="secondary" onClick={() => setEditingRequest(null)}>Cancel</Button><Button disabled={!requestEditForm.reason.trim() || !requestEditForm.preferredDate || Boolean(pendingRequestId)} onClick={() => void saveRequestEdit()}>{pendingRequestId ? 'Saving...' : 'Save request'}</Button></ModalFooter>
      </ComposedModal>
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
  refillRequests,
  medicationRequests,
  onRefill,
  onRequestMedication,
  onCancelMedicationRequest,
  onReviewMedicationRequest,
  onReviewRefillRequest,
  onChangePharmacy,
  onStartMessage,
  onPrintList,
  onViewLeaflet,
  onCheckInteraction,
  canRefill,
  canRequestMedication,
  canChangePharmacy,
  canReview,
}: {
  preferredPharmacy: PortalData['preferredPharmacy'];
  medicationSummary: {
    activeMedications: number;
    dueForRefill: number;
    pendingRequests: number;
  };
  prescriptions: Prescription[];
  refillRequests: PortalData['refillRequests'];
  medicationRequests: PortalData['medicationRequests'];
  onRefill: (prescriptionId: string) => Promise<void>;
  onRequestMedication: (medicationName: string, notes: string) => Promise<void>;
  onCancelMedicationRequest: (requestId: string) => Promise<void>;
  onReviewMedicationRequest: (requestId: string, decision: 'Approved' | 'Rejected') => Promise<void>;
  onReviewRefillRequest: (requestId: string, decision: 'Approved' | 'Rejected') => Promise<void>;
  onChangePharmacy: (input: ReturnType<typeof defaultPharmacyForm>) => Promise<void>;
  onStartMessage: (subject: string, body?: string) => void;
  onPrintList: () => Promise<void>;
  onViewLeaflet: (prescriptionId: string) => Promise<void>;
  onCheckInteraction: (medicationName: string) => Promise<unknown>;
  canRefill: boolean;
  canRequestMedication: boolean;
  canChangePharmacy: boolean;
  canReview: boolean;
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
  const [cancellingRequestId, setCancellingRequestId] = useState('');
  const [reviewingRequestId, setReviewingRequestId] = useState('');
  const refillRequestIds = refillRequests.filter((request) => ['Pending', 'Queued'].includes(request.status)).map((request) => request.prescriptionId);

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

  const handleCancelMedicationRequest = async (requestId: string) => {
    if (!window.confirm('Cancel this pending medication request?')) return;
    setCancellingRequestId(requestId);
    setNotice('');
    try {
      await onCancelMedicationRequest(requestId);
      setNotice('Medication request cancelled.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not cancel medication request.');
    } finally {
      setCancellingRequestId('');
    }
  };

  const handleReview = async (requestId: string, requestType: 'medication' | 'refill', decision: 'Approved' | 'Rejected') => {
    setReviewingRequestId(requestId);
    setNotice('');
    try {
      if (requestType === 'medication') await onReviewMedicationRequest(requestId, decision);
      else await onReviewRefillRequest(requestId, decision);
      setNotice(`${requestType === 'medication' ? 'Medication' : 'Refill'} request ${decision.toLowerCase()}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not review request.');
    } finally {
      setReviewingRequestId('');
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
          <div><span>Preferred Pharmacy</span>{canChangePharmacy && <button type="button" onClick={() => setPharmacyOpen(true)}><Edit size={15} /> Change</button>}</div>
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
                      <button type="button" onClick={() => void onViewLeaflet(prescription.id)}>Leaflet</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer><span>Showing {prescriptions.length ? `1-${prescriptions.length}` : '0'} of {prescriptions.length} prescriptions</span></footer>
      </section>

      {canReview && refillRequests.filter((request) => ['Pending', 'Queued'].includes(request.status)).length > 0 && <section className="prescriptions-table-panel">
        <h2>Refill requests awaiting clinical review</h2>
        <div className="prescriptions-table-wrap"><table><thead><tr><th>Prescription</th><th>Pharmacy</th><th>Status</th><th>Decision</th></tr></thead><tbody>{refillRequests.filter((request) => ['Pending', 'Queued'].includes(request.status)).map((request) => <tr key={request.id}><td>{request.prescriptionName}</td><td>{request.pharmacyName || 'Preferred pharmacy'}</td><td>{request.status}</td><td><button type="button" disabled={reviewingRequestId === request.id} onClick={() => void handleReview(request.id, 'refill', 'Approved')}>Approve</button><button type="button" disabled={reviewingRequestId === request.id} onClick={() => void handleReview(request.id, 'refill', 'Rejected')}>Reject</button></td></tr>)}</tbody></table></div>
      </section>}

      {medicationRequests.filter((request) => !['Cancelled', 'Rejected', 'Approved'].includes(request.status)).length > 0 && <section className="prescriptions-table-panel">
        <h2>Medication requests awaiting review</h2>
        <div className="prescriptions-table-wrap"><table><thead><tr><th>Medication</th><th>Notes</th><th>Status</th><th>Action</th></tr></thead><tbody>{medicationRequests.filter((request) => !['Cancelled', 'Rejected', 'Approved'].includes(request.status)).map((request) => <tr key={request.id}><td>{request.medicationName}</td><td>{request.notes || 'No notes'}</td><td>{request.status}</td><td>{canReview ? <><button type="button" disabled={reviewingRequestId === request.id} onClick={() => void handleReview(request.id, 'medication', 'Approved')}>Approve</button><button type="button" disabled={reviewingRequestId === request.id} onClick={() => void handleReview(request.id, 'medication', 'Rejected')}>Reject</button></> : <button type="button" disabled={cancellingRequestId === request.id} onClick={() => void handleCancelMedicationRequest(request.id)}>{cancellingRequestId === request.id ? 'Cancelling...' : 'Cancel'}</button>}</td></tr>)}</tbody></table></div>
      </section>}

      <aside className="safety-note"><Information size={25} /><p><strong>Safety Information</strong><span>Always consult with your doctor before starting or stopping any medications. If you experience severe side effects, please contact your primary care provider or visit the nearest emergency department immediately.</span></p></aside>
      <section className="rx-action-grid">
        <button type="button" disabled={!prescriptions.length} onClick={() => prescriptions[0] && void onViewLeaflet(prescriptions[0].id)}>View First Medication Leaflet</button>
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
  onUploadInsurance: (file: File) => Promise<void>;
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
  const insuranceUploadRef = useRef<HTMLInputElement>(null);
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
    if (!window.confirm(`Remove ${contact.name} from emergency contacts?`)) return;
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

  const uploadInsurance = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    setNotice('');
    try {
      await onUploadInsurance(file);
      setNotice(`${file.name} uploaded as your insurance card.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not upload insurance card.');
    } finally {
      setSaving(false);
      if (insuranceUploadRef.current) insuranceUploadRef.current.value = '';
    }
  };

  return (
    <main className="portal-main profile-settings-page">
      <section className="settings-title"><div><p>Patient Portal / <strong>Profile</strong></p><h1>Profile</h1><span>Update your personal information, insurance details, and emergency contacts.</span></div><div className="page-actions">{canUpdate && <button className="secondary-action" type="button" onClick={() => { setForm(profile); setNotice(''); }}>Discard changes</button>}<button className="primary-action" type="button" disabled={!canUpdate || saving} onClick={handleSave}>{!canUpdate ? 'View Only' : saving ? 'Saving...' : 'Save Profile'}</button></div></section>
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
            <label><span>Preferred Language</span><select aria-label="Preferred Language" disabled={!canUpdate} value={form.language} onChange={(event) => update('language', event.target.value)}><option>English (US)</option></select></label>
            <label><span>Timezone</span><select aria-label="Timezone" disabled={!canUpdate} value={form.timezone} onChange={(event) => update('timezone', event.target.value)}><option>(GMT+05:45) Kathmandu</option><option>(GMT-08:00) Pacific Time</option><option>(GMT-05:00) Eastern Time</option><option>UTC</option></select></label>
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
          <input ref={insuranceUploadRef} type="file" accept=".pdf,.png,.jpg,.jpeg" hidden onChange={(event) => void uploadInsurance(event.target.files?.[0])} />
          <button className="secondary-action" type="button" disabled={!canUpdate || saving} onClick={() => insuranceUploadRef.current?.click()}><Attachment size={16} /> Upload Insurance Card</button>
        </section>
        <section className="emergency-contacts">
          <header><h2><UserProfile size={19} /> Emergency Contacts</h2><button type="button" disabled={!canUpdate} onClick={() => openContact()}><Add size={17} /> Add Contact</button></header>
          <div className="contacts-table-wrap"><table><thead><tr><th>Name</th><th>Relationship</th><th>Primary Phone</th><th>Alt Phone</th><th>Access Level</th><th>Actions</th></tr></thead><tbody>{emergencyContacts.map((contact) => <tr key={contact.id}><td><strong>{contact.name}</strong></td><td>{contact.relationship}</td><td>{contact.primaryPhone}</td><td>{contact.alternatePhone}</td><td><span>{contact.access}</span></td><td><button type="button" disabled={!canUpdate || saving} aria-label={`Edit ${contact.name}`} onClick={() => openContact(contact)}><Edit size={17} /></button><button type="button" disabled={!canUpdate || saving} aria-label={`Delete ${contact.name}`} onClick={() => deleteContact(contact)}><TrashCan size={17} /></button></td></tr>)}</tbody></table></div>
        </section>
        <footer className="profile-security-footer"><span>Authenticated portal session</span><span>Compliance review required before PHI use</span><small>Data shown is loaded from the configured portal API.</small></footer>
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
  interactions,
  onInteraction,
  onDetail,
  onDownload,
  canInteract,
}: {
  resources: PortalData['educationalResources'];
  interactions: PortalData['resourceInteractions'];
  onInteraction: (resourceId: string, action: string) => Promise<void>;
  onDetail: (resourceId: string) => Promise<void>;
  onDownload: (resourceId: string) => Promise<void>;
  canInteract: boolean;
}) {
  const persistedSavedIds = () => {
    const latest = new Map<string, string>();
    [...interactions].reverse().forEach((interaction) => {
      if (!latest.has(interaction.resourceId)) latest.set(interaction.resourceId, interaction.action);
    });
    return [...latest.entries()].filter(([, action]) => action.toLowerCase() === 'save').map(([id]) => id);
  };
  const [savedIds, setSavedIds] = useState<string[]>(persistedSavedIds);
  const [format, setFormat] = useState('All Formats');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [visibleLibrary, setVisibleLibrary] = useState(resources.library);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setSavedIds(persistedSavedIds());
  }, [interactions]);

  useEffect(() => {
    setVisibleLibrary(resources.library);
  }, [resources.library]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      getResources({ query, format, pageSize: 50 })
        .then((result) => {
          if (active) setVisibleLibrary(result.library || []);
        })
        .catch((error) => {
          if (active) setNotice(error instanceof Error ? error.message : 'Could not search resources.');
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [format, query]);

  const record = async (resourceId: string, action: string) => {
    await onInteraction(resourceId, action);
    setNotice(`${action} recorded.`);
  };

  const toggleSaved = async (resourceId: string) => {
    if (!canInteract) return;
    const wasSaved = savedIds.includes(resourceId);
    try {
      await record(resourceId, wasSaved ? 'Unsave' : 'Save');
      setSavedIds((current) => wasSaved ? current.filter((id) => id !== resourceId) : [...current, resourceId]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update saved resources.');
    }
  };

  const openResource = async (resourceId: string, action = 'Read') => {
    try {
      // Recording an interaction invalidates resource queries. Resolve the
      // detail first so that invalidation cannot abort the view request.
      await onDetail(resourceId);
      if (canInteract) await record(resourceId, action);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not open this resource.');
    }
  };

  const trustedLink = (
    resource: { sourceUrl?: string; sourceLabel?: string },
    resourceId: string,
    label = `Open ${resource.sourceLabel || 'official source'}`,
  ) => resource.sourceUrl ? (
    <a
      className="trusted-resource-link"
      href={resource.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        if (canInteract) void record(resourceId, 'Read trusted source');
      }}
    >
      {label} <Launch size={15} />
    </a>
  ) : null;

  return (
    <main className="portal-main resources-page">
      <section className="page-title resources-title">
        <div>
          <h1>Educational Resources</h1>
          <p>Access medical articles, videos, and guides curated specifically for your health profile and recent laboratory results.</p>
        </div>
      </section>
      {notice && <p className="workspace-notice">{notice}</p>}
      {searching && <InlineLoading description="Searching resources" />}
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
            <div className="resource-actions">
              <button className="primary-action" type="button" onClick={() => void openResource(resources.featured.id)}>{resources.featured.actionLabel}<Document size={18} /></button>
              {trustedLink(resources.featured, resources.featured.id)}
            </div>
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
            <footer>
              <span>{resources.video.category}</span>
              <div className="resource-actions">
                <button type="button" onClick={() => void openResource(resources.video.id)}>View</button>
                {canInteract && <button type="button" aria-label="Save video" onClick={() => void toggleSaved(resources.video.id)}>{savedIds.includes(resources.video.id) ? 'Unsave' : 'Save'}</button>}
              </div>
            </footer>
            {trustedLink(resources.video, resources.video.id)}
          </article>
        </div>
      </section>

      <section className="resource-group-grid">
        {resources.groups.map((group) => (
          <article className="resource-group" key={group.id}>
            <h2>{group.title}</h2>
            {group.items.map((item, index) => {
              const resourceId = item.id || `${group.id}-${index}`;
              return (
                <div className="resource-group-item" key={resourceId}>
                  <button type="button" onClick={() => void openResource(resourceId, item.action)}>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                    <small>{item.action}</small>
                  </button>
                  {trustedLink(item, resourceId)}
                </div>
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
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => void openResource(item.id)}>Read</button>
                      {canInteract && <><button type="button" onClick={() => void toggleSaved(item.id)}>{savedIds.includes(item.id) ? 'Unsave' : 'Save'}</button><button type="button" onClick={() => void onDownload(item.id)}>Download</button></>}
                      {trustedLink(item, item.id, item.sourceLabel || 'Official source')}
                    </div>
                  </td>
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
  canReview,
  onRequest,
  onAction,
  onCancel,
  onExport,
  onDetail,
  onContact,
  onCalendar,
}: {
  referrals: PortalData['referrals'];
  canManage: boolean;
  canReview: boolean;
  onRequest: (input: { provider?: string; specialty: string; reason: string; clinic?: string }) => Promise<void>;
  onAction: (referralId: string, action: string, note?: string) => Promise<void>;
  onCancel: (referralId: string) => Promise<void>;
  onExport: () => Promise<void>;
  onDetail: (referralId: string) => Promise<void>;
  onContact: (referralId: string) => Promise<void>;
  onCalendar: (referralId: string) => Promise<void>;
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
    if (action === 'Contact' || action === 'Clinic Profile') {
      await onContact(referralId);
      return;
    }
    if (action === 'View Calendar') {
      await onCalendar(referralId);
      return;
    }
    if (['Details', 'View Results'].includes(action)) {
      await onDetail(referralId);
      return;
    }
    if (action === 'Cancel') {
      if (!canManage || !window.confirm('Cancel this referral request?')) return;
      await onCancel(referralId);
      setNotice('Referral request cancelled.');
      return;
    }
    if (!canReview) return;
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
                  <td>
                    {row.appointment && <small>{row.appointment}</small>}
                    <div className="table-actions">
                      {row.actions.filter((action) => ['Details', 'View Results', 'View Calendar', 'Contact'].includes(action) || (canReview && action === 'Resend Request')).map((action) => <button type="button" key={action} onClick={() => void runAction(row.id, action)}>{action}</button>)}
                      {canReview && row.status === 'Pending' && <><button type="button" onClick={() => void runAction(row.id, 'Approved')}>Approve</button><button type="button" onClick={() => void runAction(row.id, 'Rejected')}>Reject</button></>}
                      {canReview && row.status === 'Approved' && <button type="button" onClick={() => void runAction(row.id, 'Scheduled')}>Mark scheduled</button>}
                      {canReview && row.status === 'Scheduled' && <button type="button" onClick={() => void runAction(row.id, 'Completed')}>Complete</button>}
                      {!canReview && canManage && row.status === 'Pending' && <button type="button" onClick={() => void runAction(row.id, 'Cancel')}>Cancel request</button>}
                    </div>
                  </td>
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
          <button type="button" onClick={() => void runAction(focusReferralId, 'Clinic Profile')}>Clinic Profile</button>
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
  onAddRecord,
  onEditRecord,
  onDeleteRecord,
  onVerifyRecord,
  onDismissAlert,
  canBook,
  canManage,
  canVerify,
}: {
  records: PortalData['immunizationRecords'];
  onBook: () => void;
  onDownload: () => Promise<void>;
  onDetail: (recordId: string) => Promise<void>;
  onAddRecord: (input: ImmunizationRecordInput) => Promise<void>;
  onEditRecord: (recordId: string, input: ImmunizationRecordInput) => Promise<void>;
  onDeleteRecord: (recordId: string) => Promise<void>;
  onVerifyRecord: (recordId: string, decision: 'Verified' | 'Rejected') => Promise<void>;
  onDismissAlert: (alertId: string) => Promise<void>;
  canBook: boolean;
  canManage: boolean;
  canVerify: boolean;
}) {
  const [recordOpen, setRecordOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState('');
  const [recordForm, setRecordForm] = useState<ImmunizationRecordInput>({ vaccine: '', date: '', dose: '', provider: '', route: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [verifyingId, setVerifyingId] = useState('');

  const openAdd = () => {
    setEditingRecordId('');
    setRecordForm({ vaccine: '', date: '', dose: '', provider: '', route: '' });
    setRecordOpen(true);
  };

  const openEdit = (item: ImmunizationCompletedRecord) => {
    setEditingRecordId(item.id);
    setRecordForm({ vaccine: item.vaccine, date: item.date, dose: item.dose, provider: item.provider, route: item.route });
    setRecordOpen(true);
  };

  const saveRecord = async () => {
    if (!recordForm.vaccine.trim() || !recordForm.date.trim() || !recordForm.dose.trim()) return;
    setSaving(true);
    setNotice('');
    try {
      if (editingRecordId) {
        await onEditRecord(editingRecordId, recordForm);
        setNotice('Immunization record updated.');
      } else {
        await onAddRecord(recordForm);
        setNotice('Immunization record added.');
      }
      setRecordOpen(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recordId: string, vaccineName: string) => {
    setDeletingId(recordId);
    setNotice('');
    try {
      await onDeleteRecord(recordId);
      setNotice(`${vaccineName} record removed.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete record.');
    } finally {
      setDeletingId('');
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      await onDismissAlert(alertId);
    } catch {
      // Non-critical, silently continue
    }
  };

  const handleVerify = async (recordId: string, decision: 'Verified' | 'Rejected') => {
    setVerifyingId(recordId);
    setNotice('');
    try {
      await onVerifyRecord(recordId, decision);
      setNotice(`Immunization submission ${decision.toLowerCase()}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not review immunization submission.');
    } finally {
      setVerifyingId('');
    }
  };

  return (
    <main className="portal-main immunizations-page">
      <section className="records-title">
        <div><p>Health Records / Immunizations</p><h1>Immunization Records</h1></div>
        <div className="page-actions">
          <button className="secondary-action" type="button" onClick={() => void onDownload()}><Download size={17} /> Download</button>
          {canManage && <button className="primary-action" type="button" onClick={openAdd}><Add size={17} /> {canVerify ? 'Add Verified Record' : 'Add Patient-Reported Record'}</button>}
        </div>
      </section>
      {notice && <p className="workspace-notice">{notice}</p>}
      <section className="immunization-alerts">
        {records.alerts.filter((a) => !a.dismissed).map((alert) => (
          <article className={`immunization-alert immunization-alert--${alert.tone}`} key={alert.id}>
            <div><strong>{alert.title}</strong><span>{alert.detail}</span></div>
            {canVerify && <button type="button" aria-label={`Dismiss ${alert.title}`} onClick={() => void handleDismissAlert(alert.id)}><TrashCan size={16} /></button>}
          </article>
        ))}
      </section>
      <section className="portal-table-panel">
        <header><h2>Completed Immunizations</h2><span>Showing {records.completed.filter((r) => !r.deletedAt).length} entries</span></header>
        <div className="portal-table-wrap">
          <table>
            <thead><tr><th>Vaccine Name</th><th>Date Administered</th><th>Dose / Series</th><th>Administering Provider</th><th>Site / Route</th><th>Actions</th></tr></thead>
            <tbody>{records.completed.filter((r) => !r.deletedAt).map((item) => {
              const patientEditable = item.provenance === 'patient-reported' && item.verificationStatus !== 'Verified';
              const pendingVerification = item.provenance === 'patient-reported' && ['Pending verification', 'Rejected', undefined].includes(item.verificationStatus);
              return <tr key={item.id}>
                <td>{item.vaccine}</td>
                <td>{item.date}</td>
                <td>{item.dose}</td>
                <td>{item.provider}</td>
                <td>{item.route}</td>
                <td><div className="table-actions">
                  <button type="button" onClick={() => void onDetail(item.id)}>View</button>
                  {canManage && patientEditable && <button type="button" aria-label={`Edit ${item.vaccine}`} onClick={() => openEdit(item)}><Edit size={15} /></button>}
                  {canManage && patientEditable && <button type="button" aria-label={`Delete ${item.vaccine}`} disabled={deletingId === item.id} onClick={() => void handleDelete(item.id, item.vaccine)}><TrashCan size={15} /></button>}
                  {canVerify && pendingVerification && <><button type="button" disabled={verifyingId === item.id} onClick={() => void handleVerify(item.id, 'Verified')}>Verify</button><button type="button" disabled={verifyingId === item.id} onClick={() => void handleVerify(item.id, 'Rejected')}>Reject</button></>}
                </div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>
      <section className="immunization-bottom-grid">
        <article className="compliance-card"><h2>Vaccination Compliance</h2><strong>{records.compliance.percent}%</strong><i><b style={{ width: `${records.compliance.percent}%` }} /></i><p>{records.compliance.detail}</p><small>Compliance calculated based on CDC guidelines for your age and health profile.</small></article>
        <article className="schedule-card"><h2>Need an Appointment?</h2><p>Schedule your seasonal flu shot or overdue boosters with your primary care provider.</p><button className="primary-action" type="button" disabled={!canBook} onClick={onBook}>{canBook ? 'Schedule Now' : 'Scheduling Restricted'}</button></article>
      </section>

      <ComposedModal open={recordOpen} onClose={() => setRecordOpen(false)} size="sm">
        <ModalHeader title={editingRecordId ? 'Edit immunization record' : 'Add immunization record'} />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="imm-vaccine" labelText="Vaccine name" value={recordForm.vaccine} onChange={(event) => setRecordForm((c) => ({ ...c, vaccine: event.target.value }))} />
            <TextInput id="imm-date" labelText="Date administered" placeholder="Jan 15, 2024" value={recordForm.date} onChange={(event) => setRecordForm((c) => ({ ...c, date: event.target.value }))} />
            <TextInput id="imm-dose" labelText="Dose / Series" placeholder="1 of 3" value={recordForm.dose} onChange={(event) => setRecordForm((c) => ({ ...c, dose: event.target.value }))} />
            <TextInput id="imm-provider" labelText="Administering provider" value={recordForm.provider || ''} onChange={(event) => setRecordForm((c) => ({ ...c, provider: event.target.value }))} />
            <TextInput id="imm-route" labelText="Site / Route" placeholder="Left Deltoid / IM" value={recordForm.route || ''} onChange={(event) => setRecordForm((c) => ({ ...c, route: event.target.value }))} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setRecordOpen(false)}>Cancel</Button>
          <Button disabled={saving || !recordForm.vaccine.trim() || !recordForm.date.trim() || !recordForm.dose.trim()} onClick={saveRecord}>
            {saving ? 'Saving...' : editingRecordId ? 'Update record' : 'Add record'}
          </Button>
        </ModalFooter>
      </ComposedModal>
    </main>
  );
}

function formatTrendReadingDate(value: string) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Date not recorded';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function HealthTrendsPage({
  trends,
  onExport,
  onAddReading,
  onUpdateReading,
  onDeleteReading,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  canManage,
}: {
  trends: PortalData['healthTrends'];
  onExport: (range: string) => Promise<void>;
  onAddReading: (input: TrendReadingInput) => Promise<void>;
  onUpdateReading: (metricId: string, readingId: string, input: TrendReadingInput) => Promise<void>;
  onDeleteReading: (metricId: string, readingId: string) => Promise<void>;
  onAddGoal: (input: TrendGoalInput) => Promise<void>;
  onUpdateGoal: (goalId: string, input: TrendGoalInput) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
  canManage: boolean;
}) {
  const [range, setRange] = useState('12m');
  const [readingOpen, setReadingOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState('');
  const firstMetric = trends.metrics[0];
  const [readingForm, setReadingForm] = useState<TrendReadingInput>({ metricId: firstMetric?.id, label: firstMetric?.label || '', value: '', unit: firstMetric?.unit || '', recordedAt: '' });
  const [editingReading, setEditingReading] = useState<{ metricId: string; readingId: string } | null>(null);
  const [goalForm, setGoalForm] = useState<TrendGoalInput>({ label: '', progress: 0 });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [deletingGoalId, setDeletingGoalId] = useState('');
  const [deletingReadingId, setDeletingReadingId] = useState('');

  const openAddReading = (metric = trends.metrics[0]) => {
    setEditingReading(null);
    setReadingForm({ metricId: metric?.id, label: metric?.label || '', value: '', unit: metric?.unit || '', recordedAt: '' });
    setReadingOpen(true);
  };

  const openEditReading = (metric: PortalData['healthTrends']['metrics'][number], reading: NonNullable<PortalData['healthTrends']['metrics'][number]['readings']>[number]) => {
    setEditingReading({ metricId: metric.id, readingId: reading.id });
    setReadingForm({ metricId: metric.id, label: metric.label, value: reading.value, unit: reading.unit || metric.unit || '', recordedAt: reading.recordedAt });
    setReadingOpen(true);
  };

  const openAddGoal = () => {
    setEditingGoalId('');
    setGoalForm({ label: '', progress: 0 });
    setGoalOpen(true);
  };

  const openEditGoal = (goal: TrendGoal) => {
    setEditingGoalId(goal.id);
    setGoalForm({ label: goal.label, progress: goal.progress });
    setGoalOpen(true);
  };

  const saveReading = async () => {
    if (!readingForm.label.trim() || !readingForm.value.trim()) return;
    setSaving(true);
    setNotice('');
    try {
      if (!readingForm.metricId) throw new Error('Select a metric for this reading.');
      if (editingReading) await onUpdateReading(editingReading.metricId, editingReading.readingId, readingForm);
      else await onAddReading(readingForm);
      setReadingOpen(false);
      setEditingReading(null);
      setReadingForm({ metricId: firstMetric?.id, label: firstMetric?.label || '', value: '', unit: firstMetric?.unit || '', recordedAt: '' });
      setNotice(editingReading ? 'Health reading updated.' : 'Health reading recorded.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save reading.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReading = async (metricId: string, readingId: string) => {
    if (!window.confirm('Delete this patient-entered reading?')) return;
    setDeletingReadingId(readingId);
    setNotice('');
    try {
      await onDeleteReading(metricId, readingId);
      setNotice('Health reading deleted.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete reading.');
    } finally {
      setDeletingReadingId('');
    }
  };

  const saveGoal = async () => {
    if (!goalForm.label.trim()) return;
    setSaving(true);
    setNotice('');
    try {
      if (editingGoalId) {
        await onUpdateGoal(editingGoalId, goalForm);
        setNotice('Goal updated.');
      } else {
        await onAddGoal(goalForm);
        setNotice('Health goal added.');
      }
      setGoalOpen(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save goal.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async (goalId: string, goalLabel: string) => {
    setDeletingGoalId(goalId);
    setNotice('');
    try {
      await onDeleteGoal(goalId);
      setNotice(`Goal "${goalLabel}" removed.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete goal.');
    } finally {
      setDeletingGoalId('');
    }
  };

  const activeGoals = (trends.goals || []).filter((g) => !g.deletedAt);
  const summary = trends.summary;
  const rangeMonths = Number.parseInt(range, 10) || 12;
  const rangeCutoff = new Date();
  rangeCutoff.setMonth(rangeCutoff.getMonth() - rangeMonths);
  const readingsInRange = (metric: PortalData['healthTrends']['metrics'][number]) => (metric.readings || []).filter((reading) => !reading.deletedAt && (!reading.recordedAt || Number.isNaN(Date.parse(reading.recordedAt)) || new Date(reading.recordedAt) >= rangeCutoff));

  return (
    <main className="portal-main trends-page">
      <section className="records-title">
        <div><h1>Health Trends & Vitals</h1><p>Longitudinal patient data analysis</p></div>
        <div className="page-actions">
          <select aria-label="Date range" value={range} onChange={(event) => setRange(event.target.value)}>
            <option value="3m">Past 3 Months</option>
            <option value="6m">Past 6 Months</option>
            <option value="12m">Past 12 Months</option>
          </select>
          <button className="secondary-action" type="button" onClick={() => void onExport(range)}><Download size={17} /> Download</button>
          {canManage && <button className="secondary-action" type="button" onClick={() => openAddReading()}><Add size={17} /> Add Reading</button>}
          {canManage && <button className="primary-action" type="button" onClick={openAddGoal}><Add size={17} /> Add Goal</button>}
        </div>
      </section>
      {notice && <p className="workspace-notice">{notice}</p>}
      {summary && (
        <section className="trend-summary-strip">
          <article><span>Within Range</span><strong>{summary.withinRange}</strong><small>Metrics</small></article>
          <article><span>Attention Required</span><strong>{summary.attentionRequired}</strong><small>Metrics</small></article>
          <article><span>Last Update Summary</span>{(summary.updates || []).map((item) => <small key={item}>{item}</small>)}</article>
        </section>
      )}
      <section className="trend-metric-grid">
        {(trends.metrics || []).map((metric) => (
          <article className="trend-metric-card" key={metric.id}>
            <header><h2>{metric.label}</h2><span>{metric.status}</span></header>
            <svg viewBox="0 0 260 110" role="img" aria-label={`${metric.label} trend`}>
              <polyline points={(metric.points || []).map((point, index) => `${20 + index * 55},${point}`).join(' ')} fill="none" stroke="#0043ce" strokeWidth="4" />
            </svg>
            <footer>
              <p><span>Latest</span><strong>{metric.latest || metric.latestValue}</strong><small>{metric.unit}</small></p>
              {metric.averageLabel && <p><span>{metric.averageLabel}</span><strong>{metric.average}</strong></p>}
            </footer>
            <div className="metric-readings">
              {readingsInRange(metric).map((reading) => (
                <div className="metric-reading-row" key={reading.id}>
                  <span>{formatTrendReadingDate(reading.recordedAt)}</span>
                  <strong>{reading.value} {reading.unit || metric.unit}</strong>
                  {canManage && <div className="row-actions"><button type="button" aria-label={`Edit ${metric.label} reading`} title="Edit reading" onClick={() => openEditReading(metric, reading)}><Edit size={16} /></button><button type="button" disabled={deletingReadingId === reading.id} aria-label={`Delete ${metric.label} reading`} title="Delete reading" onClick={() => void handleDeleteReading(metric.id, reading.id)}><TrashCan size={16} /></button></div>}
                </div>
              ))}
            </div>
            {canManage && <button className="metric-add-button" type="button" onClick={() => openAddReading(metric)}><Add size={16} /> Add reading</button>}
          </article>
        ))}
      </section>
      {(trends.labComparison || []).length > 0 && (
        <section className="portal-table-panel">
          <header><h2>Recent Lab Comparison</h2><span>Baseline vs. latest results</span></header>
          <div className="portal-table-wrap"><table><thead><tr><th>Test Parameter</th><th>Baseline</th><th>Current</th><th>Change</th><th>Status</th></tr></thead><tbody>{trends.labComparison.map((lab) => <tr key={lab.parameter}><td>{lab.parameter}</td><td>{lab.baseline}</td><td>{lab.current}</td><td>{lab.change}</td><td><span className={`referral-status referral-status--${lab.status.toLowerCase()}`}>{lab.status}</span></td></tr>)}</tbody></table></div>
        </section>
      )}
      <section className="health-goals">
        <article><h2>Health Goals Status</h2>
          {activeGoals.map((goal) => (
            <div key={goal.id} className="health-goal-row">
              <span>{goal.label}</span>
              <i><b style={{ width: `${goal.progress}%` }} /></i>
              <strong>{goal.progress}%</strong>
              {canManage && <div className="row-actions"><button type="button" aria-label={`Edit goal ${goal.label}`} title="Edit goal" onClick={() => openEditGoal(goal)}><Edit size={16} /></button><button type="button" aria-label={`Delete goal ${goal.label}`} title="Delete goal" disabled={deletingGoalId === goal.id} onClick={() => void handleDeleteGoal(goal.id, goal.label)}><TrashCan size={16} /></button></div>}
            </div>
          ))}
          {!activeGoals.length && <p className="empty-appointments">No health goals set yet. Add a goal to track progress.</p>}
        </article>
      </section>

      <ComposedModal open={readingOpen} onClose={() => setReadingOpen(false)} size="sm">
        <ModalHeader title={editingReading ? 'Edit health reading' : 'Add health reading'} />
        <ModalBody>
          <Stack gap={5}>
            <label className="modal-field-select" htmlFor="reading-metric"><span>Metric</span><select id="reading-metric" disabled={Boolean(editingReading)} value={readingForm.metricId || ''} onChange={(event) => { const metric = trends.metrics.find((item) => item.id === event.target.value); setReadingForm((current) => ({ ...current, metricId: metric?.id, label: metric?.label || '', unit: metric?.unit || '' })); }}>{trends.metrics.map((metric) => <option key={metric.id} value={metric.id}>{metric.label}</option>)}</select></label>
            <TextInput id="reading-value" labelText="Value (e.g. 120/80)" value={readingForm.value} onChange={(event) => setReadingForm((c) => ({ ...c, value: event.target.value }))} />
            <TextInput id="reading-unit" labelText="Unit (e.g. mmHg)" value={readingForm.unit || ''} onChange={(event) => setReadingForm((c) => ({ ...c, unit: event.target.value }))} />
            <TextInput id="reading-date" labelText="Recorded at (optional)" placeholder="2024-01-15T09:00:00Z" value={readingForm.recordedAt || ''} onChange={(event) => setReadingForm((c) => ({ ...c, recordedAt: event.target.value }))} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setReadingOpen(false)}>Cancel</Button>
          <Button disabled={saving || !readingForm.label.trim() || !readingForm.value.trim()} onClick={saveReading}>
            {saving ? 'Saving...' : editingReading ? 'Update reading' : 'Add reading'}
          </Button>
        </ModalFooter>
      </ComposedModal>

      <ComposedModal open={goalOpen} onClose={() => setGoalOpen(false)} size="sm">
        <ModalHeader title={editingGoalId ? 'Edit health goal' : 'Add health goal'} />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="goal-label" labelText="Goal description" placeholder="Reduce HbA1c to &lt; 6.5%" value={goalForm.label} onChange={(event) => setGoalForm((c) => ({ ...c, label: event.target.value }))} />
            <label htmlFor="goal-progress" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Progress: {goalForm.progress}%</span>
              <input id="goal-progress" type="range" min={0} max={100} value={goalForm.progress} onChange={(event) => setGoalForm((c) => ({ ...c, progress: Number(event.target.value) }))} />
            </label>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setGoalOpen(false)}>Cancel</Button>
          <Button disabled={saving || !goalForm.label.trim()} onClick={saveGoal}>
            {saving ? 'Saving...' : editingGoalId ? 'Update goal' : 'Add goal'}
          </Button>
        </ModalFooter>
      </ComposedModal>
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
  onSaveDependent,
  onDeleteDependent,
  onDownloadPolicy,
  onReportUnauthorized,
  onReviewReport,
  canManage,
  canReviewReports,
}: {
  familyAccess: PortalData['familyAccess'];
  shareRecords: boolean;
  mentalHealthNotes: boolean;
  onShareRecordsChange: (input: { shareRecords?: boolean; mentalHealthNotes?: boolean }) => Promise<void>;
  onInviteProxy: (input: { name: string; email: string; relationship: string; permissions: string }) => Promise<void>;
  onProxyPermissionChange: (proxyId: string, permissions: string) => Promise<void>;
  onResendProxy: (proxyId: string) => Promise<void>;
  onRevokeProxy: (proxyId: string) => Promise<void>;
  onSaveDependent: (input: { name: string; relationship: string; detail?: string; access?: string }, dependentId?: string) => Promise<void>;
  onDeleteDependent: (dependentId: string) => Promise<void>;
  onDownloadPolicy: () => Promise<void>;
  onReportUnauthorized: (summary: string) => Promise<void>;
  onReviewReport: (reportId: string, status: 'Under Review' | 'Resolved' | 'Dismissed') => Promise<void>;
  canManage: boolean;
  canReviewReports: boolean;
}) {
  const [savingShare, setSavingShare] = useState(false);
  const [notice, setNotice] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [dependentOpen, setDependentOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [proxyForm, setProxyForm] = useState({ name: '', email: '', relationship: 'Spouse', permissions: 'View Only' });
  const [dependentForm, setDependentForm] = useState({ name: '', relationship: 'Dependent', detail: 'Last Visit: Pending', access: 'View Only' });
  const [editingDependentId, setEditingDependentId] = useState('');
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
    setProxyForm({ name: '', email: '', relationship: 'Spouse', permissions: 'View Only' });
    setNotice('Proxy invite sent.');
  };

  const submitDependent = async () => {
    await onSaveDependent(dependentForm, editingDependentId || undefined);
    setDependentOpen(false);
    setEditingDependentId('');
    setDependentForm({ name: '', relationship: 'Dependent', detail: 'Last Visit: Pending', access: 'View Only' });
    setNotice(editingDependentId ? 'Dependent updated.' : 'Dependent added.');
  };

  const openAddDependent = () => {
    setEditingDependentId('');
    setDependentForm({ name: '', relationship: 'Dependent', detail: 'Last Visit: Pending', access: 'View Only' });
    setDependentOpen(true);
  };

  const openEditDependent = (account: PortalData['familyAccess']['accounts'][number]) => {
    setEditingDependentId(account.id);
    setDependentForm({ name: account.name, relationship: account.relationship || 'Dependent', detail: account.detail, access: account.access });
    setDependentOpen(true);
  };

  const removeDependent = async (account: PortalData['familyAccess']['accounts'][number]) => {
    if (!window.confirm(`Remove ${account.name} from delegated accounts?`)) return;
    try {
      await onDeleteDependent(account.id);
      setNotice(`${account.name} removed.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove dependent.');
    }
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
          {familyAccess.accounts.map((account) => <article key={account.id}><strong>{account.name}</strong><span>{account.detail}</span><b>{account.access}</b>{canManage && <><button type="button" onClick={() => openEditDependent(account)}>Edit</button><button type="button" onClick={() => void removeDependent(account)}>Delete</button></>}</article>)}
          {canManage && <button type="button" onClick={openAddDependent}>Request access to another account</button>}
        </aside>
      </div>
      <section className="access-activity">
        <h2>Recent Access Activity</h2>
        <div>{familyAccess.activity.map((item) => <p key={item.id} className={`activity-dot activity-dot--${item.tone}`}><strong>{item.title}</strong><span>{item.detail}</span></p>)}</div>
        <button className="link-button" type="button" onClick={() => openPrintableView('Security Audit Trail', familyAccess.activity)}>View full security audit trail</button>
      </section>
      {(familyAccess.reports || []).length > 0 && <section className="portal-table-panel">
        <header><h2>Unauthorized access reports</h2></header>
        <div className="portal-table-wrap"><table><thead><tr><th>Submitted</th><th>Concern</th><th>Status</th><th>Action</th></tr></thead><tbody>{(familyAccess.reports || []).map((report) => <tr key={report.id}><td>{report.createdAt}</td><td>{report.summary}</td><td>{report.status}</td><td>{canReviewReports ? <><button type="button" onClick={() => void onReviewReport(report.id, 'Under Review')}>Review</button><button type="button" onClick={() => void onReviewReport(report.id, 'Resolved')}>Resolve</button><button type="button" onClick={() => void onReviewReport(report.id, 'Dismissed')}>Dismiss</button></> : <span>{report.contactPreference}</span>}</td></tr>)}</tbody></table></div>
      </section>}
      <section className="privacy-settings">
        <div><h2>Global Privacy Settings</h2><p>Manage universal visibility for all proxies.</p></div>
        <label><input type="checkbox" checked={shareRecords} disabled={!canManage || savingShare} onChange={toggleShareRecords} /> Share HIV/STI Results<span>{shareRecords ? 'Currently Enabled' : 'Currently Disabled'}</span></label>
        <label><input type="checkbox" checked={mentalHealthNotes} disabled={!canManage || savingShare} onChange={toggleMentalHealthNotes} /> Share Mental Health Notes<span>{mentalHealthNotes ? 'Enabled' : 'Strict Privacy Mode'}</span></label>
      </section>
      <footer className="family-footer"><Information size={22} /><p>Proxy access is tracked in this demo. Protected health information must be handled according to organizational privacy and security policies.</p><button type="button" onClick={onDownloadPolicy}>Download Access Policy</button><button type="button" onClick={() => setReportOpen(true)}>Report Unauthorized Access</button></footer>

      <ComposedModal open={inviteOpen} onClose={() => setInviteOpen(false)} size="sm">
        <ModalHeader title="Invite proxy" />
        <ModalBody><Stack gap={5}><TextInput id="proxy-name" labelText="Name" value={proxyForm.name} onChange={(event) => setProxyForm((current) => ({ ...current, name: event.target.value }))} /><TextInput id="proxy-email" type="email" labelText="Invitation email" value={proxyForm.email} onChange={(event) => setProxyForm((current) => ({ ...current, email: event.target.value }))} /><TextInput id="proxy-relationship" labelText="Relationship" value={proxyForm.relationship} onChange={(event) => setProxyForm((current) => ({ ...current, relationship: event.target.value }))} /><TextInput id="proxy-permissions" labelText="Permissions" value={proxyForm.permissions} onChange={(event) => setProxyForm((current) => ({ ...current, permissions: event.target.value }))} /></Stack></ModalBody>
        <ModalFooter><Button kind="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button><Button disabled={!proxyForm.name.trim() || !/^\S+@\S+\.\S+$/.test(proxyForm.email)} onClick={submitProxy}>Send invite</Button></ModalFooter>
      </ComposedModal>

      <ComposedModal open={dependentOpen} onClose={() => setDependentOpen(false)} size="sm">
        <ModalHeader title={editingDependentId ? 'Edit dependent' : 'Add dependent'} />
        <ModalBody><Stack gap={5}><TextInput id="dependent-name" labelText="Name" value={dependentForm.name} onChange={(event) => setDependentForm((current) => ({ ...current, name: event.target.value }))} /><TextInput id="dependent-relationship" labelText="Relationship" value={dependentForm.relationship} onChange={(event) => setDependentForm((current) => ({ ...current, relationship: event.target.value }))} /><TextInput id="dependent-detail" labelText="Detail" value={dependentForm.detail} onChange={(event) => setDependentForm((current) => ({ ...current, detail: event.target.value }))} /></Stack></ModalBody>
        <ModalFooter><Button kind="secondary" onClick={() => setDependentOpen(false)}>Cancel</Button><Button disabled={!dependentForm.name.trim()} onClick={submitDependent}>{editingDependentId ? 'Update dependent' : 'Add dependent'}</Button></ModalFooter>
      </ComposedModal>

      <ComposedModal open={reportOpen} onClose={() => setReportOpen(false)} size="sm">
        <ModalHeader title="Report unauthorized access" />
        <ModalBody><TextArea id="unauthorized-report" labelText="What happened?" value={reportSummary} onChange={(event) => setReportSummary(event.target.value)} /></ModalBody>
        <ModalFooter><Button kind="secondary" onClick={() => setReportOpen(false)}>Cancel</Button><Button disabled={!reportSummary.trim()} onClick={submitReport}>Submit report</Button></ModalFooter>
      </ComposedModal>
    </main>
  );
}

function PortalShell({ onLogout }: { onLogout: () => void }) {
  const [portal, setPortal] = useState<PortalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const routerNavigate = useNavigate();
  const routeLocation = useLocation();
  const route = routeFromPath(routeLocation.pathname);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [reschedulingAppointmentId, setReschedulingAppointmentId] = useState('');
  const [visitForm, setVisitForm] = useState(initialVisitForm);
  const [messageForm, setMessageForm] = useState(initialMessageForm);
  const [messageRecipients, setMessageRecipients] = useState<Array<{ id: string; name: string; role: string; department: string; available: boolean }>>([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [notificationError, setNotificationError] = useState('');
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportForm, setSupportForm] = useState({ subject: '', body: '' });
  const [supportNotice, setSupportNotice] = useState('');
  const [supportSubmitting, setSupportSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [printableView, setPrintableView] = useState<PrintableViewRequest | null>(null);

  const loadPortal = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      setPortal(await getPortalData());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load portal data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  useEffect(() => {
    const handleUnhandledAction = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (!(reason instanceof Error)) return;
      event.preventDefault();
      setActionError(reason.message || 'The requested action could not be completed.');
      console.error('Unhandled portal action', reason);
    };
    window.addEventListener('unhandledrejection', handleUnhandledAction);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledAction);
  }, []);

  useEffect(() => subscribeToPrintableView(setPrintableView), []);

  const navigate = useCallback((nextRoute: PortalRoute) => {
    setActionError('');
    routerNavigate(pathForRoute(nextRoute));
  }, [routerNavigate]);

  useEffect(() => {
    const normalizedPath = routeLocation.pathname.replace(/\/+$/, '') || '/';
    if (normalizedPath !== pathForRoute(route)) {
      routerNavigate(pathForRoute(route), { replace: true });
    }
  }, [route, routeLocation.pathname, routerNavigate]);

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

  const downloadOrOpen = useCallback(async (title: string, url: string, fileName: string) => {
    const result = await downloadApiExport(url, fileName);
    if (!result.downloaded) openPrintableView(title, result.data);
  }, []);

  const openBooking = useCallback((preset: Partial<typeof initialVisitForm> = {}, appointmentId = '') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requestedDate = preset.date || preset.preferredDate || '';
    const requestedDateIsFuture = Boolean(requestedDate && !Number.isNaN(Date.parse(requestedDate)) && new Date(requestedDate) >= today);
    const provider = portal?.providers.find((item) => item.available && (item.name === preset.provider || (!preset.provider && item.department === preset.department)))
      || portal?.providers.find((item) => item.available);
    const slot = portal?.appointmentSlots.find((item) => item.status === 'Available' && (!provider?.department || item.department === provider.department) && !Number.isNaN(Date.parse(item.date)) && new Date(item.date) >= today)
      || portal?.appointmentSlots.find((item) => item.status === 'Available' && !Number.isNaN(Date.parse(item.date)) && new Date(item.date) >= today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDate = requestedDateIsFuture ? requestedDate : slot?.date || tomorrow.toISOString().slice(0, 10);
    setFormError('');
    setReschedulingAppointmentId(appointmentId);
    setVisitForm({
      ...initialVisitForm,
      ...preset,
      department: provider?.department || preset.department || slot?.department || '',
      provider: provider?.name || '',
      date: nextDate,
      preferredDate: nextDate,
      time: preset.time || slot?.time || '',
      location: preset.location || provider?.location || '',
    });
    setBookingOpen(true);
  }, [portal]);

  const openMessage = useCallback((subject = initialMessageForm.subject, body = '') => {
    const recipientId = messageRecipients.find((recipient) => recipient.available && recipient.id !== 'patient-support')?.id
      || portal?.providers.find((provider) => provider.available)?.id
      || 'patient-support';
    setFormError('');
    setMessageForm({ recipientId, subject, body });
    setMessageOpen(true);
    void getMessageRecipients().then(({ recipients }) => {
      setMessageRecipients(recipients);
      setMessageForm((current) => ({
        ...current,
        recipientId: recipients.some((recipient) => recipient.id === current.recipientId)
          ? current.recipientId
          : recipients.find((recipient) => recipient.available && recipient.id !== 'patient-support')?.id || 'patient-support',
      }));
    }).catch(() => undefined);
  }, [messageRecipients, portal]);

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
    const selectedDate = new Date(`${date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(selectedDate.getTime()) || selectedDate < today) {
      setFormError('Choose a valid future appointment date.');
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
    if (!messageForm.recipientId.trim() || !messageForm.subject.trim() || !messageForm.body.trim()) {
      setFormError('Recipient, subject, and message are required.');
      return;
    }
    if (!portal || !hasPermission(portal.access.permissions, 'messages.send')) {
      setFormError('You do not have permission to send messages.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      await sendMessage(messageForm.recipientId, messageForm.subject, messageForm.body);
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

  const handleThreadAttachment = async (conversationId: string, file: File) => {
    const uploaded = await uploadFile(file, {
      category: 'Secure message attachment',
      source: 'patient portal',
      relatedId: conversationId,
    });
    await sendConversationAttachment(conversationId, `Attached ${uploaded.fileName}.`, {
      fileName: uploaded.fileName,
      size: uploaded.size,
      fileId: uploaded.id,
    });
    await refreshPortal();
  };

  const handleConversationResolve = async (conversationId: string, resolved: boolean) => {
    await resolveConversation(conversationId, resolved);
    await refreshPortal();
  };

  const handleConversationArchive = async (conversationId: string) => {
    await archiveConversation(conversationId);
    await refreshPortal();
  };

  const handleAppointmentCancel = async (appointmentId: string) => {
    await cancelAppointment(appointmentId);
    await refreshPortal();
  };

  const handleAppointmentRequestCancel = async (requestId: string) => {
    await cancelAppointmentRequest(requestId);
    await refreshPortal();
  };

  const handleAppointmentRequestUpdate = async (requestId: string, input: { reason: string; preferredDate: string; notes: string }) => {
    await updateVisitRequest(requestId, input);
    await refreshPortal();
  };

  const handleAppointmentRequestReview = async (request: PortalData['appointmentRequests'][number], decision: 'Approved' | 'Rejected') => {
    if (decision === 'Rejected') {
      const reason = window.prompt('Reason for rejection:')?.trim();
      if (!reason) throw new Error('A rejection reason is required.');
      await reviewAppointmentRequest(request.id, { decision, reason });
    } else {
      const availableSlots = [...portal!.appointmentSlots]
        .filter((slot) => slot.status === 'Available' && slot.date >= new Date().toISOString().slice(0, 10))
        .sort((left, right) => `${left.date} ${left.time}`.localeCompare(`${right.date} ${right.time}`));
      const slot = availableSlots.find((item) => item.id === request.slotId)
        || availableSlots.find((item) => item.date === request.preferredDate && (!request.department || item.department === request.department))
        || availableSlots.find((item) => item.date >= request.preferredDate)
        || availableSlots[0];
      if (!slot) throw new Error('No future appointment slot is available for approval.');
      const provider = portal!.providers.find((item) => item.name === request.provider)
        || portal!.providers.find((item) => item.department === (request.department || slot.department) && item.available)
        || portal!.providers.find((item) => item.available);
      if (!provider) throw new Error('No active provider is available for approval.');
      await reviewAppointmentRequest(request.id, {
        decision,
        slotId: slot.id,
        provider: provider.name,
        department: provider.department || slot.department,
        date: slot.date,
        time: slot.time,
        location: provider.location,
      });
    }
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
    const params = new URLSearchParams({ status, format: 'csv' });
    if (provider.trim()) params.set('provider', provider.trim());
    await downloadOrOpen('Appointments Export', `/api/appointments/export?${params.toString()}`, `appointments-${status}.csv`);
  };

  const handlePrescriptionRefill = async (prescriptionId: string) => {
    await requestPrescriptionRefill(prescriptionId);
    await refreshPortal();
  };

  const handleMedicationRequest = async (medicationName: string, notes: string) => {
    await requestNewMedication(medicationName, notes);
    await refreshPortal();
  };

  const handleMedicationRequestCancel = async (requestId: string) => {
    await cancelMedicationRequest(requestId);
    await refreshPortal();
  };

  const handleMedicationRequestReview = async (requestId: string, decision: 'Approved' | 'Rejected') => {
    const reason = decision === 'Rejected' ? window.prompt('Reason for rejection:')?.trim() : '';
    if (decision === 'Rejected' && !reason) throw new Error('A rejection reason is required.');
    await reviewMedicationRequest(requestId, { decision, reason });
    await refreshPortal();
  };

  const handleRefillRequestReview = async (requestId: string, decision: 'Approved' | 'Rejected') => {
    const reason = decision === 'Rejected' ? window.prompt('Reason for rejection:')?.trim() : '';
    if (decision === 'Rejected' && !reason) throw new Error('A rejection reason is required.');
    await reviewRefillRequest(requestId, decision, reason);
    await refreshPortal();
  };

  const handlePreferredPharmacy = async (input: ReturnType<typeof defaultPharmacyForm>) => {
    await updatePreferredPharmacy(input);
    await refreshPortal();
  };

  const handlePrintablePrescriptions = async () => {
    await downloadOrOpen('Prescription List', '/api/prescriptions/printable?format=pdf', 'prescriptions.pdf');
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

  const handlePaymentMethodSave = async (input: BillingPaymentMethodInput, methodId?: string) => {
    const method = methodId ? await updateBillingPaymentMethod(methodId, input) : await addBillingPaymentMethod(input);
    await refreshPortal();
    return method;
  };

  const handlePaymentMethodDefault = async (methodId: string) => {
    await setDefaultPaymentMethod(methodId);
    await refreshPortal();
  };

  const handlePaymentMethodDelete = async (methodId: string) => {
    await deleteBillingPaymentMethod(methodId);
    await refreshPortal();
  };

  const handleBillingStatement = async () => {
    await downloadOrOpen('Billing Statement', '/api/billing/statements?format=pdf', 'billing-statement.pdf');
  };

  const handleInvoiceDetail = async (invoiceId: string) => {
    await downloadOrOpen(`Invoice ${invoiceId}`, `/api/billing/invoices/${encodeURIComponent(invoiceId)}?format=pdf`, `${invoiceId}.pdf`);
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

  const handleFileUpload = async (category: string, file: File, relatedId?: string) => {
    await uploadFile(file, {
      category,
      source: 'patient portal',
      relatedId,
    });
    await refreshPortal();
  };

  const handleRecordExport = async () => {
    await downloadOrOpen('Printable Health Record', '/api/records/printable?format=pdf', 'health-record.pdf');
  };

  const handleDocumentDetail = async (documentId: string) => {
    const detail = await getDocumentDetail(documentId);
    openPrintableView('Clinical Document', detail);
  };

  const handlePatientNote = async (input: { title: string; text: string; type?: string }, noteId?: string) => {
    if (noteId) await updatePatientNote(noteId, input);
    else await addPatientNote(input);
    await refreshPortal();
  };

  const handlePatientNoteDelete = async (noteId: string) => {
    await deletePatientNote(noteId);
    await refreshPortal();
  };

  const handleFileRename = async (fileId: string, fileName: string, category: string) => {
    await updateFileMetadata(fileId, { fileName, category, source: 'patient portal' });
    await refreshPortal();
  };

  const handleFileDelete = async (fileId: string) => {
    await deleteFile(fileId);
    await refreshPortal();
  };

  const handleLabDetail = async (lab: LabResult) => {
    const detail = await getLabDetail(lab.id || labKey(lab.label));
    openPrintableView(`Lab Narrative: ${lab.label}`, detail);
  };

  const handleTrendsExport = async (range: string) => {
    await downloadOrOpen('Health Trends Export', `/api/trends/export?range=${encodeURIComponent(range)}&format=csv`, `health-trends-${range}.csv`);
  };

  const handleReferralRequest = async (input: { provider?: string; specialty: string; reason: string; clinic?: string }) => {
    await requestReferral(input);
    await refreshPortal();
  };

  const handleReferralAction = async (referralId: string, action: string, note?: string) => {
    if (['Approved', 'Rejected', 'Scheduled', 'Completed'].includes(action)) {
      const reason = action === 'Rejected' ? window.prompt('Reason for rejection:')?.trim() : note || '';
      if (action === 'Rejected' && !reason) throw new Error('A rejection reason is required.');
      await updateReferralStatus(referralId, action as 'Approved' | 'Rejected' | 'Scheduled' | 'Completed', reason);
    } else {
      await updateReferralAction(referralId, action, note);
    }
    await refreshPortal();
  };

  const handleReferralCancel = async (referralId: string) => {
    await cancelReferral(referralId);
    await refreshPortal();
  };

  const handleReferralExport = async () => {
    await downloadOrOpen('Referral Report', '/api/referrals/export?format=pdf', 'referrals.pdf');
  };

  const handleReferralDetail = async (referralId: string) => {
    const detail = await getReferralDetail(referralId);
    openPrintableView('Referral Detail', detail);
  };

  const handleReferralContact = async (referralId: string) => {
    const contact = await getReferralContact(referralId);
    openPrintableView('Referral Clinic Profile', contact);
  };

  const handleReferralCalendar = async (referralId: string) => {
    const calendar = await getReferralCalendar(referralId);
    openPrintableView('Referral Appointment', calendar);
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
    await downloadOrOpen('Official Immunization Record', '/api/immunizations/printable?format=pdf', 'immunizations.pdf');
  };

  const handleImmunizationDetail = async (recordId: string) => {
    const detail = await getImmunizationDetail(recordId);
    openPrintableView('Immunization Detail', detail);
  };

  const handleAddImmunizationRecord = async (input: ImmunizationRecordInput) => {
    if (portal && hasPermission(portal.access.permissions, 'immunizations.verify')) await addVerifiedImmunization(input);
    else await addImmunizationRecord(input);
    await refreshPortal();
  };

  const handleUpdateImmunizationRecord = async (recordId: string, input: ImmunizationRecordInput) => {
    await updateImmunizationRecord(recordId, input);
    await refreshPortal();
  };

  const handleDeleteImmunizationRecord = async (recordId: string) => {
    await deleteImmunizationRecord(recordId);
    await refreshPortal();
  };

  const handleVerifyImmunizationRecord = async (recordId: string, decision: 'Verified' | 'Rejected') => {
    const note = decision === 'Rejected' ? window.prompt('Reason for rejection:')?.trim() : '';
    if (decision === 'Rejected' && !note) throw new Error('A rejection reason is required.');
    await verifyImmunization(recordId, decision, note);
    await refreshPortal();
  };

  const handleDismissImmunizationAlert = async (alertId: string) => {
    await dismissImmunizationAlert(alertId);
    await refreshPortal();
  };

  const handleAddTrendReading = async (input: TrendReadingInput) => {
    await addTrendReading(input);
    await refreshPortal();
  };

  const handleUpdateTrendReading = async (metricId: string, readingId: string, input: TrendReadingInput) => {
    await updateTrendReading(metricId, readingId, input);
    await refreshPortal();
  };

  const handleDeleteTrendReading = async (metricId: string, readingId: string) => {
    await deleteTrendReading(metricId, readingId);
    await refreshPortal();
  };

  const handleAddTrendGoal = async (input: TrendGoalInput) => {
    await addTrendGoal(input);
    await refreshPortal();
  };

  const handleUpdateTrendGoal = async (goalId: string, input: TrendGoalInput) => {
    await updateTrendGoal(goalId, input);
    await refreshPortal();
  };

  const handleDeleteTrendGoal = async (goalId: string) => {
    await deleteTrendGoal(goalId);
    await refreshPortal();
  };

  const handleCreateInvoice = async (input: BillingInvoiceInput) => {
    await createInvoice(input);
    await refreshPortal();
  };

  const handleUpdateInvoice = async (invoiceId: string, input: BillingInvoiceInput) => {
    await updateInvoice(invoiceId, input);
    await refreshPortal();
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    await deleteInvoice(invoiceId);
    await refreshPortal();
  };

  const handleGenerateStatement = async () => {
    const statement = await generateStatement();
    await downloadOrOpen(
      'Generated Statement',
      `/api/billing/statements/${encodeURIComponent(statement.id)}?format=pdf`,
      `${statement.id}.pdf`,
    );
    await refreshPortal();
  };

  const handleShareRecordsChange = async (input: { shareRecords?: boolean; mentalHealthNotes?: boolean }) => {
    await updateFamilyPrivacy(input);
    await refreshPortal();
  };

  const handleInviteProxy = async (input: { name: string; email: string; relationship: string; permissions: string }) => {
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

  const handleSaveDependent = async (input: { name: string; relationship: string; detail?: string; access?: string }, dependentId?: string) => {
    if (dependentId) await updateDependent(dependentId, input);
    else await addDependent(input);
    await refreshPortal();
  };

  const handleDeleteDependent = async (dependentId: string) => {
    await deleteDependent(dependentId);
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

  const handleAccessReportReview = async (reportId: string, status: 'Under Review' | 'Resolved' | 'Dismissed') => {
    const resolution = status === 'Under Review' ? '' : window.prompt('Resolution note:')?.trim() || '';
    await reviewAccessReport(reportId, status, resolution);
    await refreshPortal();
  };

  const handleNotifications = async () => {
    setNotificationOpen(true);
    setNotificationsLoading(true);
    setNotificationError('');
    try {
      const result = await getNotifications();
      setNotifications(Array.isArray(result) ? result : result.notifications);
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Could not load notifications.');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleHelp = () => {
    setSupportNotice('');
    setSupportOpen(true);
  };

  const handlePatientContextChange = async (contextId: string) => {
    try {
      await selectPatientContext(contextId);
      await refreshPortal();
      navigate('home');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not switch patient context.');
    }
  };

  const handleNotificationRead = async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, read: true, readAt: new Date().toISOString() } : item));
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Could not mark notification as read.');
    }
  };

  const handleAllNotificationsRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, read: true, readAt: item.readAt || new Date().toISOString() })));
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Could not mark notifications as read.');
    }
  };

  const handleSupportSubmit = async () => {
    if (!supportForm.subject.trim() || !supportForm.body.trim()) return;
    setSupportSubmitting(true);
    setSupportNotice('');
    try {
      await submitSupportRequest(supportForm.subject, supportForm.body);
      setSupportForm({ subject: '', body: '' });
      setSupportNotice('Support request submitted.');
    } catch (error) {
      setSupportNotice(error instanceof Error ? error.message : 'Could not submit support request.');
    } finally {
      setSupportSubmitting(false);
    }
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
  if (loadError || !portal) return <main className="app-loading"><InlineNotification kind="error" title="Could not load portal" subtitle={loadError || 'The API did not return portal data.'} /><Button onClick={() => void loadPortal()}>Retry</Button></main>;

  const currentPatient = portal.dashboard.patient;
  const permissions = portal.access.permissions;
  const activeRoute = canAccessRoute(route, permissions) ? route : firstAllowedRoute(permissions);
  const featureError = portal.featureErrors?.[activeRoute] || '';
  const canRequestAppointments = hasPermission(permissions, 'appointments.request');
  const canManageAppointments = hasPermission(permissions, 'appointments.manage');
  const canApproveAppointments = hasPermission(permissions, 'appointments.approve');
  const canSendMessages = hasPermission(permissions, 'messages.send');
  const canResolveMessages = hasPermission(permissions, 'messages.resolve');
  const canRequestRefills = hasPermission(permissions, 'prescriptions.refill');
  const canRequestMedication = hasPermission(permissions, 'prescriptions.request');
  const canReviewPrescriptions = hasPermission(permissions, 'prescriptions.review');
  const canChangePharmacy = hasPermission(permissions, 'prescriptions.pharmacy.manage');
  const canPayBills = hasPermission(permissions, 'billing.pay');
  const canManagePaymentMethods = hasPermission(permissions, 'billing.paymentMethods.manage');
  const canUpdateProfile = hasPermission(permissions, 'profile.update');
  const canManageReferrals = hasPermission(permissions, 'referrals.manage');
  const canReviewReferrals = hasPermission(permissions, 'referrals.review');
  const canManageNotes = hasPermission(permissions, 'records.notes.manage');
  const canManageFiles = hasPermission(permissions, 'files.manage');
  const canManageTrends = hasPermission(permissions, 'trends.manage');
  const canManageImmunizations = hasPermission(permissions, 'immunizations.manage');
  const canVerifyImmunizations = hasPermission(permissions, 'immunizations.verify');
  const canInteractWithResources = hasPermission(permissions, 'resources.interact');
  const canManageNotifications = hasPermission(permissions, 'notifications.manage');
  const canSelectPatientContext = hasPermission(permissions, 'patients.context.select');
  const canConfigureAccess = hasPermission(permissions, 'admin.access.view');
  const canManageRoles = hasPermission(permissions, 'admin.access.manage');
  const canManageUsers = hasPermission(permissions, 'admin.users.manage');
  const providerOptions = portal.providers.filter((provider) => provider.available);
  const departmentOptions = Array.from(new Set(providerOptions.map((provider) => provider.department).filter(Boolean)));
  const todayIso = new Date().toISOString().slice(0, 10);
  const slotOptions = portal.appointmentSlots.filter((slot) => slot.status === 'Available' && slot.date >= todayIso && (!visitForm.department || slot.department === visitForm.department) && (!visitForm.date || slot.date === visitForm.date));
  const canSubmitBooking = (reschedulingAppointmentId ? canManageAppointments : canRequestAppointments) && providerOptions.length > 0;
  const closeBooking = () => {
    setBookingOpen(false);
    setReschedulingAppointmentId('');
    setFormError('');
  };

  return (
    <div className="portal-app">
      <PortalHeader route={activeRoute} onNavigate={navigate} onNotifications={handleNotifications} onHelp={handleHelp} patientName={currentPatient.name} permissions={permissions} patientContexts={canSelectPatientContext ? portal.patientContexts : []} currentPatientContextId={portal.currentPatientContext?.id || ''} onPatientContextChange={canSelectPatientContext ? (contextId) => void handlePatientContextChange(contextId) : undefined} />
      <div className="portal-frame">
        <PortalSidebar route={activeRoute} onNavigate={navigate} onLogout={onLogout} patient={currentPatient} permissions={permissions} />
        <div className="portal-content">
        {featureError && <InlineNotification className="portal-action-notification" kind="warning" lowContrast title="Some information is temporarily unavailable" subtitle={featureError} hideCloseButton />}
        {actionError && <InlineNotification className="portal-action-notification" kind="error" lowContrast title="Action could not be completed" subtitle={actionError} onCloseButtonClick={() => setActionError('')} />}
        {activeRoute === 'home' && (
          <HomePage
            fallbackPortal={portal}
            onNavigate={navigate}
            onBook={() => openBooking()}
            onMessage={() => openMessage()}
          />
        )}
        {activeRoute === 'registration' && (
          <RegistrationPage
            fallbackProfile={portal.profileSettings}
            fallbackInsurance={portal.insuranceDetails}
            permissions={permissions}
            onUpdated={refreshPortal}
          />
        )}
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
            onSaveNote={handlePatientNote}
            onDeleteNote={handlePatientNoteDelete}
            onExport={handleRecordExport}
            onUpload={(category, file) => handleFileUpload(category, file)}
            onDownloadFile={downloadFile}
            onRenameFile={handleFileRename}
            onDeleteFile={handleFileDelete}
            onLabDetail={handleLabDetail}
            onDocumentDetail={handleDocumentDetail}
            canManageNotes={canManageNotes}
            canManageFiles={canManageFiles}
          />
        )}
        {activeRoute === 'appointments' && (
          <AppointmentsPageLive
            appointments={portal.appointments}
            appointmentRequests={portal.appointmentRequests}
            onBook={() => openBooking()}
            onCancel={handleAppointmentCancel}
            onReschedule={handleAppointmentReschedule}
            onCancelRequest={handleAppointmentRequestCancel}
            onUpdateRequest={handleAppointmentRequestUpdate}
            onReviewRequest={handleAppointmentRequestReview}
            onDetail={handleAppointmentDetail}
            onExport={handleAppointmentsExport}
            onSupport={() => openMessage('Appointment support', 'I need help with an appointment change.')}
            canRequest={canRequestAppointments}
            canManage={canManageAppointments}
            canApprove={canApproveAppointments}
          />
        )}
        {activeRoute === 'messages' && (
          <MessagesPageLive
            conversations={portal.messageConversations}
            onSend={handleThreadReply}
            onAttach={handleThreadAttachment}
            onResolve={handleConversationResolve}
            onArchive={handleConversationArchive}
            onDownloadAttachment={downloadFile}
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
            refillRequests={portal.refillRequests}
            medicationRequests={portal.medicationRequests}
            onRefill={handlePrescriptionRefill}
            onRequestMedication={handleMedicationRequest}
            onCancelMedicationRequest={handleMedicationRequestCancel}
            onReviewMedicationRequest={handleMedicationRequestReview}
            onReviewRefillRequest={handleRefillRequestReview}
            onChangePharmacy={handlePreferredPharmacy}
            onStartMessage={openMessage}
            onPrintList={handlePrintablePrescriptions}
            onViewLeaflet={handleMedicationLeaflet}
            onCheckInteraction={handleInteractionCheck}
            canRefill={canRequestRefills}
            canRequestMedication={canRequestMedication}
            canChangePharmacy={canChangePharmacy}
            canReview={canReviewPrescriptions}
          />
        )}
        {activeRoute === 'billing' && (
          <BillingPage
            billing={portal.billing}
            onPay={handleBalancePayment}
            onSavePaymentMethod={handlePaymentMethodSave}
            onSetDefaultPaymentMethod={handlePaymentMethodDefault}
            onDeletePaymentMethod={handlePaymentMethodDelete}
            onStatement={handleBillingStatement}
            onInvoice={handleInvoiceDetail}
            onResource={handleBillingResource}
            onPaymentSession={handlePaymentSession}
            onSupport={() => openMessage('Billing support', 'I need help with a bill or payment plan.')}
            onCreateInvoice={handleCreateInvoice}
            onUpdateInvoice={handleUpdateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onGenerateStatement={handleGenerateStatement}
            canPay={canPayBills}
            canManagePaymentMethods={canManagePaymentMethods}
            canManageInvoices={hasPermission(permissions, 'billing.invoices.manage')}
          />
        )}
        {activeRoute === 'resources' && <ResourcesPage resources={portal.educationalResources} interactions={portal.resourceInteractions} onInteraction={handleResourceInteraction} onDetail={handleResourceDetail} onDownload={downloadResource} canInteract={canInteractWithResources} />}
        {activeRoute === 'referrals' && (
          <ReferralsPage
            referrals={portal.referrals}
            canManage={canManageReferrals}
            canReview={canReviewReferrals}
            onRequest={handleReferralRequest}
            onAction={handleReferralAction}
            onCancel={handleReferralCancel}
            onExport={handleReferralExport}
            onDetail={handleReferralDetail}
            onContact={handleReferralContact}
            onCalendar={handleReferralCalendar}
          />
        )}
        {activeRoute === 'immunizations' && <ImmunizationsPage
          records={portal.immunizationRecords}
          onBook={() => openBooking({ service: 'Immunization visit', department: 'Primary Care', reason: 'Immunization appointment' })}
          onDownload={handlePrintableImmunizations}
          onDetail={handleImmunizationDetail}
          onAddRecord={handleAddImmunizationRecord}
          onEditRecord={handleUpdateImmunizationRecord}
          onDeleteRecord={handleDeleteImmunizationRecord}
          onVerifyRecord={handleVerifyImmunizationRecord}
          onDismissAlert={handleDismissImmunizationAlert}
          canBook={canRequestAppointments}
          canManage={canManageImmunizations}
          canVerify={canVerifyImmunizations}
        />}
        {activeRoute === 'trends' && <HealthTrendsPage
          trends={portal.healthTrends}
          onExport={handleTrendsExport}
          onAddReading={handleAddTrendReading}
          onUpdateReading={handleUpdateTrendReading}
          onDeleteReading={handleDeleteTrendReading}
          onAddGoal={handleAddTrendGoal}
          onUpdateGoal={handleUpdateTrendGoal}
          onDeleteGoal={handleDeleteTrendGoal}
          canManage={canManageTrends}
        />}
        {activeRoute === 'profile' && (
          <ProfileSettingsPage
            profile={portal.profileSettings}
            accountStatus={portal.accountStatus}
            insuranceDetails={portal.insuranceDetails}
            emergencyContacts={portal.emergencyContacts}
            onSave={handleProfileSave}
            onInsuranceSave={handleInsuranceSave}
            onContactSave={handleEmergencyContactSave}
            onContactDelete={handleEmergencyContactDelete}
            onUploadInsurance={(file) => handleFileUpload('Insurance card', file)}
            canUpdate={canUpdateProfile}
            canConfigureAccess={false}
            canManageRoles={canManageRoles}
            canManageUsers={canManageUsers}
          />
        )}
        {activeRoute === 'admin' && canConfigureAccess && <AdminAccessPage canManageRoles={canManageRoles} canManageUsers={canManageUsers} />}
        {activeRoute === 'dashboard' && <Dashboard portal={portal} onBook={() => openBooking()} onNavigate={navigate} onPrintRecord={handleRecordExport} canBook={canRequestAppointments} />}
        </div>
      </div>

      <ComposedModal open={bookingOpen} onClose={closeBooking} size="sm">
        <ModalHeader title={reschedulingAppointmentId ? 'Reschedule appointment' : 'Schedule new appointment'} />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="visit-service" labelText="Service" value={visitForm.service} onChange={(event) => setVisitForm((current) => ({ ...current, service: event.target.value }))} />
            <label className="modal-field-select" htmlFor="visit-department">
              <span>Department</span>
              <select id="visit-department" value={visitForm.department} onChange={(event) => { const provider = providerOptions.find((item) => item.department === event.target.value); const slot = portal.appointmentSlots.find((item) => item.status === 'Available' && item.department === event.target.value && item.date >= todayIso); setVisitForm((current) => ({ ...current, department: event.target.value, provider: provider?.name || '', location: provider?.location || '', date: slot?.date || current.date, preferredDate: slot?.date || current.preferredDate, time: slot?.time || '' })); }}>
                {!departmentOptions.length && <option value="">No available departments</option>}
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
                {!providerOptions.length && <option value="">No available providers</option>}
                {providerOptions.map((provider) => <option key={provider.id} value={provider.name}>{provider.name} - {provider.department}</option>)}
              </select>
            </label>
            <TextInput id="visit-date" type="date" min={todayIso} labelText="Date" value={visitForm.date} onChange={(event) => { const slot = portal.appointmentSlots.find((item) => item.status === 'Available' && item.department === visitForm.department && item.date === event.target.value); setVisitForm((current) => ({ ...current, date: event.target.value, preferredDate: event.target.value, time: slot?.time || '' })); }} />
            <label className="modal-field-select" htmlFor="visit-time">
              <span>Time</span>
              <select id="visit-time" value={visitForm.time} onChange={(event) => setVisitForm((current) => ({ ...current, time: event.target.value }))}>
                {!slotOptions.length && <option value="">No available times for this date</option>}
                {slotOptions.map((slot) => slot.time).filter((time, index, list) => list.indexOf(time) === index).map((time) => <option key={time} value={time}>{time}</option>)}
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
        <ModalHeader title="Message care team" />
        <ModalBody>
          <Stack gap={5}>
            <label className="modal-field-select" htmlFor="message-recipient">
              <span>Recipient</span>
              <select id="message-recipient" value={messageForm.recipientId} onChange={(event) => setMessageForm((current) => ({ ...current, recipientId: event.target.value }))}>
                {(messageRecipients.length ? messageRecipients : [
                  { id: 'patient-support', name: 'Patient Support', role: 'Portal Support', department: 'Support', available: true },
                  ...portal.providers,
                ]).filter((recipient) => recipient.available).map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.name} — {recipient.role || recipient.department}</option>)}
              </select>
            </label>
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

      <ComposedModal open={notificationOpen} onClose={() => setNotificationOpen(false)} size="sm">
        <ModalHeader title="Notifications" />
        <ModalBody>
          <Stack gap={4}>
            {notificationsLoading && <InlineLoading description="Loading notifications" />}
            {notificationError && <InlineNotification kind="error" lowContrast title="Notification error" subtitle={notificationError} />}
            {!notificationsLoading && !notifications.length && <p>No notifications.</p>}
            {notifications.map((notification) => <article className="note-card" key={notification.id}><div><strong>{notification.title}</strong><time>{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ''}</time></div><p>{notification.detail || notification.body}</p>{canManageNotifications && !notification.readAt && !notification.read && <button type="button" onClick={() => void handleNotificationRead(notification.id)}>Mark read</button>}</article>)}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setNotificationOpen(false)}>Close</Button>
          {canManageNotifications && notifications.some((item) => !item.readAt && !item.read) && <Button onClick={() => void handleAllNotificationsRead()}>Mark all read</Button>}
        </ModalFooter>
      </ComposedModal>

      <ComposedModal open={supportOpen} onClose={() => setSupportOpen(false)} size="sm">
        <ModalHeader title="Patient portal support" />
        <ModalBody>
          <Stack gap={5}>
            <p>For urgent medical concerns, contact your local emergency service. Portal support requests are delivered through secure messaging.</p>
            <TextInput id="support-subject" labelText="Subject" value={supportForm.subject} onChange={(event) => setSupportForm((current) => ({ ...current, subject: event.target.value }))} />
            <TextArea id="support-body" labelText="How can we help?" value={supportForm.body} onChange={(event) => setSupportForm((current) => ({ ...current, body: event.target.value }))} />
            {supportNotice && <p className="workspace-notice" role="status">{supportNotice}</p>}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setSupportOpen(false)}>Close</Button>
          <Button disabled={!canSendMessages || supportSubmitting || !supportForm.subject.trim() || !supportForm.body.trim()} onClick={() => void handleSupportSubmit()}>{supportSubmitting ? 'Submitting...' : canSendMessages ? 'Submit support request' : 'Restricted'}</Button>
        </ModalFooter>
      </ComposedModal>

      <PrintablePreviewModal
        preview={printableView}
        onClose={() => setPrintableView(null)}
      />
    </div>
  );
}

export default PortalShell;
