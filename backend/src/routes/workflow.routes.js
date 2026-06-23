import { Router } from 'express';
import { notFound } from '../errors.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { requestMedication } from '../services/prescriptions.service.js';
import {
  medicationRequestSchema,
  shareRecordsSchema,
  taskStatusSchema,
} from '../validation.js';
import { updateDb } from '../store.js';

export const workflowRouter = Router();

workflowRouter.patch('/tasks/:taskId', requireAuth, requirePermission('tasks.manage'), async (request, response, next) => {
  try {
    const { completed } = taskStatusSchema(request.body);
    const task = await updateDb((db) => {
      const foundTask = db.tasks.find((item) => item.id === request.params.taskId);
      if (!foundTask) return null;
      foundTask.completed = completed;
      foundTask.updatedAt = new Date().toISOString();
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
      db.preferences.shareRecords = shareRecords;
      return db.preferences;
    });

    response.json(preferences);
  } catch (error) {
    next(error);
  }
});

workflowRouter.post('/prescriptions/:prescriptionId/refills', requireAuth, requirePermission('prescriptions.refill'), async (request, response, next) => {
  try {
    const refillRequest = await updateDb((db) => {
      db.refillRequests ||= [];
      db.prescriptions ||= [];
      const prescription = db.prescriptions.find((item) => item.id === request.params.prescriptionId);
      if (!prescription) return null;

      const existingRequest = db.refillRequests.find(
        (item) => item.prescriptionId === prescription.id && item.status === 'Queued',
      );
      if (existingRequest) return existingRequest;

      const createdRequest = {
        id: `refill-${Date.now()}`,
        prescriptionId: prescription.id,
        prescriptionName: prescription.name,
        status: 'Queued',
        createdAt: new Date().toISOString(),
      };
      db.refillRequests.unshift(createdRequest);
      return createdRequest;
    });

    if (!refillRequest) throw notFound('Prescription not found');
    response.status(201).json(refillRequest);
  } catch (error) {
    next(error);
  }
});

workflowRouter.post('/medications/requests', requireAuth, requirePermission('prescriptions.request'), async (request, response, next) => {
  try {
    response.status(201).json(await requestMedication(medicationRequestSchema(request.body)));
  } catch (error) {
    next(error);
  }
});
