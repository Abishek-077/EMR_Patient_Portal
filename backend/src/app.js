import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from './config.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { appointmentsRouter } from './routes/appointments.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { billingRouter } from './routes/billing.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { messagesRouter } from './routes/messages.routes.js';
import { prescriptionsRouter } from './routes/prescriptions.routes.js';
import { profileRouter } from './routes/profile.routes.js';
import { portalRouter } from './routes/portal.routes.js';
import { workflowRouter } from './routes/workflow.routes.js';

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
