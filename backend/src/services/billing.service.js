import { randomUUID } from 'node:crypto';
import { badRequest, notFound } from '../errors.js';
import { readDb, updateDb } from '../store.js';

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
    const amount = input.amount ?? outstandingBalance;
    if (amount <= 0) return db.billing;
    if (amount > outstandingBalance && outstandingBalance > 0) throw badRequest('Payment amount cannot exceed outstanding balance');

    const payment = {
      id: `payment-${randomUUID()}`,
      amount,
      invoiceId: input.invoiceId || null,
      paymentMethodId: input.paymentMethodId || db.billing.paymentMethods.find((method) => method.isDefault)?.id || null,
      createdAt: new Date().toISOString(),
    };

    db.billing.payments.unshift(payment);
    db.billing.outstandingBalance = Math.max(0, Number((outstandingBalance - amount).toFixed(2)));
    db.billing.paymentStatus = db.billing.outstandingBalance === 0 ? 'Paid' : 'Due';

    if (input.invoiceId) {
      const invoice = db.billing.invoices.find((item) => item.id === input.invoiceId);
      if (invoice) invoice.status = 'Paid';
    } else if (db.billing.outstandingBalance === 0) {
      db.billing.invoices = db.billing.invoices.map((invoice) => (
        invoice.status === 'Overdue' || invoice.status === 'Pending' ? { ...invoice, status: 'Paid' } : invoice
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

