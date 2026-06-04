import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { addPaymentMethod, createPayment, getBillingOverview, getStatement } from '../services/billing.service.js';
import { billingPaymentSchema, paymentMethodSchema } from '../validation.js';

export const billingRouter = Router();

billingRouter.get('/', requireAuth, async (request, response, next) => {
  try {
    response.json(await getBillingOverview({
      status: String(request.query.status || 'All'),
      query: String(request.query.query || ''),
    }));
  } catch (error) {
    next(error);
  }
});

billingRouter.post('/payments', requireAuth, async (request, response, next) => {
  try {
    response.status(201).json(await createPayment(billingPaymentSchema(request.body || {})));
  } catch (error) {
    next(error);
  }
});

billingRouter.post('/payment-methods', requireAuth, async (request, response, next) => {
  try {
    response.status(201).json(await addPaymentMethod(paymentMethodSchema(request.body)));
  } catch (error) {
    next(error);
  }
});

billingRouter.get('/statements', requireAuth, async (_request, response, next) => {
  try {
    response.json(await getStatement(''));
  } catch (error) {
    next(error);
  }
});

billingRouter.get('/statements/:statementId', requireAuth, async (request, response, next) => {
  try {
    response.json(await getStatement(request.params.statementId || ''));
  } catch (error) {
    next(error);
  }
});
