import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  cancelReferral,
  getReferralCalendar,
  getReferralContact,
  getReferralDetail,
  getReferralExport,
  listReferrals,
  requestReferral,
  updateReferralAction,
  updateReferralStatus,
} from './referrals.service.js';
import { referralActionSchema, referralRequestSchema, referralStatusSchema } from '../../validation.js';
import { requestedFormat, sendDownload } from '../../shared/http/download.js';

export const referralsRouter = Router();

referralsRouter.get('/', requireAuth, requirePermission('referrals.view'), async (request, response, next) => {
  try {
    response.json(await listReferrals(request.auth.user, {
      status: String(request.query.status || 'All Status'),
      page: request.query.page,
      pageSize: request.query.pageSize,
    }));
  } catch (error) { next(error); }
});

referralsRouter.post('/', requireAuth, requirePermission('referrals.manage'), async (request, response, next) => {
  try { response.status(202).json(await requestReferral(request.auth.user, referralRequestSchema(request.body))); }
  catch (error) { next(error); }
});

referralsRouter.get('/export', requireAuth, requirePermission('referrals.view'), async (request, response, next) => {
  try {
    const payload = await getReferralExport(request.auth.user);
    sendDownload(response, {
      format: requestedFormat(request),
      fileName: 'referrals',
      title: 'Referral Report',
      payload,
      rows: payload.referrals || payload.rows || [],
    });
  } catch (error) { next(error); }
});

referralsRouter.get('/:referralId/contact', requireAuth, requirePermission('referrals.view'), async (request, response, next) => {
  try { response.json(await getReferralContact(request.auth.user, request.params.referralId)); }
  catch (error) { next(error); }
});

referralsRouter.get('/:referralId/calendar', requireAuth, requirePermission('referrals.view'), async (request, response, next) => {
  try { response.json(await getReferralCalendar(request.auth.user, request.params.referralId)); }
  catch (error) { next(error); }
});

referralsRouter.patch('/:referralId/action', requireAuth, requirePermission('referrals.manage'), async (request, response, next) => {
  try { response.json(await updateReferralAction(request.auth.user, request.params.referralId, referralActionSchema(request.body))); }
  catch (error) { next(error); }
});

referralsRouter.patch('/:referralId/status', requireAuth, requirePermission('referrals.review'), async (request, response, next) => {
  try { response.json(await updateReferralStatus(request.auth.user, request.params.referralId, referralStatusSchema(request.body))); }
  catch (error) { next(error); }
});

referralsRouter.delete('/:referralId', requireAuth, requirePermission('referrals.manage'), async (request, response, next) => {
  try { response.json(await cancelReferral(request.auth.user, request.params.referralId)); }
  catch (error) { next(error); }
});

referralsRouter.get('/:referralId', requireAuth, requirePermission('referrals.view'), async (request, response, next) => {
  try { response.json(await getReferralDetail(request.auth.user, request.params.referralId)); }
  catch (error) { next(error); }
});
