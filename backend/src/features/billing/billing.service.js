import { randomUUID } from 'node:crypto';
import { badRequest, conflict, notFound } from '../../errors.js';
import {
  appendAuditLog,
  filterOwned,
  findOwned,
  getBillingForPatient,
  getPatientId,
  invoiceBalanceDue,
  normalizeInvoiceTotals,
  roundMoney,
  stampPatientOwnership,
} from '../../domain/patient-scope.js';
import { paymentGateway } from '../../providers/index.js';
import { readDb, updateDb } from '../../store.js';

export async function getBillingOverview(user, { status = 'All', query = '' } = {}) {
  const db = await readDb();
  const billing = getBillingForPatient(db, user);
  const normalizedStatus = String(status || 'All');
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const invoices = billing.invoices.filter((invoice) => {
    const statusMatches = normalizedStatus === 'All' || invoice.status === normalizedStatus;
    const queryMatches = !normalizedQuery || [invoice.id, invoice.description]
      .some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    return statusMatches && queryMatches;
  });

  return {
    ...billing,
    invoices,
    pagination: {
      page: 1,
      pageSize: 10,
      total: invoices.length,
    },
  };
}

export async function createPayment(user, input) {
  const billing = await updateDb(async (db) => {
    db.billing.payments ||= [];
    const idempotencyKey = String(input.idempotencyKey || `payment-${randomUUID()}`);
    const existingPayment = findOwned(db.billing.payments, user, (item) => item.idempotencyKey === idempotencyKey);
    if (existingPayment) {
      const requestedAmount = input.amount === null || input.amount === undefined ? null : roundMoney(input.amount);
      if ((input.invoiceId || null) !== (existingPayment.invoiceId || null)
        || (requestedAmount !== null && requestedAmount !== roundMoney(existingPayment.amount))) {
        throw conflict('This idempotency key was already used for a different payment request');
      }
      return getBillingForPatient(db, user);
    }
    const patientBilling = getBillingForPatient(db, user);
    const outstandingBalance = Number(patientBilling.outstandingBalance || 0);
    const invoice = input.invoiceId
      ? findOwned(db.billing.invoices || [], user, (item) => item.id === input.invoiceId)
      : null;
    if (input.invoiceId && !invoice) throw notFound('Invoice not found');
    const normalizedInvoice = invoice ? normalizeInvoiceTotals(invoice) : null;
    if (normalizedInvoice?.status === 'Paid') throw badRequest('Invoice is already paid');

    const invoiceBalance = invoice ? invoiceBalanceDue(invoice) : null;
    const amount = roundMoney(input.amount ?? invoiceBalance ?? outstandingBalance);
    if (outstandingBalance <= 0 || amount <= 0) throw badRequest('There is no outstanding balance to pay');
    if (amount > outstandingBalance) throw badRequest('Payment amount cannot exceed outstanding balance');
    if (invoiceBalance !== null && amount > invoiceBalance) throw badRequest('Payment amount cannot exceed invoice balance');

    const paymentMethodId = input.paymentMethodId || patientBilling.paymentMethods.find((method) => method.isDefault)?.id || '';
    if (!paymentMethodId) throw badRequest('A tokenized payment method is required');
    const method = findOwned(db.billing.paymentMethods || [], user, (item) => item.id === paymentMethodId);
    if (!method) throw notFound('Payment method not found');
    if (!method.tokenReference) throw badRequest('The selected payment method is not tokenized');

    const providerResult = await paymentGateway.charge({
      amountCents: Math.round(amount * 100),
      paymentMethodToken: method.tokenReference,
      idempotencyKey: `${getPatientId(user)}:${idempotencyKey}`,
    });

    const payment = stampPatientOwnership({
      id: `payment-${randomUUID()}`,
      amount,
      amountCents: providerResult.amountCents,
      invoiceId: invoice?.id || null,
      paymentMethodId: method.id,
      status: providerResult.status,
      provider: providerResult.provider,
      providerReference: providerResult.providerPaymentId,
      paymentMethodFingerprint: providerResult.paymentMethodFingerprint,
      idempotencyKey,
      createdAt: providerResult.processedAt,
    }, user);

    db.billing.payments.unshift(payment);

    if (invoice) {
      applyPaymentToInvoice(invoice, amount, payment.createdAt);
    } else {
      let remaining = amount;
      for (const item of (db.billing.invoices || []).filter((candidate) => (
        candidate.patientId === getPatientId(user) && !candidate.deletedAt && invoiceBalanceDue(candidate) > 0
      ))) {
        const applied = Math.min(remaining, invoiceBalanceDue(item));
        applyPaymentToInvoice(item, applied, payment.createdAt);
        remaining = roundMoney(remaining - applied);
        if (remaining <= 0) break;
      }
    }

    appendAuditLog(db, user, 'invoice paid', 'billing', invoice?.id || 'balance', { amount });
    return getBillingForPatient(db, user);
  });

  return billing;
}

export async function addPaymentMethod(user, input) {
  return updateDb((db) => {
    db.billing.paymentMethods ||= [];
    if (input.isDefault) {
      db.billing.paymentMethods = db.billing.paymentMethods.map((method) => (
        method.patientId === getPatientId(user) ? { ...method, isDefault: false } : method
      ));
    }

    const method = stampPatientOwnership({
      id: `method-${randomUUID()}`,
      type: input.type,
      label: sanitizePaymentLabel(input.label),
      detail: input.detail,
      isDefault: input.isDefault,
      tokenReference: `demo-token-${randomUUID()}`,
      mockPaymentMethod: true,
    }, user);
    db.billing.paymentMethods.push(method);
    appendAuditLog(db, user, 'payment method added', 'billingPaymentMethod', method.id);
    return toPublicPaymentMethod(method);
  });
}

export async function updatePaymentMethod(user, methodId, input) {
  const method = await updateDb((db) => {
    const foundMethod = findOwned(db.billing.paymentMethods || [], user, (item) => item.id === methodId);
    if (!foundMethod) return null;
    if (input.isDefault) clearDefaultPaymentMethods(db, user);
    foundMethod.type = input.type;
    foundMethod.label = sanitizePaymentLabel(input.label);
    foundMethod.detail = input.detail;
    foundMethod.isDefault = input.isDefault;
    foundMethod.updatedAt = new Date().toISOString();
    appendAuditLog(db, user, 'payment method updated', 'billingPaymentMethod', foundMethod.id);
    return toPublicPaymentMethod(foundMethod);
  });

  if (!method) throw notFound('Payment method not found');
  return method;
}

export async function setDefaultPaymentMethod(user, methodId) {
  const method = await updateDb((db) => {
    const foundMethod = findOwned(db.billing.paymentMethods || [], user, (item) => item.id === methodId);
    if (!foundMethod) return null;
    clearDefaultPaymentMethods(db, user);
    foundMethod.isDefault = true;
    foundMethod.updatedAt = new Date().toISOString();
    appendAuditLog(db, user, 'default payment method changed', 'billingPaymentMethod', foundMethod.id);
    return toPublicPaymentMethod(foundMethod);
  });

  if (!method) throw notFound('Payment method not found');
  return method;
}

export async function deletePaymentMethod(user, methodId) {
  const method = await updateDb((db) => {
    const foundMethod = findOwned(db.billing.paymentMethods || [], user, (item) => item.id === methodId);
    if (!foundMethod) return null;
    foundMethod.deletedAt = new Date().toISOString();
    foundMethod.updatedAt = foundMethod.deletedAt;
    foundMethod.isDefault = false;
    appendAuditLog(db, user, 'payment method deleted', 'billingPaymentMethod', foundMethod.id);
    return toPublicPaymentMethod(foundMethod);
  });

  if (!method) throw notFound('Payment method not found');
  return method;
}

export async function getStatement(user, statementId = '') {
  const db = await readDb();
  const billing = getBillingForPatient(db, user);
  const statement = statementId
    ? billing.statements.find((item) => item.id === statementId)
    : billing.statements[0];
  if (!statement) throw notFound('Statement not found');

  return {
    ...statement,
    invoices: billing.invoices.filter((invoice) => statement.invoiceIds.includes(invoice.id)),
    balance: billing.outstandingBalance,
  };
}

export async function getInvoiceDetail(user, invoiceId) {
  const db = await readDb();
  const billing = getBillingForPatient(db, user);
  const invoice = billing.invoices.find((item) => item.id === invoiceId);
  if (!invoice) throw notFound('Invoice not found');
  const payments = billing.payments.filter((payment) => payment.invoiceId === invoice.id);
  const statement = billing.statements.find((item) => item.invoiceIds.includes(invoice.id)) || null;

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
    id: String(resource.id || ''),
    title: String(resource.title || ''),
    detail: String(resource.detail || ''),
    generatedAt: new Date().toISOString(),
    body: `${resource.title}\n\n${resource.detail}\n\nThis resource is generated from the local billing profile and current account balance.`,
  };
}

export async function createPaymentSession(user, input = {}) {
  return updateDb((db) => {
    db.billing.paymentSessions ||= [];
    const invoice = input.invoiceId
      ? findOwned(db.billing.invoices || [], user, (item) => item.id === input.invoiceId)
      : null;
    if (input.invoiceId && !invoice) throw notFound('Invoice not found');
    const amount = invoice ? invoiceBalanceDue(invoice) : getBillingForPatient(db, user).outstandingBalance;
    if (amount <= 0) throw badRequest('There is no outstanding balance to pay');
    const session = stampPatientOwnership({
      id: `payment-session-${randomUUID()}`,
      invoiceId: invoice?.id || null,
      amount,
      status: amount > 0 ? 'Ready' : 'No Balance Due',
      qrPayload: `emr-pay://${invoice?.id || 'balance'}?amount=${encodeURIComponent(String(amount))}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    }, user);
    db.billing.paymentSessions.unshift(session);
    return toPublicPaymentSession(session);
  });
}

function applyPaymentToInvoice(invoice, amount, paidAt) {
  const normalized = normalizeInvoiceTotals(invoice);
  const paidAmount = roundMoney(normalized.paidAmount + amount);
  const balanceDue = Math.max(0, roundMoney(normalized.amount - paidAmount));
  invoice.paidAmount = paidAmount;
  invoice.balanceDue = balanceDue;
  invoice.status = balanceDue <= 0 ? 'Paid' : 'Partially Paid';
  invoice.updatedAt = paidAt;
  if (invoice.status === 'Paid') invoice.paidAt = paidAt;
}

function sanitizePaymentLabel(label) {
  const normalized = String(label || '').trim();
  return normalized.replace(/\d(?=\d{4})/g, '*');
}

function clearDefaultPaymentMethods(db, user) {
  for (const method of db.billing.paymentMethods || []) {
    if (method.patientId === getPatientId(user)) method.isDefault = false;
  }
}

export async function createInvoice(user, input) {
  return updateDb((db) => {
    db.billing ||= {};
    db.billing.invoices ||= [];
    const invoice = stampPatientOwnership({
      id: `INV-${new Date().getFullYear()}-${String(randomUUID()).slice(0, 3).toUpperCase()}`,
      date: input.date,
      description: input.description,
      amount: roundMoney(input.amount),
      paidAmount: 0,
      balanceDue: roundMoney(input.amount),
      status: input.status || 'Pending',
      createdAt: new Date().toISOString(),
    }, user);
    db.billing.invoices.unshift(invoice);
    appendAuditLog(db, user, 'invoice created', 'billing', invoice.id, { amount: invoice.amount });
    return toPublicInvoice(invoice);
  });
}

export async function updateInvoice(user, invoiceId, input) {
  const invoice = await updateDb((db) => {
    const found = findOwned(db.billing?.invoices || [], user, (item) => item.id === invoiceId);
    if (!found) return null;
    found.description = input.description;
    found.amount = roundMoney(input.amount);
    found.date = input.date || found.date;
    // Recalculate balance
    found.balanceDue = Math.max(0, roundMoney(found.amount - (found.paidAmount || 0)));
    found.status = found.balanceDue <= 0 ? 'Paid' : (input.status || found.status || 'Pending');
    found.updatedAt = new Date().toISOString();
    appendAuditLog(db, user, 'invoice updated', 'billing', found.id);
    return found;
  });
  if (!invoice) throw notFound('Invoice not found');
  return toPublicInvoice(invoice);
}

export async function deleteInvoice(user, invoiceId) {
  const invoice = await updateDb((db) => {
    const found = findOwned(db.billing?.invoices || [], user, (item) => item.id === invoiceId);
    if (!found) return null;
    found.deletedAt = new Date().toISOString();
    found.updatedAt = found.deletedAt;
    appendAuditLog(db, user, 'invoice deleted', 'billing', found.id);
    return found;
  });
  if (!invoice) throw notFound('Invoice not found');
  return toPublicInvoice(invoice);
}

export async function generateStatement(user) {
  return updateDb((db) => {
    db.billing ||= {};
    db.billing.statements ||= [];
    db.billing.invoices ||= [];
    const patientInvoices = filterOwned(db.billing.invoices || [], user)
      .filter((inv) => inv.status !== 'Paid');
    const now = new Date();
    const period = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const statement = stampPatientOwnership({
      id: `statement-${randomUUID().slice(0, 8)}`,
      invoiceIds: patientInvoices.map((inv) => inv.id),
      period,
      generatedAt: now.toISOString(),
      status: 'Ready',
      createdAt: now.toISOString(),
    }, user);
    db.billing.statements.unshift(statement);
    appendAuditLog(db, user, 'statement generated', 'billing', statement.id);
    return toPublicStatement(statement);
  });
}

function toPublicPaymentMethod(method) {
  return {
    id: String(method.id || ''),
    type: String(method.type || ''),
    label: String(method.label || ''),
    detail: String(method.detail || ''),
    isDefault: Boolean(method.isDefault),
  };
}

function toPublicInvoice(invoice) {
  const normalized = normalizeInvoiceTotals(invoice);
  return {
    id: String(normalized.id || ''),
    date: String(normalized.date || ''),
    dueDate: String(normalized.dueDate || ''),
    description: String(normalized.description || ''),
    category: String(normalized.category || ''),
    amount: normalized.amount,
    amountCents: Math.round(normalized.amount * 100),
    paidAmount: normalized.paidAmount,
    paidAmountCents: Math.round(normalized.paidAmount * 100),
    balanceDue: normalized.balanceDue,
    balanceDueCents: Math.round(normalized.balanceDue * 100),
    status: String(normalized.status || 'Pending'),
    createdAt: normalized.createdAt || '',
    updatedAt: normalized.updatedAt || '',
    paidAt: normalized.paidAt || '',
  };
}

function toPublicPaymentSession(session) {
  return {
    id: String(session.id || ''),
    invoiceId: session.invoiceId || null,
    amount: roundMoney(session.amount),
    amountCents: Math.round(Number(session.amount || 0) * 100),
    status: String(session.status || ''),
    qrPayload: String(session.qrPayload || ''),
    expiresAt: session.expiresAt || '',
    createdAt: session.createdAt || '',
  };
}

function toPublicStatement(statement) {
  return {
    id: String(statement.id || ''),
    invoiceIds: Array.isArray(statement.invoiceIds) ? statement.invoiceIds : [],
    period: String(statement.period || ''),
    generatedAt: statement.generatedAt || statement.createdAt || '',
    status: String(statement.status || 'Ready'),
  };
}
