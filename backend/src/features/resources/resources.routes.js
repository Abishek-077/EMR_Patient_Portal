import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { getResourceDetail, listResources, recordResourceInteraction } from './resources.service.js';
import { resourceInteractionSchema } from '../../validation.js';

export const resourcesRouter = Router();

resourcesRouter.get('/', requireAuth, requirePermission('resources.view'), async (request, response, next) => {
  try {
    response.json(await listResources({
      query: String(request.query.query || ''),
      format: String(request.query.format || 'All'),
    }));
  } catch (error) {
    next(error);
  }
});

resourcesRouter.get('/:resourceId', requireAuth, requirePermission('resources.view'), async (request, response, next) => {
  try {
    response.json(await getResourceDetail(request.params.resourceId));
  } catch (error) {
    next(error);
  }
});

resourcesRouter.post('/:resourceId/interactions', requireAuth, requirePermission('resources.view'), async (request, response, next) => {
  try {
    response.status(201).json(await recordResourceInteraction(
      request.params.resourceId,
      resourceInteractionSchema(request.body),
    ));
  } catch (error) {
    next(error);
  }
});
