import { readDb } from '../store.js';
import { hasPermission } from '../domain/access-control.js';

export async function getDashboardForPatient(user, access) {
  const db = await readDb();
  const patient = buildPatientIdentity(db, user);
  const canViewAppointments = hasPermission(access, 'appointments.view');
  const canViewMessages = hasPermission(access, 'messages.view');
  const canViewPrescriptions = hasPermission(access, 'prescriptions.view');
  const canViewBilling = hasPermission(access, 'billing.view');
  const canViewRecords = hasPermission(access, 'records.view');
  const upcomingAppointments = canViewAppointments ? db.appointments
    .filter((appointment) => appointment.statusGroup === 'Upcoming' || ['Confirmed', 'Pending'].includes(appointment.status))
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
      careTeam: patient.careTeam,
      primaryCondition: patient.primaryCondition,
    },
    quickActions: [
      {
        id: 'message-care-team',
        label: 'Message my Doctor',
        detail: latestConversation ? `Last message: ${latestConversation.time}` : 'Start a secure thread',
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
      if (action.target === 'messages') return canViewMessages;
      if (action.target === 'prescriptions') return canViewPrescriptions;
      return canViewRecords;
    }),
    latestLabResults: latestLabs,
    upcomingAppointments,
    recentActivity: [
      {
        id: 'activity-record-updated',
        title: 'Medical Record Updated',
        detail: latestDocument
          ? `${latestDocument.name} is ${String(latestDocument.status).toLowerCase()}.`
          : 'Your longitudinal clinical summary is available.',
        occurredAt: latestDocument?.updated || 'Today',
        tone: 'info',
      },
      {
        id: 'activity-prescription-refilled',
        title: latestRefill ? 'Prescription Refill Requested' : 'Prescription Review',
        detail: latestRefill
          ? `${latestRefill.prescriptionName} was sent to ${latestRefill.pharmacyName || 'your preferred pharmacy'}.`
          : `${Math.max(refillsDue, 0)} medication${refillsDue === 1 ? '' : 's'} need refill attention.`,
        occurredAt: latestRefill ? 'Just now' : 'Updated today',
        tone: 'success',
      },
      {
        id: 'activity-new-message',
        title: 'New Message',
        detail: latestConversation
          ? `${latestConversation.participantName}: ${latestConversation.preview}`
          : 'No recent secure messages.',
        occurredAt: latestConversation?.time || 'No unread messages',
        tone: 'message',
      },
    ],
    vitals: [
      { id: 'bp', label: 'Blood Pressure', value: '118/76', unit: 'mmHg', status: 'Optimal', progress: 48 },
      { id: 'heart-rate', label: 'Heart Rate', value: '72', unit: 'BPM', status: 'Normal', progress: 45 },
      { id: 'weight', label: 'Weight', value: '164', unit: 'lbs', status: '-2 lbs since last visit', progress: null },
      { id: 'bmi', label: 'BMI', value: '24.2', unit: '', status: 'Healthy range', progress: null },
    ],
    security: {
      encrypted: true,
      hipaaMode: true,
      lastSync: '2 mins ago',
    },
  };
}

function buildPatientIdentity(db, user) {
  return {
    ...db.patient,
    name: user.fullName || db.patient?.name,
    identifier: user.patientId ? `Health ID: ${user.patientId}` : db.patient?.identifier || 'Health ID: Unassigned',
    email: user.email,
  };
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}
