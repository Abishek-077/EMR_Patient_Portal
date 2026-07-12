import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import { asyncRoute } from '../../shared/http/async-route.js';
import {
  addPaymentMethodController,
  createInvoiceController,
  createPaymentController,
  createPaymentSessionController,
  deleteInvoiceController,
  deletePaymentMethodController,
  generateStatementController,
  getBillingOverviewController,
  getBillingResourceController,
  getInvoiceDetailController,
  getLatestStatementController,
  getStatementController,
  setDefaultPaymentMethodController,
  updateInvoiceController,
  updatePaymentMethodController,
} from './billing.controller.js';

export const billingRouter = Router();

billingRouter.get('/', requireAuth, requirePermission('billing.view'), asyncRoute(getBillingOverviewController));
billingRouter.post('/payments', requireAuth, requirePermission('billing.pay'), asyncRoute(createPaymentController));
billingRouter.post('/payment-methods', requireAuth, requirePermission('billing.paymentMethods.manage'), asyncRoute(addPaymentMethodController));
billingRouter.patch('/payment-methods/:methodId', requireAuth, requirePermission('billing.paymentMethods.manage'), asyncRoute(updatePaymentMethodController));
billingRouter.patch('/payment-methods/:methodId/default', requireAuth, requirePermission('billing.paymentMethods.manage'), asyncRoute(setDefaultPaymentMethodController));
billingRouter.delete('/payment-methods/:methodId', requireAuth, requirePermission('billing.paymentMethods.manage'), asyncRoute(deletePaymentMethodController));
billingRouter.post('/payment-sessions', requireAuth, requirePermission('billing.pay'), asyncRoute(createPaymentSessionController));
billingRouter.get('/statements', requireAuth, requirePermission('billing.view'), asyncRoute(getLatestStatementController));
billingRouter.get('/statements/:statementId', requireAuth, requirePermission('billing.view'), asyncRoute(getStatementController));
billingRouter.get('/invoices/:invoiceId', requireAuth, requirePermission('billing.view'), asyncRoute(getInvoiceDetailController));
billingRouter.post('/invoices', requireAuth, requirePermission('billing.invoices.manage'), asyncRoute(createInvoiceController));
billingRouter.patch('/invoices/:invoiceId', requireAuth, requirePermission('billing.invoices.manage'), asyncRoute(updateInvoiceController));
billingRouter.delete('/invoices/:invoiceId', requireAuth, requirePermission('billing.invoices.manage'), asyncRoute(deleteInvoiceController));
billingRouter.post('/statements/generate', requireAuth, requirePermission('billing.statements.manage'), asyncRoute(generateStatementController));
billingRouter.get('/resources/:resourceId', requireAuth, requirePermission('billing.view'), asyncRoute(getBillingResourceController));
