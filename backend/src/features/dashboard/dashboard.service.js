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
  const canViewReferrals = hasPermission(access, 'referrals.view');
  const canSendMessages = hasPermission(access, 'messages.send');
  const canRequestRefills = hasPermission(access, 'prescriptions.refill');
  const canRequestAppointments = hasPermission(access, 'appointments.request');
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
        id: 'schedule-appointment',
        label: 'Schedule appointment',
        detail: 'Choose an available provider and time',
        target: 'appointments',
        enabled: canRequestAppointments,
        restrictedReason: canRequestAppointments ? '' : 'Your account can view appointments but cannot submit requests.',
      },
      {
        id: 'send-message',
        label: 'Send message',
        detail: latestConversation ? 'Contact your care team securely' : 'Start a secure care-team message',
        target: 'messages',
        enabled: canSendMessages,
        restrictedReason: canSendMessages ? '' : 'Secure messaging is not available for this account.',
      },
      {
        id: 'request-refill',
        label: 'Request refill',
        detail: refillsDue ? `${refillsDue} medication${refillsDue === 1 ? '' : 's'} ready to review` : 'Review current prescriptions',
        target: 'prescriptions',
        enabled: canRequestRefills,
        restrictedReason: canRequestRefills ? '' : 'Refill requests require additional account permission.',
      },
    ],
    attentionItems: buildAttentionItems(db, {
      canViewAppointments,
      canViewPrescriptions,
      canViewBilling,
      canViewReferrals,
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

function buildAttentionItems(db, permissions) {
  const items = [];

  if (permissions.canViewPrescriptions) {
    for (const request of db.refillRequests.filter((item) => ['Pending', 'Queued'].includes(item.status))) {
      items.push({
        id: `attention-refill-${request.id}`,
        type: 'refill',
        title: request.prescriptionName || 'Prescription refill',
        detail: `Requested for ${request.pharmacyName || db.preferredPharmacy?.name || 'your preferred pharmacy'}.`,
        status: request.status === 'Queued' ? 'Queued for clinical review' : 'Pending clinical review',
        tone: 'pending',
        target: 'prescriptions',
        actionLabel: 'Review refill',
        referenceId: request.id,
      });
    }
  }

  if (permissions.canViewReferrals) {
    for (const referral of (db.referrals?.rows || []).filter((item) => item.status === 'Pending')) {
      items.push({
        id: `attention-referral-${referral.id}`,
        type: 'referral',
        title: `${referral.specialty} referral`,
        detail: referral.reason,
        status: 'Pending care-team review',
        tone: 'warning',
        target: 'referrals',
        actionLabel: 'View referral',
        referenceId: referral.id,
      });
    }
  }

  if (permissions.canViewAppointments) {
    for (const request of db.appointmentRequests.filter((item) => ['Pending', 'Queued'].includes(item.status))) {
      items.push({
        id: `attention-appointment-${request.id}`,
        type: 'appointment',
        title: request.reason || 'Appointment request',
        detail: `Preferred date ${patientDate(request.preferredDate)}.`,
        status: 'Awaiting scheduling',
        tone: 'pending',
        target: 'appointments',
        actionLabel: 'Review request',
        referenceId: request.id,
      });
    }
    for (const appointment of db.appointments.filter((item) => item.status === 'Pending').slice(0, 1)) {
      items.push({
        id: `attention-appointment-${appointment.id}`,
        type: 'appointment',
        title: appointment.service || 'Appointment',
        detail: `${patientDate(appointment.date)} at ${appointment.time || 'a time to be confirmed'}.`,
        status: 'Action required: confirm details',
        tone: 'warning',
        target: 'appointments',
        actionLabel: 'View appointment',
        referenceId: appointment.id,
      });
    }
  }

  if (permissions.canViewBilling && Number(db.billing?.outstandingBalance || 0) > 0) {
    items.push({
      id: 'attention-billing-balance',
      type: 'billing',
      title: 'Outstanding balance',
      detail: `${formatNpr(db.billing.outstandingBalance)} due${db.billing.dueDate ? ` by ${db.billing.dueDate}` : ''}.`,
      status: 'Payment due',
      tone: 'error',
      target: 'billing',
      actionLabel: 'Review balance',
      referenceId: 'billing-balance',
    });
  }

  return items.slice(0, 6);
}

function patientDate(value) {
  const date = new Date(`${value || ''}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value || 'Date pending')
    : new Intl.DateTimeFormat('en-NP', { dateStyle: 'medium' }).format(date);
}

function formatNpr(value) {
  return new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR', maximumFractionDigits: 2 }).format(Number(value || 0));
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
