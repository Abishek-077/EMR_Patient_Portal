import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  getImmunizationDetail,
  getPrintableImmunizationRecord,
  listImmunizations,
} from './immunizations.service.js';

export const immunizationsRouter = Router();

immunizationsRouter.get('/', requireAuth, requirePermission('immunizations.view'), async (_request, response, next) => {
  try {
    response.json(await listImmunizations());
  } catch (error) {
    next(error);
  }
});

immunizationsRouter.get('/printable', requireAuth, requirePermission('immunizations.view'), async (_request, response, next) => {
  try {
    response.json(await getPrintableImmunizationRecord());
  } catch (error) {
    next(error);
  }
});

immunizationsRouter.get('/:recordId', requireAuth, requirePermission('immunizations.view'), async (request, response, next) => {
  try {
    response.json(await getImmunizationDetail(request.params.recordId));
  } catch (error) {
    next(error);
  }
});
