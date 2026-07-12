import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  acceptProxyInvitation,
  addDependent,
  deleteDependent,
  getAccessPolicy,
  getFamilyAccess,
  getUnauthorizedAccessReport,
  inviteProxy,
  reportUnauthorizedAccess,
  resendProxyInvite,
  reviewUnauthorizedAccessReport,
  revokeProxy,
  updateDependent,
  updatePrivacySettings,
  updateProxyPermissions,
} from './family.service.js';
import {
  accessReportStatusSchema,
  dependentSchema,
  privacySettingsSchema,
  proxyInvitationAcceptanceSchema,
  proxyInviteSchema,
  proxyPermissionSchema,
  unauthorizedAccessReportSchema,
} from '../../validation.js';

export const familyRouter = Router();

familyRouter.post('/invitations/accept', async (request, response, next) => {
  try { response.json(await acceptProxyInvitation(proxyInvitationAcceptanceSchema(request.body))); }
  catch (error) { next(error); }
});

familyRouter.get('/', requireAuth, requirePermission('family.view'), async (request, response, next) => {
  try { response.json(await getFamilyAccess(request.auth.user)); }
  catch (error) { next(error); }
});

familyRouter.post('/proxies', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try { response.status(202).json(await inviteProxy(request.auth.user, proxyInviteSchema(request.body))); }
  catch (error) { next(error); }
});

familyRouter.patch('/proxies/:proxyId', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try { response.json(await updateProxyPermissions(request.auth.user, request.params.proxyId, proxyPermissionSchema(request.body))); }
  catch (error) { next(error); }
});

familyRouter.post('/proxies/:proxyId/resend', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try { response.json(await resendProxyInvite(request.auth.user, request.params.proxyId)); }
  catch (error) { next(error); }
});

familyRouter.delete('/proxies/:proxyId', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try { response.json(await revokeProxy(request.auth.user, request.params.proxyId)); }
  catch (error) { next(error); }
});

familyRouter.post('/dependents', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try { response.status(201).json(await addDependent(request.auth.user, dependentSchema(request.body))); }
  catch (error) { next(error); }
});

familyRouter.patch('/dependents/:dependentId', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try { response.json(await updateDependent(request.auth.user, request.params.dependentId, dependentSchema(request.body))); }
  catch (error) { next(error); }
});

familyRouter.delete('/dependents/:dependentId', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try { response.json(await deleteDependent(request.auth.user, request.params.dependentId)); }
  catch (error) { next(error); }
});

familyRouter.patch('/privacy', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try { response.json(await updatePrivacySettings(request.auth.user, privacySettingsSchema(request.body))); }
  catch (error) { next(error); }
});

familyRouter.post('/reports', requireAuth, requirePermission('family.manage'), async (request, response, next) => {
  try { response.status(202).json(await reportUnauthorizedAccess(request.auth.user, unauthorizedAccessReportSchema(request.body))); }
  catch (error) { next(error); }
});

familyRouter.get('/reports/:reportId', requireAuth, requirePermission('family.view'), async (request, response, next) => {
  try { response.json(await getUnauthorizedAccessReport(request.auth.user, request.params.reportId)); }
  catch (error) { next(error); }
});

familyRouter.patch('/reports/:reportId/status', requireAuth, requirePermission('family.reports.review'), async (request, response, next) => {
  try { response.json(await reviewUnauthorizedAccessReport(request.auth.user, request.params.reportId, accessReportStatusSchema(request.body))); }
  catch (error) { next(error); }
});

familyRouter.get('/policy', requireAuth, requirePermission('family.view'), async (request, response, next) => {
  try { response.json(await getAccessPolicy(request.auth.user)); }
  catch (error) { next(error); }
});
