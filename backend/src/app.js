import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { appointmentsRouter } from './features/appointments/appointments.routes.js';
import { adminRouter } from './features/admin/admin.routes.js';
import { authRouter } from './features/auth/auth.routes.js';
import { billingRouter } from './features/billing/billing.routes.js';
import { dashboardRouter } from './features/dashboard/dashboard.routes.js';
import { familyRouter } from './features/family/family.routes.js';
import { filesRouter } from './features/files/files.routes.js';
import { immunizationsRouter } from './features/immunizations/immunizations.routes.js';
import { messagesRouter } from './features/messages/messages.routes.js';
import { prescriptionsRouter } from './features/prescriptions/prescriptions.routes.js';
import { profileRouter } from './features/profile/profile.routes.js';
import { portalRouter } from './features/portal/portal.routes.js';
import { recordsRouter } from './features/records/records.routes.js';
import { referralsRouter } from './features/referrals/referrals.routes.js';
import { resourcesRouter } from './features/resources/resources.routes.js';
import { trendsRouter } from './features/trends/trends.routes.js';
import { workflowRouter } from './features/workflow/workflow.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const distDir = path.join(rootDir, 'dist');

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '250kb' }));
  app.use(localCors);

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      service: 'emr-patient-portal-backend',
      environment: env.nodeEnv,
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/patient', dashboardRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/prescriptions', prescriptionsRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/records', recordsRouter);
  app.use('/api/trends', trendsRouter);
  app.use('/api/referrals', referralsRouter);
  app.use('/api/family', familyRouter);
  app.use('/api/immunizations', immunizationsRouter);
  app.use('/api/resources', resourcesRouter);
  app.use('/api/files', filesRouter);
  app.use('/api', portalRouter);
  app.use('/api', workflowRouter);

  if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/.*/, (_request, response) => {
      response.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    app.use(notFoundHandler);
  }

  app.use(errorHandler);
  return app;
}

function localCors(request, response, next) {
  const allowedOrigins = new Set([
    `http://${env.host}:5173`,
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ]);
  const origin = request.get('origin');

  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  }

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  next();
}
