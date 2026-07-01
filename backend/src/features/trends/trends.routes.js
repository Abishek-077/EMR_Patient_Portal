import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { getHealthTrends, getTrendsExport } from './trends.service.js';

export const trendsRouter = Router();

trendsRouter.get('/', requireAuth, requirePermission('trends.view'), async (request, response, next) => {
  try {
    response.json(await getHealthTrends({ range: String(request.query.range || '12m') }));
  } catch (error) {
    next(error);
  }
});

trendsRouter.get('/export', requireAuth, requirePermission('trends.view'), async (request, response, next) => {
  try {
    response.json(await getTrendsExport({ range: String(request.query.range || '12m') }));
  } catch (error) {
    next(error);
  }
});
