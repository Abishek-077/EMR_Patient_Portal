import type { ReactNode } from 'react';
import {
  Button,
  ComposedModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@carbon/react';
import { Printer } from '@carbon/icons-react';
import type { PrintableViewRequest } from '../controller/printable-view';

type PrintablePreviewModalProps = {
  preview: PrintableViewRequest | null;
  onClose: () => void;
};

function toLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

function PreviewValue({ value }: { value: unknown }): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="printable-preview-empty">Not provided</span>;
  }

  if (Array.isArray(value)) {
    if (!value.length) return <span className="printable-preview-empty">No items</span>;
    return (
      <ul className="printable-preview-list">
        {value.map((item, index) => <li key={index}><PreviewValue value={item} /></li>)}
      </ul>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return <span className="printable-preview-empty">No details</span>;
    return (
      <dl className="printable-preview-fields">
        {entries.map(([key, item]) => (
          <div key={key}>
            <dt>{toLabel(key)}</dt>
            <dd><PreviewValue value={item} /></dd>
          </div>
        ))}
      </dl>
    );
  }

  return String(value);
}

export function PrintablePreviewModal({ preview, onClose }: PrintablePreviewModalProps) {
  return (
    <ComposedModal
      className="printable-preview-modal"
      open={Boolean(preview)}
      onClose={onClose}
      size="lg"
    >
      <ModalHeader title={preview?.title || 'Details'} />
      <ModalBody>
        <article className="printable-preview" aria-label={preview?.title || 'Details'}>
          <h1>{preview?.title || 'Details'}</h1>
          <PreviewValue value={preview?.payload} />
        </article>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onClose}>Close</Button>
        <Button renderIcon={Printer} onClick={() => window.print()}>Print</Button>
      </ModalFooter>
    </ComposedModal>
  );
}
