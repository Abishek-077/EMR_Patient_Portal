export type PrintableViewRequest = {
  title: string;
  payload: unknown;
};

const PRINTABLE_VIEW_EVENT = 'emr-portal:printable-view';

export function openPrintableView(title: string, payload: unknown) {
  if (typeof window === 'undefined') return false;

  window.dispatchEvent(new CustomEvent<PrintableViewRequest>(PRINTABLE_VIEW_EVENT, {
    detail: { title, payload },
  }));
  return true;
}

export function subscribeToPrintableView(listener: (request: PrintableViewRequest) => void) {
  const handlePrintableView = (event: Event) => {
    listener((event as CustomEvent<PrintableViewRequest>).detail);
  };

  window.addEventListener(PRINTABLE_VIEW_EVENT, handlePrintableView);
  return () => window.removeEventListener(PRINTABLE_VIEW_EVENT, handlePrintableView);
}
