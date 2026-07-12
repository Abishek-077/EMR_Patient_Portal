import { Router } from 'express';
import { notFound } from '../../errors.js';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { requestMedication, requestRefill } from '../prescriptions/prescriptions.service.js';
import {
  medicationRequestSchema,
  shareRecordsSchema,
  taskStatusSchema,
} from '../../validation.js';
import { updateDb } from '../../store.js';
import { appendAuditLog, findOwned, updatePatientProfile } from '../../domain/patient-scope.js';
import { env } from '../../config.js';

export const workflowRouter = Router();

workflowRouter.patch('/tasks/:taskId', requireAuth, requirePermission('tasks.manage'), async (request, response, next) => {
  try {
    const { completed } = taskStatusSchema(request.body);
    const task = await updateDb((db) => {
      const foundTask = findOwned(db.tasks || [], request.auth.user, (item) => item.id === request.params.taskId);
      if (!foundTask) return null;
      foundTask.completed = completed;
      foundTask.updatedAt = new Date().toISOString();
      appendAuditLog(db, request.auth.user, 'task updated', 'task', foundTask.id, { completed });
      return foundTask;
    });

    if (!task) throw notFound('Task not found');
    response.json(task);
  } catch (error) {
    next(error);
  }
});

workflowRouter.patch('/preferences/share-records', requireAuth, requirePermission('preferences.manage'), async (request, response, next) => {
  try {
    const { shareRecords } = shareRecordsSchema(request.body);
    const preferences = await updateDb((db) => {
      const profile = updatePatientProfile(db, request.auth.user, {
        preferences: {
          ...updatePatientProfile(db, request.auth.user, {}).preferences,
          shareRecords,
        },
      });
      appendAuditLog(db, request.auth.user, 'share records preference updated', 'preferences');
      return profile.preferences;
    });

    response.json(preferences);
  } catch (error) {
    next(error);
  }
});

workflowRouter.post('/prescriptions/:prescriptionId/refills', requireAuth, requirePermission('prescriptions.refill'), async (request, response, next) => {
  try {
    response.setHeader('Deprecation', 'true');
    response.setHeader('Link', `<${env.apiBasePath}/prescriptions/${encodeURIComponent(request.params.prescriptionId)}/refills>; rel="successor-version"`);
    response.status(202).json(await requestRefill(request.auth.user, request.params.prescriptionId));
  } catch (error) {
    next(error);
  }
});

workflowRouter.post('/medications/requests', requireAuth, requirePermission('prescriptions.request'), async (request, response, next) => {
  try {
    response.setHeader('Deprecation', 'true');
    response.setHeader('Link', `<${env.apiBasePath}/prescriptions/medication-requests>; rel="successor-version"`);
    response.status(202).json(await requestMedication(request.auth.user, medicationRequestSchema(request.body)));
  } catch (error) {
    next(error);
  }
});
