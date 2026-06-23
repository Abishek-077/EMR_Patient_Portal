import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { addPaymentMethod, createPayment, getBillingOverview, getStatement } from '../services/billing.service.js';
import { billingPaymentSchema, paymentMethodSchema } from '../validation.js';

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
