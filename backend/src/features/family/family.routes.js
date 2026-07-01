import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  addDependent,
  getAccessPolicy,
  getFamilyAccess,
  inviteProxy,
  reportUnauthorizedAccess,
  resendProxyInvite,
  revokeProxy,
  updatePrivacySettings,
  updateProxyPermissions,
} from './family.service.js';
import {
  dependentSchema,
  privacySettingsSchema,
  proxyInviteSchema,
  proxyPermissionSchema,
  unauthorizedAccessReportSchema,
} from '../../validation.js';

export const familyRouter = Router();

familyRouter.get('/', requireAuth, requirePermission('family.view'), async (_request, response, next) => {
  try {
    response.json(await getFamilyAccess());
  } catch (error) {
    next(error);
  }
});

familyRouter.post('/proxies', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try {
    response.status(201).json(await inviteProxy(proxyInviteSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

familyRouter.patch('/proxies/:proxyId', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try {
    response.json(await updateProxyPermissions(request.params.proxyId, proxyPermissionSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

familyRouter.post('/proxies/:proxyId/resend', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try {
    response.json(await resendProxyInvite(request.params.proxyId));
  } catch (error) {
    next(error);
  }
});

familyRouter.delete('/proxies/:proxyId', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try {
    response.json(await revokeProxy(request.params.proxyId));
  } catch (error) {
    next(error);
  }
});

familyRouter.post('/dependents', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try {
    response.status(201).json(await addDependent(dependentSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

familyRouter.patch('/privacy', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try {
    response.json(await updatePrivacySettings(privacySettingsSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

familyRouter.post('/reports', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try {
    response.status(201).json(await reportUnauthorizedAccess(unauthorizedAccessReportSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

familyRouter.get('/policy', requireAuth, requirePermission('family.view'), async (_request, response, next) => {
  try {
    response.json(await getAccessPolicy());
  } catch (error) {
    next(error);
  }
});
