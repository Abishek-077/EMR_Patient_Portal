import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { getResourceDetail, getResourceDownload, listResources, recordResourceInteraction, unsaveResource } from './resources.service.js';
import { resourceInteractionSchema } from '../../validation.js';

export const resourcesRouter = Router();

resourcesRouter.get('/', requireAuth, requirePermission('resources.view'), async (request, response, next) => {
  try {
    response.json(await listResources(request.auth.user, {
      query: String(request.query.query || ''),
      format: String(request.query.format || 'All'),
      category: String(request.query.category || 'All'),
      page: request.query.page,
      pageSize: request.query.pageSize,
    }));
  } catch (error) { next(error); }
});

resourcesRouter.get('/:resourceId/download', requireAuth, requirePermission('resources.interact'), async (request, response, next) => {
  try {
    const download = await getResourceDownload(request.params.resourceId);
    await recordResourceInteraction(request.auth.user, request.params.resourceId, { action: 'Download' });
    response.setHeader('Content-Type', download.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${download.fileName}"`);
    response.send(download.body);
  } catch (error) { next(error); }
});

resourcesRouter.get('/:resourceId', requireAuth, requirePermission('resources.view'), async (request, response, next) => {
  try { response.json(await getResourceDetail(request.params.resourceId)); }
  catch (error) { next(error); }
});

resourcesRouter.post('/:resourceId/interactions', requireAuth, requirePermission('resources.interact'), async (request, response, next) => {
  try {
    response.status(201).json(await recordResourceInteraction(request.auth.user, request.params.resourceId, resourceInteractionSchema(request.body)));
  } catch (error) { next(error); }
});

resourcesRouter.delete('/:resourceId/interactions/save', requireAuth, requirePermission('resources.interact'), async (request, response, next) => {
  try { response.json(await unsaveResource(request.auth.user, request.params.resourceId)); }
  catch (error) { next(error); }
});
