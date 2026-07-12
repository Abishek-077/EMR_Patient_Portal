import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  addTrendGoal,
  addTrendReading,
  deleteTrendGoal,
  deleteTrendReading,
  getHealthTrends,
  getTrendsExport,
  updateTrendGoal,
  updateTrendReading,
} from './trends.service.js';
import { trendGoalSchema, trendReadingSchema } from '../../validation.js';
import { requestedFormat, sendDownload } from '../../shared/http/download.js';

export const trendsRouter = Router();

trendsRouter.get('/', requireAuth, requirePermission('trends.view'), async (request, response, next) => {
  try {
    response.json(await getHealthTrends(request.auth.user, { range: String(request.query.range || '12m') }));
  } catch (error) {
    next(error);
  }
});

trendsRouter.get('/export', requireAuth, requirePermission('trends.view'), async (request, response, next) => {
  try {
    const range = String(request.query.range || '12m');
    const payload = await getTrendsExport(request.auth.user, { range });
    sendDownload(response, {
      format: requestedFormat(request),
      fileName: `health-trends-${range}`,
      title: `Health Trends (${range})`,
      payload,
      rows: payload.readings || payload.metrics || [],
    });
  } catch (error) {
    next(error);
  }
});

// Metric readings
trendsRouter.post('/readings', requireAuth, requirePermission('trends.manage'), async (request, response, next) => {
  try {
    response.status(201).json(await addTrendReading(request.auth.user, trendReadingSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

trendsRouter.patch('/metrics/:metricId/readings/:readingId', requireAuth, requirePermission('trends.manage'), async (request, response, next) => {
  try {
    response.json(await updateTrendReading(
      request.auth.user,
      request.params.metricId,
      request.params.readingId,
      trendReadingSchema(request.body),
    ));
  } catch (error) {
    next(error);
  }
});

trendsRouter.delete('/metrics/:metricId/readings/:readingId', requireAuth, requirePermission('trends.manage'), async (request, response, next) => {
  try {
    response.json(await deleteTrendReading(request.auth.user, request.params.metricId, request.params.readingId));
  } catch (error) {
    next(error);
  }
});

// Goals
trendsRouter.post('/goals', requireAuth, requirePermission('trends.manage'), async (request, response, next) => {
  try {
    response.status(201).json(await addTrendGoal(request.auth.user, trendGoalSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

trendsRouter.patch('/goals/:goalId', requireAuth, requirePermission('trends.manage'), async (request, response, next) => {
  try {
    response.json(await updateTrendGoal(request.auth.user, request.params.goalId, trendGoalSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

trendsRouter.delete('/goals/:goalId', requireAuth, requirePermission('trends.manage'), async (request, response, next) => {
  try {
    response.json(await deleteTrendGoal(request.auth.user, request.params.goalId));
  } catch (error) {
    next(error);
  }
});
