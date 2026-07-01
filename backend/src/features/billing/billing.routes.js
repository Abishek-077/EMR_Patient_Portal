import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  addPaymentMethod,
  createPayment,
  createPaymentSession,
  getBillingOverview,
  getBillingResource,
  getInvoiceDetail,
  getStatement,
} from './billing.service.js';
import { billingPaymentSchema, paymentMethodSchema } from '../../validation.js';

export const billingRouter = Router();

billingRouter.get('/', requireAuth, requirePermission('billing.view'), async (request, response, next) => {
  try {
    response.json(await getBillingOverview({
      status: String(request.query.status || 'All'),
      query: String(request.query.query || ''),
    }));
  } catch (error) {
    next(error);
  }
});

billingRouter.post('/payments', requireAuth, requirePermission('billing.pay'), async (request, response, next) => {
  try {
    response.status(201).json(await createPayment(billingPaymentSchema(request.body || {})));
  } catch (error) {
    next(error);
  }
});

billingRouter.post('/payment-methods', requireAuth, requirePermission('billing.paymentMethods.manage'), async (request, response, next) => {
  try {
    response.status(201).json(await addPaymentMethod(paymentMethodSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

billingRouter.post('/payment-sessions', requireAuth, requirePermission('billing.pay'), async (request, response, next) => {
  try {
    response.status(201).json(await createPaymentSession(request.body || {}));
  } catch (error) {
    next(error);
  }
});

billingRouter.get('/statements', requireAuth, requirePermission('billing.view'), async (_request, response, next) => {
  try {
    response.json(await getStatement(''));
  } catch (error) {
    next(error);
  }
});

billingRouter.get('/statements/:statementId', requireAuth, requirePermission('billing.view'), async (request, response, next) => {
  try {
    response.json(await getStatement(request.params.statementId || ''));
  } catch (error) {
    next(error);
  }
});

billingRouter.get('/invoices/:invoiceId', requireAuth, requirePermission('billing.view'), async (request, response, next) => {
  try {
    response.json(await getInvoiceDetail(request.params.invoiceId));
  } catch (error) {
    next(error);
  }
});

billingRouter.get('/resources/:resourceId', requireAuth, requirePermission('billing.view'), async (request, response, next) => {
  try {
    response.json(await getBillingResource(request.params.resourceId));
  } catch (error) {
    next(error);
  }
});
