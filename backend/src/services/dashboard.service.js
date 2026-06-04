import { readDb } from '../store.js';

export async function getDashboardForPatient(user) {
  const db = await readDb();
  const patient = buildPatientIdentity(db, user);
  const upcomingAppointments = db.appointments.slice(0, 3);
  const unreadMessages = db.messages.filter((message) => !message.outbound).length;
  const refillsDue = db.prescriptions.filter((item) => item.status === 'Refill Due').length;
  const latestLabs = db.labResults.slice(0, 4);

  return {
    patient,
    summary: {
      welcomeName: firstName(patient.name),
      healthId: patient.identifier,
      overviewDate: 'Friday, October 27, 2023',
      appointmentsUpcoming: upcomingAppointments.length,
      unreadMessages,
      refillsDue,
      outstandingBalance: db.billing.outstandingBalance,
      careTeam: patient.careTeam,
      primaryCondition: patient.primaryCondition,
    },
    quickActions: [
      {
        id: 'message-care-team',
        label: 'Message my Doctor',
        detail: 'Last message: Oct 20',
        target: 'messages',
        priority: 'primary',
      },
      {
        id: 'refill-prescriptions',
        label: 'Refill Prescriptions',
        detail: `${Math.max(refillsDue, 1)} refills available`,
        target: 'prescriptions',
        priority: 'secondary',
      },
      {
        id: 'view-records',
        label: 'View Records',
        detail: 'Updated 2 days ago',
        target: 'records',
        priority: 'neutral',
      },
    ],
    latestLabResults: latestLabs,
    upcomingAppointments,
    recentActivity: [
      {
        id: 'activity-record-updated',
        title: 'Medical Record Updated',
        detail: 'Visit summary from Cardiology Consultation is now available.',
        occurredAt: 'Today, 10:45 AM',
        tone: 'info',
      },
      {
        id: 'activity-prescription-refilled',
        title: 'Prescription Refilled',
        detail: 'Lisinopril 10mg is ready for pickup at Main Pharmacy.',
        occurredAt: 'Yesterday, 4:20 PM',
        tone: 'success',
      },
      {
        id: 'activity-new-message',
        title: 'New Message',
        detail: 'Dr. Wilson replied to your query about recent labs.',
        occurredAt: 'Oct 25, 11:15 AM',
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
    name: db.patient?.name || user.fullName,
    identifier: db.patient?.identifier || `Health ID: ${user.patientId || 'Unassigned'}`,
    email: user.email,
  };
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}

