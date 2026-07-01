import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { getReferralDetail, getReferralExport, listReferrals, requestReferral, updateReferralAction } from './referrals.service.js';
import { referralActionSchema, referralRequestSchema } from '../../validation.js';

export const referralsRouter = Router();

referralsRouter.get('/', requireAuth, requirePermission('referrals.view'), async (request, response, next) => {
  try {
    response.json(await listReferrals({ status: String(request.query.status || 'All Status') }));
  } catch (error) {
    next(error);
  }
});

referralsRouter.post('/', requireAuth, requirePermission('referrals.manage'), async (request, response, next) => {
  try {
    response.status(201).json(await requestReferral(referralRequestSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

referralsRouter.patch('/:referralId/action', requireAuth, requirePermission('referrals.manage'), async (request, response, next) => {
  try {
    response.json(await updateReferralAction(request.params.referralId, referralActionSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

referralsRouter.get('/export', requireAuth, requirePermission('referrals.view'), async (_request, response, next) => {
  try {
    response.json(await getReferralExport());
  } catch (error) {
    next(error);
  }
});

referralsRouter.get('/:referralId', requireAuth, requirePermission('referrals.view'), async (request, response, next) => {
  try {
    response.json(await getReferralDetail(request.params.referralId));
  } catch (error) {
    next(error);
  }
});
