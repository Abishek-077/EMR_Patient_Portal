import { useEffect, useState } from 'react';
import {
  Button,
  ComposedModal,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  TextInput,
} from '@carbon/react';
import {
  Add,
  Building,
  Document,
  Download,
  Edit,
  Money,
  QrCode,
  Report,
  Search,
  Security,
  TrashCan,
  Wallet,
} from '@carbon/icons-react';
import type {
  BillingData,
  BillingInvoiceInput,
  BillingPaymentMethod,
  BillingPaymentMethodInput,
} from '../../../../shared/types';
import { emptyInvoiceForm, initialPaymentMethodForm } from '../../model/forms';
import {
  OperationStatus,
  StatusTag,
  WorkflowConfirmation,
  type WorkflowConfirmationData,
} from '../components/UXEvidenceComponents';

export type BillingPaymentInput = {
  amount?: number;
  invoiceId?: string;
  paymentMethodId?: string;
};

export function BillingPage({
  billing,
  onPay,
  onSavePaymentMethod,
  onSetDefaultPaymentMethod,
  onDeletePaymentMethod,
  onStatement,
  onInvoice,
  onResource,
  onPaymentSession,
  onSupport,
  onCreateInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onGenerateStatement,
  canPay,
  canManagePaymentMethods,
  canManageInvoices,
}: {
  billing: BillingData;
  onPay: (input?: BillingPaymentInput) => Promise<BillingData>;
  onSavePaymentMethod: (input: BillingPaymentMethodInput, methodId?: string) => Promise<BillingPaymentMethod>;
  onSetDefaultPaymentMethod: (methodId: string) => Promise<void>;
  onDeletePaymentMethod: (methodId: string) => Promise<void>;
  onStatement: () => Promise<void>;
  onInvoice: (invoiceId: string) => Promise<void>;
  onResource: (resourceId: string) => Promise<void>;
  onPaymentSession: (invoiceId?: string) => Promise<void>;
  onSupport: () => void;
  onCreateInvoice: (input: BillingInvoiceInput) => Promise<void>;
  onUpdateInvoice: (invoiceId: string, input: BillingInvoiceInput) => Promise<void>;
  onDeleteInvoice: (invoiceId: string) => Promise<void>;
  onGenerateStatement: () => Promise<void>;
  canPay: boolean;
  canManagePaymentMethods: boolean;
  canManageInvoices: boolean;
}) {
  const [invoiceFilter, setInvoiceFilter] = useState<'All' | 'Paid' | 'Pending' | 'Overdue'>('All');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [paying, setPaying] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(billing.paymentMethods.find((method) => method.isDefault)?.id || billing.paymentMethods[0]?.id || '');
  const [notice, setNotice] = useState('');
  const [methodOpen, setMethodOpen] = useState(false);
  const [editingMethodId, setEditingMethodId] = useState('');
  const [methodForm, setMethodForm] = useState<BillingPaymentMethodInput>(initialPaymentMethodForm);
  const [methodError, setMethodError] = useState('');
  const [methodSaving, setMethodSaving] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState('');
  const [invoiceForm, setInvoiceForm] = useState<BillingInvoiceInput>(emptyInvoiceForm);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState('');
  const [deletingMethodId, setDeletingMethodId] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<BillingData['invoices'][number] | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentConfirmation, setPaymentConfirmation] = useState<WorkflowConfirmationData | null>(null);

  const invoices = billing.invoices
    .filter((invoice) => !invoice.deletedAt)
    .filter((invoice) => invoiceFilter === 'All' || invoice.status === invoiceFilter)
    .filter((invoice) => {
      const query = invoiceQuery.trim().toLowerCase();
      if (!query) return true;
      return [invoice.id, invoice.description, invoice.status].some((value) => String(value).toLowerCase().includes(query));
    });

  useEffect(() => {
    if (!billing.paymentMethods.some((method) => method.id === selectedPaymentMethodId)) {
      setSelectedPaymentMethodId(billing.paymentMethods.find((method) => method.isDefault)?.id || billing.paymentMethods[0]?.id || '');
    }
  }, [billing.paymentMethods, selectedPaymentMethodId]);

  const handlePayment = async (invoice?: BillingData['invoices'][number], requestedAmount?: number) => {
    if (invoice?.status === 'Paid') return;
    if (!selectedPaymentMethodId) {
      setNotice('Add and select a payment method before submitting a payment.');
      return;
    }
    const balanceDue = invoice?.balanceDue ?? invoice?.amount ?? billing.outstandingBalance;
    const amount = requestedAmount ?? balanceDue;
    if (!Number.isFinite(amount) || amount <= 0 || amount > balanceDue) {
      setNotice(`Enter an amount between ${formatNpr(0.01)} and ${formatNpr(balanceDue)}.`);
      return;
    }
    setPaying(true);
    setPayingInvoiceId(invoice?.id || '');
    setNotice('');
    try {
      const updatedBilling = await onPay(invoice ? {
        invoiceId: invoice.id,
        amount,
        paymentMethodId: selectedPaymentMethodId,
      } : {
        paymentMethodId: selectedPaymentMethodId,
      });
      const payment = updatedBilling.payments[0];
      setPaymentConfirmation({
        kind: 'payment',
        heading: 'Payment processed',
        referenceId: payment?.id || invoice?.id || 'Payment recorded',
        status: 'Completed',
        statusTone: 'success',
        details: [
          { label: 'Amount', value: formatNpr(amount) },
          { label: 'Applied to', value: invoice ? `${invoice.id} — ${invoice.description}` : 'Outstanding balance' },
          { label: 'Payment method', value: billing.paymentMethods.find((method) => method.id === selectedPaymentMethodId)?.label || 'Selected payment method' },
          { label: 'Submitted', value: formatPatientDateTime(payment?.createdAt) },
        ],
        nextSteps: 'The balance and invoice status have been updated. You can download an invoice or statement from Billing.',
        nextActionLabel: 'Review billing',
        onNextAction: () => setPaymentConfirmation(null),
      });
      setPaymentOpen(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not process payment');
    } finally {
      setPaying(false);
      setPayingInvoiceId('');
    }
  };

  const handlePaymentMethodSave = async () => {
    if (!methodForm.label.trim() || !methodForm.detail.trim()) {
      setMethodError('Label and details are required.');
      return;
    }
    setMethodSaving(true);
    setMethodError('');
    try {
      const method = await onSavePaymentMethod({
        ...methodForm,
        label: methodForm.label.trim(),
        detail: methodForm.detail.trim(),
      }, editingMethodId || undefined);
      setSelectedPaymentMethodId(method.id);
      setMethodForm(initialPaymentMethodForm);
      setMethodOpen(false);
      setEditingMethodId('');
      setNotice(`${method.label} has been ${editingMethodId ? 'updated' : 'added'}.`);
    } catch (error) {
      setMethodError(error instanceof Error ? error.message : 'Could not add payment method.');
    } finally {
      setMethodSaving(false);
    }
  };

  const openAddMethod = () => {
    setEditingMethodId('');
    setMethodForm(initialPaymentMethodForm);
    setMethodError('');
    setMethodOpen(true);
  };

  const openEditMethod = (method: BillingPaymentMethod) => {
    setEditingMethodId(method.id);
    setMethodForm({ type: method.type, label: method.label, detail: method.detail, isDefault: method.isDefault });
    setMethodError('');
    setMethodOpen(true);
  };

  const makeDefault = async (methodId: string) => {
    setNotice('');
    try {
      await onSetDefaultPaymentMethod(methodId);
      setSelectedPaymentMethodId(methodId);
      setNotice('Default payment method updated.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update the default payment method.');
    }
  };

  const removeMethod = async (method: BillingPaymentMethod) => {
    if (!window.confirm(`Remove ${method.label}?`)) return;
    setDeletingMethodId(method.id);
    setNotice('');
    try {
      await onDeletePaymentMethod(method.id);
      setNotice(`${method.label} removed.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not remove the payment method.');
    } finally {
      setDeletingMethodId('');
    }
  };

  const openPartialPayment = (invoice: BillingData['invoices'][number]) => {
    setPaymentInvoice(invoice);
    setPaymentAmount(invoice.balanceDue ?? invoice.amount);
    setPaymentOpen(true);
  };

  const openCreateInvoice = () => {
    setEditingInvoiceId('');
    setInvoiceForm({ ...emptyInvoiceForm, date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) });
    setInvoiceOpen(true);
  };

  const openEditInvoice = (invoice: BillingData['invoices'][number]) => {
    setEditingInvoiceId(invoice.id);
    setInvoiceForm({ description: invoice.description, amount: invoice.amount, date: invoice.date, status: invoice.status });
    setInvoiceOpen(true);
  };

  const saveInvoice = async () => {
    if (!invoiceForm.description.trim() || !invoiceForm.amount || invoiceForm.amount <= 0) return;
    setInvoiceSaving(true);
    setNotice('');
    try {
      if (editingInvoiceId) {
        await onUpdateInvoice(editingInvoiceId, invoiceForm);
        setNotice(`Invoice ${editingInvoiceId} updated.`);
      } else {
        await onCreateInvoice(invoiceForm);
        setNotice('Invoice created.');
      }
      setInvoiceOpen(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not save invoice.');
    } finally {
      setInvoiceSaving(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm(`Void invoice ${invoiceId}?`)) return;
    setDeletingInvoiceId(invoiceId);
    setNotice('');
    try {
      await onDeleteInvoice(invoiceId);
      setNotice(`Invoice ${invoiceId} deleted.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not delete invoice.');
    } finally {
      setDeletingInvoiceId('');
    }
  };

  return (
    <>
      <main
        className="portal-main billing-page"
        data-ux-law="von-restorff-effect"
        data-nielsen-heuristic="consistency-and-standards match-between-system-and-real-world"
        data-evidence-id="von-restorff-statuses"
      >
        <section className="billing-title"><h1>Billing & Payments</h1><p>Review your medical statements, track invoice history, and manage payment methods.</p></section>
        {notice && <p className="workspace-notice" role={/could not|enter|add/i.test(notice) ? 'alert' : 'status'}>{notice}</p>}

        <div className="billing-top-grid">
          <section className="balance-panel">
            <div><span>Total Outstanding Balance</span>{billing.paymentStatus === 'Due' ? <b>Payment Due: {billing.dueDate || 'Oct 25'}</b> : <b className="paid-label">Paid in Full</b>}</div>
            <strong>{formatNpr(billing.outstandingBalance)}</strong>
            <div className="balance-breakdown">
              <p><span>Consultation</span><strong>{formatNpr(billing.breakdown?.consultation ?? 450)}</strong></p><p><span>Laboratory</span><strong>{formatNpr(billing.breakdown?.laboratory ?? 320.5)}</strong></p><p><span>Radiology</span><strong>{formatNpr(billing.breakdown?.radiology ?? 478)}</strong></p><p><span>Pharmacy</span><strong>{formatNpr(billing.breakdown?.pharmacy ?? 0)}</strong></p>
            </div>
            <footer>
              <button className="primary-action" type="button" disabled={!canPay || !selectedPaymentMethodId || billing.outstandingBalance === 0 || paying} onClick={() => handlePayment()}>
                <Money size={19} /> {!canPay ? 'Payment Restricted' : paying && !payingInvoiceId ? 'Processing...' : billing.outstandingBalance === 0 ? 'Balance Paid' : 'Pay Full Balance'}
              </button>
              <button className="secondary-action" type="button" onClick={onStatement}><Report size={19} /> View Statement</button>
              <button className="secondary-action" type="button" onClick={() => void onGenerateStatement()}><Add size={16} /> Generate Statement</button>
            </footer>
          </section>
          <section className="payment-methods">
            <h2>Payment Methods</h2>
            {billing.paymentMethods.map((method) => (
              <article key={method.id}>
                {method.type === 'Card' ? <Wallet size={22} /> : <Building size={22} />}
                <p><strong>{method.label}</strong><span>{method.detail}</span></p>
                {method.isDefault && <b>Default</b>}
                {canManagePaymentMethods && <>
                  {!method.isDefault && <button type="button" onClick={() => void makeDefault(method.id)}>Set default</button>}
                  <button type="button" aria-label={`Edit ${method.label}`} onClick={() => openEditMethod(method)}><Edit size={14} /></button>
                  <button type="button" aria-label={`Delete ${method.label}`} disabled={deletingMethodId === method.id} onClick={() => void removeMethod(method)}><TrashCan size={14} /></button>
                </>}
              </article>
            ))}
            <label className="payment-method-select" htmlFor="payment-method">
              <span>Use for payment</span>
              <select id="payment-method" value={selectedPaymentMethodId} onChange={(event) => setSelectedPaymentMethodId(event.target.value)}>
                {billing.paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}
              </select>
            </label>
            {!billing.paymentMethods.length && <p>No payment method is available.</p>}
            {canManagePaymentMethods && <button type="button" onClick={openAddMethod}><Add size={20} /> Add New Method</button>}
          </section>
        </div>

        <section className="invoice-panel">
          <header>
            <h2>Invoice History</h2>
            <div>
              {(['All', 'Paid', 'Pending', 'Overdue'] as const).map((filter) => <button className={invoiceFilter === filter ? 'active' : ''} type="button" key={filter} onClick={() => setInvoiceFilter(filter)}>{filter}</button>)}
              <label><Search size={15} /><input aria-label="Search invoices" placeholder="Search invoices..." value={invoiceQuery} onChange={(event) => setInvoiceQuery(event.target.value)} /></label>
              {canManageInvoices && <button className="primary-action" type="button" style={{ marginLeft: '8px' }} onClick={openCreateInvoice}><Add size={16} /> Add Invoice</button>}
            </div>
          </header>
          <div className="invoice-table-wrap">
            <table>
              <thead><tr><th>Invoice ID</th><th>Date</th><th>Service / Description</th><th>Amount</th><th>Balance Due</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.id}</td>
                    <td>{invoice.date}</td>
                    <td>{invoice.description}</td>
                    <td>{formatNpr(invoice.amount)}</td>
                    <td>{formatNpr(invoice.balanceDue ?? invoice.amount)}</td>
                    <td><StatusTag label={invoice.status} tone={invoice.status === 'Paid' ? 'success' : invoice.status === 'Overdue' ? 'error' : 'warning'} /></td>
                    <td>
                      {invoice.status !== 'Paid' && canPay && (
                        <button type="button" disabled={paying || !selectedPaymentMethodId} onClick={() => openPartialPayment(invoice)}>
                          {payingInvoiceId === invoice.id ? 'Processing...' : 'Pay'}
                        </button>
                      )}
                      {canManageInvoices && <button type="button" aria-label={`Edit invoice ${invoice.id}`} onClick={() => openEditInvoice(invoice)}><Edit size={14} /></button>}
                      <button type="button" onClick={() => void onInvoice(invoice.id)}><Download size={14} /></button>
                      {canManageInvoices && <button type="button" disabled={deletingInvoiceId === invoice.id} aria-label={`Delete invoice ${invoice.id}`} onClick={() => void handleDeleteInvoice(invoice.id)}><TrashCan size={14} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer><span>Showing {invoices.length ? `1-${invoices.length}` : '0'} of {billing.invoices.filter((i) => !i.deletedAt).length} invoices</span></footer>
        </section>

        <section className="billing-resources">
          {(billing.resources || []).map((resource, index) => {
            const Icon = index === 0 ? Document : Security;
            return <article key={resource.id}><Icon size={23} /><p><strong>{resource.title}</strong><span>{resource.detail}</span></p><button type="button" onClick={() => void onResource(resource.id)}>Open</button></article>;
          })}
          <aside><h3>Need help with your bill?</h3><p>Contact our financial counselors for payment plans or insurance disputes.</p><button type="button" onClick={onSupport}>Speak with Support</button></aside>
        </section>
        <button className="billing-qr" aria-label="Open billing QR code" title="Open billing QR code" type="button" onClick={() => void onPaymentSession()}><QrCode size={22} /></button>
      </main>

      <ComposedModal open={methodOpen} onClose={() => setMethodOpen(false)} size="sm">
        <ModalHeader title={editingMethodId ? 'Edit payment method' : 'Add payment method'} />
        <ModalBody>
          <Stack gap={5}>
            <label className="payment-method-select" htmlFor="new-payment-method-type">
              <span>Method type</span>
              <select id="new-payment-method-type" value={methodForm.type} onChange={(event) => setMethodForm((current) => ({ ...current, type: event.target.value as BillingPaymentMethodInput['type'] }))}>
                <option>Card</option>
                <option>Bank</option>
              </select>
            </label>
            <TextInput id="new-payment-method-label" labelText="Label" placeholder="Visa **** 4242" value={methodForm.label} onChange={(event) => setMethodForm((current) => ({ ...current, label: event.target.value }))} />
            <TextInput id="new-payment-method-detail" labelText="Details" placeholder="Expires 12/28" value={methodForm.detail} onChange={(event) => setMethodForm((current) => ({ ...current, detail: event.target.value }))} />
            <label className="auth-check" htmlFor="new-payment-method-default">
              <input id="new-payment-method-default" type="checkbox" checked={Boolean(methodForm.isDefault)} onChange={(event) => setMethodForm((current) => ({ ...current, isDefault: event.target.checked }))} />
              <span>Set as default payment method</span>
            </label>
            {methodError && <InlineNotification kind="error" lowContrast title="Cannot add method" subtitle={methodError} />}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setMethodOpen(false)}>Cancel</Button>
          <Button onClick={handlePaymentMethodSave} disabled={methodSaving}>{methodSaving ? 'Saving...' : editingMethodId ? 'Update method' : 'Add method'}</Button>
        </ModalFooter>
      </ComposedModal>

      <ComposedModal open={paymentOpen} onClose={() => setPaymentOpen(false)} size="sm">
        <ModalHeader title={paymentInvoice ? `Pay ${paymentInvoice.id}` : 'Make payment'} />
        <ModalBody>
          <Stack gap={5}>
            <p>Balance due: {formatNpr(paymentInvoice?.balanceDue ?? paymentInvoice?.amount ?? 0)}</p>
            <TextInput id="partial-payment-amount" labelText="Payment amount (NPR)" type="number" min="0.01" step="0.01" max={String(paymentInvoice?.balanceDue ?? paymentInvoice?.amount ?? 0)} value={String(paymentAmount)} onChange={(event) => setPaymentAmount(Number(event.target.value))} />
            <label className="payment-method-select" htmlFor="partial-payment-method"><span>Payment method</span><select id="partial-payment-method" value={selectedPaymentMethodId} onChange={(event) => setSelectedPaymentMethodId(event.target.value)}>{billing.paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
            <OperationStatus busy={paying} busyLabel="Processing payment…" error={notice && /could not/i.test(notice) ? notice : ''} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setPaymentOpen(false)}>Cancel</Button>
          <Button disabled={paying || !paymentInvoice || !selectedPaymentMethodId || paymentAmount <= 0 || paymentAmount > (paymentInvoice?.balanceDue ?? paymentInvoice?.amount ?? 0)} onClick={() => paymentInvoice && void handlePayment(paymentInvoice, paymentAmount)}>{paying ? 'Processing...' : 'Submit payment'}</Button>
        </ModalFooter>
      </ComposedModal>

      <ComposedModal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} size="sm">
        <ModalHeader title={editingInvoiceId ? `Edit Invoice ${editingInvoiceId}` : 'Create Invoice'} />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="invoice-description" labelText="Description" placeholder="Annual Wellness Exam" value={invoiceForm.description} onChange={(event) => setInvoiceForm((c) => ({ ...c, description: event.target.value }))} />
            <TextInput id="invoice-amount" labelText="Amount (NPR)" type="number" min="0.01" step="0.01" value={String(invoiceForm.amount)} onChange={(event) => setInvoiceForm((c) => ({ ...c, amount: Number(event.target.value) }))} />
            <TextInput id="invoice-date" labelText="Date" placeholder="Jan 15, 2024" value={invoiceForm.date || ''} onChange={(event) => setInvoiceForm((c) => ({ ...c, date: event.target.value }))} />
            <label className="payment-method-select" htmlFor="invoice-status">
              <span>Status</span>
              <select id="invoice-status" value={invoiceForm.status || 'Pending'} onChange={(event) => setInvoiceForm((c) => ({ ...c, status: event.target.value }))}>
                <option>Pending</option>
                <option>Overdue</option>
                <option>Paid</option>
              </select>
            </label>
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setInvoiceOpen(false)}>Cancel</Button>
          <Button disabled={invoiceSaving || !invoiceForm.description.trim() || !invoiceForm.amount} onClick={saveInvoice}>
            {invoiceSaving ? 'Saving...' : editingInvoiceId ? 'Update invoice' : 'Create invoice'}
          </Button>
        </ModalFooter>
      </ComposedModal>
      <WorkflowConfirmation confirmation={paymentConfirmation} onClose={() => setPaymentConfirmation(null)} />
    </>
  );
}

function formatNpr(value: number) {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPatientDateTime(value?: string) {
  if (!value) return 'Recorded now';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-NP', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
