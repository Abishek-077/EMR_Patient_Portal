import { randomUUID } from 'node:crypto';
import { badRequest, notFound } from '../../errors.js';
import { readDb, updateDb } from '../../store.js';

export async function getBillingOverview({ status = 'All', query = '' } = {}) {
  const db = await readDb();
  const normalizedStatus = String(status || 'All');
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const invoices = db.billing.invoices.filter((invoice) => {
    const statusMatches = normalizedStatus === 'All' || invoice.status === normalizedStatus;
    const queryMatches = !normalizedQuery || [invoice.id, invoice.description].some((value) => value.toLowerCase().includes(normalizedQuery));
    return statusMatches && queryMatches;
  });

  return {
    ...db.billing,
    invoices,
    pagination: {
      page: 1,
      pageSize: 10,
      total: invoices.length,
    },
  };
}

export async function createPayment(input) {
  const billing = await updateDb((db) => {
    db.billing.payments ||= [];
    const outstandingBalance = Number(db.billing.outstandingBalance || 0);
    const invoice = input.invoiceId
      ? db.billing.invoices.find((item) => item.id === input.invoiceId)
      : null;
    if (input.invoiceId && !invoice) throw notFound('Invoice not found');
    if (invoice?.status === 'Paid') throw badRequest('Invoice is already paid');

    const invoiceAmount = invoice ? Number(invoice.amount || 0) : null;
    const amount = input.amount ?? invoiceAmount ?? outstandingBalance;
    if (amount <= 0) return db.billing;
    if (amount > outstandingBalance && outstandingBalance > 0) throw badRequest('Payment amount cannot exceed outstanding balance');
    if (invoiceAmount !== null && amount > invoiceAmount) throw badRequest('Payment amount cannot exceed invoice amount');

    const payment = {
      id: `payment-${randomUUID()}`,
      amount,
      invoiceId: invoice?.id || null,
      paymentMethodId: input.paymentMethodId || db.billing.paymentMethods.find((method) => method.isDefault)?.id || null,
      createdAt: new Date().toISOString(),
    };

    db.billing.payments.unshift(payment);
    db.billing.outstandingBalance = Math.max(0, Number((outstandingBalance - amount).toFixed(2)));
    db.billing.paymentStatus = db.billing.outstandingBalance === 0 ? 'Paid' : 'Due';

    if (invoice) {
      invoice.status = 'Paid';
      invoice.paidAt = payment.createdAt;
    } else if (db.billing.outstandingBalance === 0) {
      db.billing.invoices = db.billing.invoices.map((invoice) => (
        invoice.status === 'Overdue' || invoice.status === 'Pending' ? { ...invoice, status: 'Paid', paidAt: payment.createdAt } : invoice
      ));
    }

    return db.billing;
  });

  return billing;
}

export async function addPaymentMethod(input) {
  return updateDb((db) => {
    db.billing.paymentMethods ||= [];
    if (input.isDefault) {
      db.billing.paymentMethods = db.billing.paymentMethods.map((method) => ({ ...method, isDefault: false }));
    }

    const method = {
      id: `method-${randomUUID()}`,
      ...input,
    };
    db.billing.paymentMethods.push(method);
    return method;
  });
}

export async function getStatement(statementId = '') {
  const db = await readDb();
  const statement = statementId
    ? db.billing.statements.find((item) => item.id === statementId)
    : db.billing.statements[0];
  if (!statement) throw notFound('Statement not found');

  return {
    ...statement,
    invoices: db.billing.invoices.filter((invoice) => statement.invoiceIds.includes(invoice.id)),
    balance: db.billing.outstandingBalance,
  };
}

export async function getInvoiceDetail(invoiceId) {
  const db = await readDb();
  const invoice = db.billing.invoices.find((item) => item.id === invoiceId);
  if (!invoice) throw notFound('Invoice not found');
  const payments = (db.billing.payments || []).filter((payment) => payment.invoiceId === invoice.id);
  const statement = (db.billing.statements || []).find((item) => item.invoiceIds.includes(invoice.id)) || null;

  return {
    invoice,
    payments,
    statement,
    generatedAt: new Date().toISOString(),
    printable: true,
  };
}

export async function getBillingResource(resourceId) {
  const db = await readDb();
  const resource = (db.billing.resources || []).find((item) => item.id === resourceId);
  if (!resource) throw notFound('Billing resource not found');

  return {
    ...resource,
    generatedAt: new Date().toISOString(),
    body: `${resource.title}\n\n${resource.detail}\n\nThis resource is generated from the local billing profile and current account balance.`,
  };
}

export async function createPaymentSession(input = {}) {
  return updateDb((db) => {
    db.billing.paymentSessions ||= [];
    const invoice = input.invoiceId
      ? db.billing.invoices.find((item) => item.id === input.invoiceId)
      : null;
    if (input.invoiceId && !invoice) throw notFound('Invoice not found');
    const amount = invoice ? invoice.amount : db.billing.outstandingBalance;
    const session = {
      id: `payment-session-${randomUUID()}`,
      invoiceId: invoice?.id || null,
      amount,
      status: amount > 0 ? 'Ready' : 'No Balance Due',
      qrPayload: `emr-pay://${invoice?.id || 'balance'}?amount=${encodeURIComponent(String(amount))}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.billing.paymentSessions.unshift(session);
    return session;
  });
}
