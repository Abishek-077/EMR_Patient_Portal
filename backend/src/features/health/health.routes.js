import { Router } from 'express';
import { env } from '../../config.js';

export const healthRouter = Router();

healthRouter.get('/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'emr-patient-portal-backend',
    environment: env.nodeEnv,
  });
});
