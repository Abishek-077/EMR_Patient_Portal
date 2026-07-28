import { useEffect, useRef, type ReactNode } from 'react';
import {
  Button,
  ComposedModal,
  InlineLoading,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
} from '@carbon/react';
import {
  CheckmarkOutline,
  Error as ErrorIcon,
  Information,
  Time,
  WarningAlt,
} from '@carbon/icons-react';

export type StatusTone = 'success' | 'warning' | 'error' | 'pending' | 'info';

export function StatusTag({ label, tone = 'info' }: { label: string; tone?: StatusTone }) {
  const Icon = tone === 'success'
    ? CheckmarkOutline
    : tone === 'warning'
      ? WarningAlt
      : tone === 'error'
        ? ErrorIcon
        : tone === 'pending'
          ? Time
          : Information;

  return (
    <span className={`ux-status-tag ux-status-tag--${tone}`}>
      <Icon aria-hidden="true" size={16} />
      {label}
    </span>
  );
}

export function OperationStatus({
  busy,
  busyLabel,
  error,
  success,
  evidenceId,
}: {
  busy: boolean;
  busyLabel: string;
  error?: string;
  success?: string;
  evidenceId?: string;
}) {
  return (
    <div
      className="operation-status"
      data-evidence-id={evidenceId}
      data-nielsen-heuristic="visibility-of-system-status recognize-diagnose-recover-errors"
      aria-live="polite"
      aria-atomic="true"
    >
      {busy && <InlineLoading description={busyLabel} />}
      {error && (
        <div className="operation-status__message operation-status__message--error" role="alert">
          <ErrorIcon aria-hidden="true" size={18} />
          <span><strong>We could not complete that action.</strong> {error} Your entered information is still here; review it and try again.</span>
        </div>
      )}
      {!busy && !error && success && (
        <div className="operation-status__message operation-status__message--success" role="status">
          <CheckmarkOutline aria-hidden="true" size={18} />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}

export function AccessibleFormError({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, [children]);

  return (
    <div className="accessible-form-error" id={id} ref={ref} role="alert" tabIndex={-1}>
      <WarningAlt aria-hidden="true" size={18} />
      <span>{children}</span>
    </div>
  );
}

export type WorkflowConfirmationData = {
  kind: 'appointment' | 'refill' | 'payment';
  heading: string;
  referenceId: string;
  status: string;
  statusTone?: StatusTone;
  details: Array<{ label: string; value: string }>;
  nextSteps: string;
  nextActionLabel: string;
  onNextAction: () => void;
};

export function WorkflowConfirmation({
  confirmation,
  onClose,
}: {
  confirmation: WorkflowConfirmationData | null;
  onClose: () => void;
}) {
  return (
    <ComposedModal
      open={Boolean(confirmation)}
      onClose={onClose}
      selectorPrimaryFocus=".workflow-confirmation__heading"
      size="sm"
    >
      <ModalHeader title="Request confirmation" />
      <ModalBody>
        {confirmation && (
          <section
            className="workflow-confirmation"
            data-ux-law="peak-end-rule"
            data-nielsen-heuristic="visibility-of-system-status recognition-rather-than-recall"
            data-evidence-id={`${confirmation.kind}-workflow-confirmation`}
          >
            {/* UX Law: Peak-End Rule — meaningful, specific workflow ending */}
            <CheckmarkOutline className="workflow-confirmation__icon" aria-hidden="true" size={40} />
            <h2 className="workflow-confirmation__heading" tabIndex={-1}>{confirmation.heading}</h2>
            <div className="workflow-confirmation__reference">
              <span>Reference</span>
              <strong>{confirmation.referenceId}</strong>
              <StatusTag label={confirmation.status} tone={confirmation.statusTone || 'pending'} />
            </div>
            <dl>
              {confirmation.details.map((detail) => (
                <div key={detail.label}>
                  <dt>{detail.label}</dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
            <div className="workflow-confirmation__next">
              <h3>What happens next</h3>
              <p>{confirmation.nextSteps}</p>
            </div>
          </section>
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>Return to portal</Button>
        <Button onClick={() => confirmation?.onNextAction()}>{confirmation?.nextActionLabel || 'View details'}</Button>
      </ModalFooter>
    </ComposedModal>
  );
}

export type ConfirmAction = {
  heading: string;
  description: string;
  itemLabel: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

export function ConfirmActionModal({
  action,
  busy,
  error,
  onClose,
}: {
  action: ConfirmAction | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
}) {
  return (
    <ComposedModal open={Boolean(action)} onClose={onClose} size="sm" danger>
      <ModalHeader title={action?.heading || 'Confirm action'} />
      <ModalBody>
        {action && (
          <section
            className="confirm-action"
            data-nielsen-heuristic="user-control-and-freedom error-prevention"
            data-evidence-id="destructive-confirmation"
          >
            {/* Nielsen: User control and freedom — destructive confirmation with safe return */}
            <WarningAlt aria-hidden="true" size={32} />
            <p>{action.description}</p>
            <strong>{action.itemLabel}</strong>
            {error && <AccessibleFormError id="confirm-action-error">{error}</AccessibleFormError>}
          </section>
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" disabled={busy} onClick={onClose}>Keep / Go back</Button>
        <Button kind="danger" disabled={busy} onClick={() => action && void action.onConfirm()}>
          {busy ? 'Working…' : action?.confirmLabel || 'Confirm'}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}

const helpCategories = [
  {
    title: 'Appointments',
    items: ['Schedule from Dashboard or Appointments.', 'Use Cancel to leave a request without saving.', 'Requests remain pending until the care team confirms a time.'],
  },
  {
    title: 'Secure messages',
    items: ['Choose a care-team recipient, add a clear subject, and include non-urgent details.', 'If sending fails, your message remains in the form so you can retry.'],
  },
  {
    title: 'Prescriptions and refills',
    items: ['Review the medication, dosage, prescriber, and preferred pharmacy before submitting.', 'Clinical review is required before a refill is approved.'],
  },
  {
    title: 'Bills and payments',
    items: ['Choose a saved payment method and review the NPR amount before submitting.', 'A payment reference appears after processing.'],
  },
  {
    title: 'Technical support',
    items: ['Use the support form below for sign-in, browser, or portal workflow problems.', 'Do not include passwords or sensitive information that is unrelated to the request.'],
  },
];

export function HelpPanel({
  open,
  canSubmit,
  submitting,
  subject,
  body,
  notice,
  onSubjectChange,
  onBodyChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  canSubmit: boolean;
  submitting: boolean;
  subject: string;
  body: string;
  notice: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <ComposedModal open={open} onClose={onClose} size="lg">
      <ModalHeader title="Patient portal help" />
      <ModalBody>
        <section
          className="help-panel"
          data-nielsen-heuristic="help-and-documentation"
          data-evidence-id="help-documentation"
        >
          {/* Nielsen: Help and documentation — categorized, task-oriented guidance */}
          <div className="help-panel__urgent" role="note">
            <WarningAlt aria-hidden="true" size={24} />
            <p><strong>This portal is not for urgent care.</strong> For urgent or life-threatening symptoms, use the emergency service available in your location. Portal messages may not be reviewed immediately.</p>
          </div>
          <div className="help-panel__categories">
            {helpCategories.map((category) => (
              <article key={category.title}>
                <h2>{category.title}</h2>
                <ul>{category.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            ))}
          </div>
          <div className="help-panel__support">
            <h2>Ask portal support</h2>
            <Stack gap={4}>
              <label htmlFor="support-subject">Subject <span aria-hidden="true">*</span></label>
              <input id="support-subject" value={subject} onChange={(event) => onSubjectChange(event.target.value)} required />
              <label htmlFor="support-body">How can we help? <span aria-hidden="true">*</span></label>
              <textarea id="support-body" value={body} onChange={(event) => onBodyChange(event.target.value)} required />
              <OperationStatus busy={submitting} busyLabel="Submitting support request…" error={notice && !/submitted/i.test(notice) ? notice : ''} success={/submitted/i.test(notice) ? notice : ''} />
            </Stack>
          </div>
        </section>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>Close</Button>
        <Button disabled={!canSubmit || submitting || !subject.trim() || !body.trim()} onClick={onSubmit}>
          {submitting ? 'Submitting…' : canSubmit ? 'Submit support request' : 'Messaging restricted'}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
