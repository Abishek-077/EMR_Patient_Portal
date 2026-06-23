import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  getAccessControlOverview,
  updateRolePermissions,
  updateUserAccess,
} from '../services/admin-access.service.js';
import { rolePermissionsSchema, userAccessSchema } from '../validation.js';

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
    response.json(await updateRolePermissions(request.auth.user, request.params.roleId, permissions));
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/users/:userId/access', requirePermission('admin.users.manage'), async (request, response, next) => {
  try {
    response.json(await updateUserAccess(request.auth.user, request.params.userId, userAccessSchema(request.body)));
  } catch (error) {
    next(error);
  }
});
