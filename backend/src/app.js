import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { env } from './config.js';
import { registerApiRoutes } from './api/routes.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { forbidden } from './errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const distDir = path.join(rootDir, 'dist');

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(express.json({ limit: '250kb' }));
  app.use(localCors);

  registerApiRoutes(app);
  app.use(env.apiBasePath, notFoundHandler);

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
  const allowedOrigins = new Set(env.allowedOrigins);
  const origin = request.get('origin');

  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-CSRF-Token, X-Patient-Context, X-Request-ID');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    response.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, Content-Disposition');
    response.setHeader('Vary', 'Origin');
  } else if (origin && !isSafeMethod(request.method)) {
    next(forbidden('Request origin is not allowed'));
    return;
  }

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  next();
}

function requestContext(request, response, next) {
  const suppliedRequestId = String(request.get('x-request-id') || '').trim();
  request.id = /^[a-zA-Z0-9._:-]{1,128}$/.test(suppliedRequestId) ? suppliedRequestId : randomUUID();
  response.setHeader('X-Request-ID', request.id);
  next();
}

function isSafeMethod(method) {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method);
}
