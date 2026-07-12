import { readDb } from '../../store.js';
import { hasPermission } from '../../domain/access-control.js';
import { scopeDbToPatient } from '../../domain/patient-scope.js';

export async function getDashboardForPatient(user, access) {
  const db = scopeDbToPatient(await readDb(), user);
  const patient = buildPatientIdentity(db, user);
  const canViewAppointments = hasPermission(access, 'appointments.view');
  const canViewMessages = hasPermission(access, 'messages.view');
  const canViewPrescriptions = hasPermission(access, 'prescriptions.view');
  const canViewBilling = hasPermission(access, 'billing.view');
  const canViewRecords = hasPermission(access, 'records.view');
  const canViewTrends = hasPermission(access, 'trends.view');
  const canSendMessages = hasPermission(access, 'messages.send');
  const canRequestRefills = hasPermission(access, 'prescriptions.refill');
  const upcomingAppointments = canViewAppointments ? db.appointments
    .filter(isUpcomingAppointment)
    .sort((left, right) => appointmentTime(left) - appointmentTime(right))
    .slice(0, 3) : [];
  const unreadMessages = canViewMessages ? db.messageConversations.filter((conversation) => conversation.unread).length : 0;
  const refillsDue = canViewPrescriptions ? db.prescriptions.filter((item) => item.status === 'Refill Due').length : 0;
  const latestLabs = canViewRecords ? db.labResults.slice(0, 4) : [];
  const latestDocument = canViewRecords ? db.documents[0] : null;
  const latestConversation = canViewMessages ? db.messageConversations[0] : null;
  const latestRefill = canViewPrescriptions ? db.refillRequests[0] : null;

  return {
    patient,
    summary: {
      welcomeName: firstName(patient.name),
      healthId: patient.identifier,
      overviewDate: new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
      appointmentsUpcoming: upcomingAppointments.length,
      unreadMessages,
      refillsDue,
      outstandingBalance: canViewBilling ? db.billing.outstandingBalance : 0,
      careTeam: canViewAppointments || canViewMessages ? patient.careTeam : '',
      primaryCondition: canViewRecords || canViewTrends ? patient.primaryCondition : '',
    },
    quickActions: [
      {
        id: 'message-care-team',
        label: 'Message my Doctor',
        detail: latestConversation ? `Last message: ${latestConversation.time}` : 'Start a portal thread',
        target: 'messages',
        priority: 'primary',
      },
      {
        id: 'refill-prescriptions',
        label: 'Refill Prescriptions',
        detail: refillsDue ? `${refillsDue} refill${refillsDue === 1 ? '' : 's'} due` : 'No refills due',
        target: 'prescriptions',
        priority: 'secondary',
      },
      {
        id: 'view-records',
        label: 'View Records',
        detail: latestDocument ? `Updated ${latestDocument.updated}` : 'Clinical summary ready',
        target: 'records',
        priority: 'neutral',
      },
    ].filter((action) => {
      if (action.target === 'messages') return canSendMessages;
      if (action.target === 'prescriptions') return canRequestRefills;
      return canViewRecords;
    }),
    latestLabResults: latestLabs,
    upcomingAppointments,
    recentActivity: [
      canViewRecords && latestDocument ? {
        id: 'activity-record-updated',
        title: 'Medical Record Updated',
        detail: `${latestDocument.name} is ${String(latestDocument.status || 'available').toLowerCase()}.`,
        occurredAt: latestDocument.updated || latestDocument.updatedAt || '',
        tone: 'info',
      } : null,
      canViewPrescriptions && latestRefill ? {
        id: `activity-${latestRefill.id || 'prescription-refill'}`,
        title: 'Prescription Refill Requested',
        detail: `${latestRefill.prescriptionName || 'Prescription'} was sent to ${latestRefill.pharmacyName || 'the selected pharmacy'}.`,
        occurredAt: latestRefill.createdAt || '',
        tone: 'success',
      } : null,
      canViewMessages && latestConversation ? {
        id: `activity-${latestConversation.id || 'message'}`,
        title: 'New Message',
        detail: `${latestConversation.participantName}: ${latestConversation.preview}`,
        occurredAt: latestConversation.time || latestConversation.updatedAt || '',
        tone: 'message',
      } : null,
    ].filter(Boolean),
    vitals: canViewTrends ? db.healthTrends.metrics.slice(0, 4).map(toDashboardVital) : [],
    security: {
      encrypted: false,
      hipaaMode: false,
      disclaimer: 'Demo portal prototype. Do not use with real patient data without security and compliance review.',
      lastSync: mostRecentTimestamp(db),
    },
  };
}

function buildPatientIdentity(db, user) {
  return {
    age: Number(db.patient?.age || 0),
    location: db.patient?.location || '',
    primaryCondition: db.patient?.primaryCondition || '',
    careTeam: db.patient?.careTeam || '',
    insurance: db.patient?.insurance || '',
    preferredLanguage: db.patient?.preferredLanguage || '',
    emergencyContact: db.patient?.emergencyContact || '',
    name: user.fullName || db.patient?.name,
    identifier: user.patientId ? `Health ID: ${user.patientId}` : db.patient?.identifier || 'Health ID: Unassigned',
    email: user.email,
  };
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}

function isUpcomingAppointment(appointment) {
  if (!['Confirmed', 'Pending'].includes(String(appointment.status || ''))) return false;
  const timestamp = appointmentTime(appointment);
  return Number.isFinite(timestamp) ? timestamp >= startOfToday() : appointment.statusGroup === 'Upcoming';
}

function appointmentTime(appointment) {
  const parsed = Date.parse(`${appointment.date || ''} ${appointment.time || ''}`);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function toDashboardVital(metric) {
  const latestReading = (metric.readings || []).find((reading) => !reading.deletedAt);
  return {
    id: metric.id,
    label: metric.label,
    value: String(latestReading?.value ?? metric.latestValue ?? metric.latest ?? ''),
    unit: String(metric.unit || ''),
    status: String(metric.status || 'Recorded'),
    progress: null,
  };
}

function mostRecentTimestamp(db) {
  const timestamps = [
    ...db.activityLog.map((item) => item.createdAt || item.updatedAt),
    ...db.documents.map((item) => item.updatedAt || item.updated),
    ...db.healthTrends.metrics.map((item) => item.updatedAt || item.readings?.[0]?.recordedAt),
  ].map((value) => Date.parse(value || '')).filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : '';
}
