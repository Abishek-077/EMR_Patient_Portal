import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  createAdminUser,
  deleteAdminUser,
  getAccessControlOverview,
  updateRolePermissions,
  updateUserAccess,
} from './admin-access.service.js';
import { createUserSchema, rolePermissionsSchema, userAccessSchema } from '../../validation.js';

export const adminRouter = Router();

adminRouter.use(requireAuth);

adminRouter.get('/access-control', requirePermission('admin.access.view'), async (_request, response, next) => {
  try {
    response.json(await getAccessControlOverview());
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/access-control/roles/:roleId', requirePermission('admin.access.manage'), async (request, response, next) => {
  try {
    const { permissions } = rolePermissionsSchema(request.body);
    response.json(await updateRolePermissions(request.auth.actor, request.params.roleId, permissions));
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/users/:userId/access', requirePermission('admin.users.manage'), async (request, response, next) => {
  try {
    response.json(await updateUserAccess(request.auth.actor, request.params.userId, userAccessSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/users', requirePermission('admin.users.manage'), async (request, response, next) => {
  try {
    response.status(201).json(await createAdminUser(request.auth.actor, createUserSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/users/:userId', requirePermission('admin.users.manage'), async (request, response, next) => {
  try {
    response.json(await deleteAdminUser(request.auth.actor, request.params.userId));
  } catch (error) {
    next(error);
  }
});
