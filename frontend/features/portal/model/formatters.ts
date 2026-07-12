import type { LabResult, PortalData } from '../../../shared/types';

export function labKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function labStatus(lab: LabResult) {
  if (lab.tone === 'good') return 'NORMAL';
  return /vitamin|low/i.test(lab.label) ? 'LOW' : 'HIGH';
}

export function labTone(lab: LabResult) {
  const status = labStatus(lab);
  if (status === 'LOW') return 'low';
  if (status === 'HIGH') return 'high';
  return 'normal';
}

export function labValue(lab: LabResult) {
  return `${lab.value} ${lab.unit}`.trim();
}

export function appointmentDateParts(date: string) {
  const [month = 'TBD', day = ''] = date.replace(',', '').split(/\s+/);
  return {
    month: month.slice(0, 3).toUpperCase(),
    day: day || '--',
  };
}

export function portalSyncLabel() {
  return '2 mins ago';
}

export function formatAuditTime(value: string) {
  if (!value) return 'Unknown time';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function medicationSummaryFromPortal(portal: PortalData) {
  return {
    activeMedications: portal.prescriptions.filter((item) => item.status === 'Active' || item.status === 'Refill Due').length,
    dueForRefill: portal.prescriptions.filter((item) => item.status === 'Refill Due').length,
    pendingRequests: portal.medicationRequests.filter((item) => item.status === 'Pending').length + portal.refillRequests.filter((item) => item.status === 'Queued').length,
  };
}
