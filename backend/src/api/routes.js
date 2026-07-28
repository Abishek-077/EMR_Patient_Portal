import { adminRouter } from '../features/admin/admin.routes.js';
import { appointmentsRouter } from '../features/appointments/appointments.routes.js';
import { authRouter } from '../features/auth/auth.routes.js';
import { billingRouter } from '../features/billing/billing.routes.js';
import { dashboardRouter } from '../features/dashboard/dashboard.routes.js';
import { filesRouter } from '../features/files/files.routes.js';
import { healthRouter } from '../features/health/health.routes.js';
import { homeRouter } from '../features/home/home.routes.js';
import { immunizationsRouter } from '../features/immunizations/immunizations.routes.js';
import { messagesRouter } from '../features/messages/messages.routes.js';
import { notificationsRouter } from '../features/notifications/notifications.routes.js';
import { portalRouter } from '../features/portal/portal.routes.js';
import { prescriptionsRouter } from '../features/prescriptions/prescriptions.routes.js';
import { profileRouter } from '../features/profile/profile.routes.js';
import { registrationRouter } from '../features/registration/registration.routes.js';
import { recordsRouter } from '../features/records/records.routes.js';
import { resourcesRouter } from '../features/resources/resources.routes.js';
import { trendsRouter } from '../features/trends/trends.routes.js';
import { workflowRouter } from '../features/workflow/workflow.routes.js';
import { env } from '../config.js';

const apiRoutes = [
  ['', healthRouter],
  ['/auth', authRouter],
  ['/admin', adminRouter],
  ['/patient', homeRouter],
  ['/patient', dashboardRouter],
  ['/registration', registrationRouter],
  ['/appointments', appointmentsRouter],
  ['/messages', messagesRouter],
  ['', notificationsRouter],
  ['/prescriptions', prescriptionsRouter],
  ['/billing', billingRouter],
  ['/profile', profileRouter],
  ['/records', recordsRouter],
  ['/trends', trendsRouter],
  ['/immunizations', immunizationsRouter],
  ['/resources', resourcesRouter],
  ['/files', filesRouter],
  ['', portalRouter],
  ['', workflowRouter],
];

export function registerApiRoutes(app) {
  for (const [basePath, router] of apiRoutes) {
    app.use(`${env.apiBasePath}${basePath}`, router);
  }
}
