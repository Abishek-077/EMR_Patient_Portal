import { billingPaymentSchema, invoiceSchema, paymentMethodSchema } from '../../validation.js';
import {
  addPaymentMethod,
  createInvoice,
  createPayment,
  createPaymentSession,
  deleteInvoice,
  deletePaymentMethod,
  generateStatement,
  getBillingOverview,
  getBillingResource,
  getInvoiceDetail,
  getStatement,
  setDefaultPaymentMethod,
  updateInvoice,
  updatePaymentMethod,
} from './billing.service.js';
import { requestedFormat, sendDownload } from '../../shared/http/download.js';

export async function getBillingOverviewController(request, response) {
  response.json(await getBillingOverview(request.auth.user, {
    status: String(request.query.status || 'All'),
    query: String(request.query.query || ''),
  }));
}

export async function createPaymentController(request, response) {
  response.status(201).json(await createPayment(request.auth.user, billingPaymentSchema(request.body || {})));
}

export async function addPaymentMethodController(request, response) {
  response.status(201).json(await addPaymentMethod(request.auth.user, paymentMethodSchema(request.body)));
}

export async function updatePaymentMethodController(request, response) {
  response.json(await updatePaymentMethod(request.auth.user, request.params.methodId, paymentMethodSchema(request.body)));
}

export async function setDefaultPaymentMethodController(request, response) {
  response.json(await setDefaultPaymentMethod(request.auth.user, request.params.methodId));
}

export async function deletePaymentMethodController(request, response) {
  response.json(await deletePaymentMethod(request.auth.user, request.params.methodId));
}

export async function createPaymentSessionController(request, response) {
  response.status(201).json(await createPaymentSession(request.auth.user, request.body || {}));
}

export async function getLatestStatementController(request, response) {
  const payload = await getStatement(request.auth.user, '');
  sendDownload(response, {
    format: requestedFormat(request),
    fileName: 'billing-statement',
    title: 'Billing Statement',
    payload,
    rows: payload.invoices || [],
  });
}

export async function getStatementController(request, response) {
  const payload = await getStatement(request.auth.user, request.params.statementId || '');
  sendDownload(response, {
    format: requestedFormat(request),
    fileName: request.params.statementId || 'billing-statement',
    title: 'Billing Statement',
    payload,
    rows: payload.invoices || [],
  });
}

export async function getInvoiceDetailController(request, response) {
  const payload = await getInvoiceDetail(request.auth.user, request.params.invoiceId);
  sendDownload(response, {
    format: requestedFormat(request),
    fileName: request.params.invoiceId,
    title: `Invoice ${request.params.invoiceId}`,
    payload,
    rows: [payload.invoice],
  });
}

export async function createInvoiceController(request, response) {
  response.status(201).json(await createInvoice(request.auth.user, invoiceSchema(request.body)));
}

export async function updateInvoiceController(request, response) {
  response.json(await updateInvoice(request.auth.user, request.params.invoiceId, invoiceSchema(request.body)));
}

export async function deleteInvoiceController(request, response) {
  response.json(await deleteInvoice(request.auth.user, request.params.invoiceId));
}

export async function generateStatementController(request, response) {
  response.status(201).json(await generateStatement(request.auth.user));
}

export async function getBillingResourceController(request, response) {
  response.json(await getBillingResource(request.params.resourceId));
}
