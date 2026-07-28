import { useEffect, useState } from 'react';
import { InlineLoading, InlineNotification } from '@carbon/react';
import { Add, Chat, Document, Renew } from '@carbon/icons-react';
import type { PortalRoute } from '../../access-control';
import type { HomeData, PortalData } from '../../../shared/types';
import { homeApi } from '../api';
import '../home.scss';

export function HomePage({
  fallbackPortal,
  onNavigate,
  onBook,
  onMessage,
}: {
  fallbackPortal: PortalData;
  onNavigate: (route: PortalRoute) => void;
  onBook: () => void;
  onMessage: () => void;
}) {
  const [home, setHome] = useState<HomeData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    homeApi.getHome()
      .then((data) => {
        if (alive) setHome(data);
      })
      .catch((requestError) => {
        if (alive) setError(requestError instanceof Error ? requestError.message : 'Could not load home');
      });
    return () => {
      alive = false;
    };
  }, []);

  const data = home || homeFromPortal(fallbackPortal);

  return (
    <main className="portal-main dashboard-page">
      <section className="page-title dashboard-title">
        <div>
          <h1>Home</h1>
          <p>Welcome back, {data.summary.welcomeName}. Your portal is synced for {data.summary.overviewDate}.</p>
        </div>
        <div className="page-actions">
          <button className="secondary-action" type="button" onClick={onMessage}><Chat size={16} /> Message Care Team</button>
          <button className="primary-action" type="button" onClick={onBook}><Add size={16} /> Request Visit</button>
        </div>
      </section>

      {!home && !error && <InlineLoading description="Loading home workspace" />}
      {error && <InlineNotification kind="warning" lowContrast title="Using portal snapshot" subtitle={error} />}

      <section className="quick-grid" aria-label="Home next steps">
        <button className="quick-card quick-card--blue" type="button" onClick={() => onNavigate('registration')}>
          <Document size={29} />
          <strong>Registration Intake</strong>
          <span>{data.summary.registrationStatus} - {data.summary.registrationPercent}% complete</span>
        </button>
        <button className="quick-card" type="button" onClick={() => onNavigate('appointments')}>
          <Add size={29} />
          <strong>Appointments</strong>
          <span>{data.summary.upcomingAppointments} upcoming visit{data.summary.upcomingAppointments === 1 ? '' : 's'}</span>
        </button>
        <button className="quick-card quick-card--gray" type="button" onClick={() => onNavigate('billing')}>
          <Document size={29} />
          <strong>Billing</strong>
          <span>{new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR' }).format(data.summary.outstandingBalance)} outstanding</span>
        </button>
      </section>

      <div className="dashboard-content">
        <section className="o3-panel activity-panel">
          <div className="panel-heading"><h2><Renew size={22} /> Next Steps</h2></div>
          <div className="activity-list">
            {data.nextSteps.map((step) => (
              <article className="activity-row" key={step.id}>
                <span className="activity-icon activity-icon--blue"><Document size={18} /></span>
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                </div>
                <button type="button" onClick={() => onNavigate(step.target as PortalRoute)}>Open</button>
              </article>
            ))}
          </div>
        </section>

        <section className="o3-panel appointment-panel">
          <div className="panel-heading"><h2>Upcoming Care</h2></div>
          <div className="appointment-list">
            {data.upcomingAppointments.map((appointment) => (
              <article className="appointment-card appointment-card--blue" key={appointment.id}>
                <time><strong>{appointment.date.split(' ')[1]?.replace(',', '') || appointment.date}</strong><span>{appointment.date.split(' ')[0] || 'Visit'}</span></time>
                <div>
                  <h3>{appointment.service}</h3>
                  <p>{appointment.provider || appointment.clinician}</p>
                  <button className="link-button" type="button" onClick={() => onNavigate('appointments')}>{appointment.time || 'Time pending'}</button>
                </div>
              </article>
            ))}
            {!data.upcomingAppointments.length && <p className="empty-appointments">No upcoming appointments scheduled.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}

function homeFromPortal(portal: PortalData): HomeData {
  return {
    patient: portal.dashboard.patient,
    summary: {
      welcomeName: portal.dashboard.summary.welcomeName,
      overviewDate: portal.dashboard.summary.overviewDate,
      upcomingAppointments: portal.dashboard.summary.appointmentsUpcoming,
      unreadMessages: portal.dashboard.summary.unreadMessages,
      refillsDue: portal.dashboard.summary.refillsDue,
      outstandingBalance: portal.dashboard.summary.outstandingBalance,
      registrationStatus: portal.registration?.completion.status || 'In Progress',
      registrationPercent: portal.registration?.completion.percent || 0,
    },
    nextSteps: portal.dashboard.quickActions.map((action) => ({
      id: action.id,
      label: action.label,
      detail: action.detail,
      target: action.target,
      priority: action.target === 'appointments' ? 'primary' : 'secondary',
    })),
    upcomingAppointments: portal.dashboard.upcomingAppointments,
    recentActivity: portal.dashboard.recentActivity,
    tasks: portal.tasks,
  };
}
