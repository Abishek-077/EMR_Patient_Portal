import { hasPermission } from '../../domain/access-control.js';
import { scopeDbToPatient } from '../../domain/patient-scope.js';
import { readDb } from '../../store.js';
import { getDashboardForPatient } from '../dashboard/dashboard.service.js';
import { getRegistrationIntake } from '../registration/registration.service.js';

export async function getHomeForPatient(user, access) {
  const db = scopeDbToPatient(await readDb(), user);
  const dashboard = await getDashboardForPatient(user, access);
  const registration = hasPermission(access, 'registration.view')
    ? await getRegistrationIntake(user)
    : null;

  return {
    patient: dashboard.patient,
    summary: {
      welcomeName: dashboard.summary.welcomeName,
      overviewDate: dashboard.summary.overviewDate,
      upcomingAppointments: dashboard.summary.appointmentsUpcoming,
      unreadMessages: dashboard.summary.unreadMessages,
      refillsDue: dashboard.summary.refillsDue,
      outstandingBalance: dashboard.summary.outstandingBalance,
      registrationStatus: registration?.completion.status || 'Unavailable',
      registrationPercent: registration?.completion.percent || 0,
    },
    nextSteps: [
      registration && registration.completion.percent < 100
        ? {
          id: 'complete-registration',
          label: 'Complete registration intake',
          detail: `${registration.completion.percent}% complete`,
          target: 'registration',
          priority: 'High',
        }
        : null,
      hasPermission(access, 'appointments.request')
        ? {
          id: 'schedule-visit',
          label: 'Schedule or request a visit',
          detail: dashboard.upcomingAppointments[0]?.date || 'Choose a preferred appointment time',
          target: 'appointments',
          priority: 'Medium',
        }
        : null,
      hasPermission(access, 'messages.send')
        ? {
          id: 'message-care-team',
          label: 'Message your care team',
          detail: db.messageConversations[0]?.preview || 'Start a secure conversation',
          target: 'messages',
          priority: 'Medium',
        }
        : null,
    ].filter(Boolean),
    upcomingAppointments: dashboard.upcomingAppointments,
    recentActivity: dashboard.recentActivity,
    tasks: hasPermission(access, 'tasks.manage') ? db.tasks.slice(0, 5) : [],
  };
}
