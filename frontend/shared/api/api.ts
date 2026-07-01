import type {
  Appointment,
  AppointmentList,
  AppointmentRequest,
  AccessControlOverview,
  AccessStatus,
  BillingData,
  BillingPaymentMethod,
  BillingPaymentMethodInput,
  BillingStatement,
  ClinicalNote,
  EmergencyContact,
  FamilyAccessData,
  MedicationRequest,
  Message,
  MessageConversation,
  PortalData,
  PreferredPharmacy,
  ProfileSettings,
  RefillRequest,
  Task,
  UploadedFile,
  VisitRequestInput,
} from '../types';

export function getStoredAuthToken() {
  return localStorage.getItem('emr-auth-token') || sessionStorage.getItem('emr-auth-token') || '';
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredAuthToken();
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorBody.error || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    patientId: string;
    roles: string[];
    roleLabels: string[];
    permissions: string[];
    status: AccessStatus;
  };
};

export function signup(input: {
  fullName: string;
  email: string;
  dateOfBirth: string;
  patientId: string;
  password: string;
}) {
  return request<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(usernameOrEmail: string, password: string) {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usernameOrEmail, password }),
  });
}

export function logout() {
  return request<void>('/api/auth/logout', {
    method: 'POST',
  });
}

export function getPortalData() {
  return request<PortalData>('/api/portal');
}

export function getAccessControlOverview() {
  return request<AccessControlOverview>('/api/admin/access-control');
}

export function updateRolePermissions(roleId: string, permissions: string[]) {
  return request<AccessControlOverview>(`/api/admin/access-control/roles/${roleId}`, {
    method: 'PATCH',
    body: JSON.stringify({ permissions }),
  });
}

export function updateUserAccess(userId: string, roles: string[], status: AccessStatus) {
  return request<AccessControlOverview>(`/api/admin/users/${userId}/access`, {
    method: 'PATCH',
    body: JSON.stringify({ roles, status }),
  });
}

export function updateTask(taskId: string, completed: boolean) {
  return request<Task>(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ completed }),
  });
}

export function updateShareRecords(shareRecords: boolean) {
  return request<PortalData['preferences']>('/api/preferences/share-records', {
    method: 'PATCH',
    body: JSON.stringify({ shareRecords }),
  });
}

export function createVisitRequest(input: VisitRequestInput) {
  return request<AppointmentRequest>('/api/appointments/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getAppointments(status: 'upcoming' | 'past' | 'cancelled', provider = '') {
  const params = new URLSearchParams({ status });
  if (provider.trim()) params.set('provider', provider.trim());
  return request<AppointmentList>(`/api/appointments?${params.toString()}`);
}

export function getAppointmentDetail(appointmentId: string) {
  return request<unknown>(`/api/appointments/${encodeURIComponent(appointmentId)}`);
}

export function getAppointmentsExport(status: 'upcoming' | 'past' | 'cancelled', provider = '') {
  const params = new URLSearchParams({ status });
  if (provider.trim()) params.set('provider', provider.trim());
  return request<unknown>(`/api/appointments/export?${params.toString()}`);
}

export function scheduleAppointment(input: VisitRequestInput) {
  return request<Appointment>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify({
      service: input.service || input.reason,
      provider: input.provider,
      department: input.department,
      date: input.date || input.preferredDate,
      time: input.time,
      location: input.location,
      reason: input.reason,
      notes: input.notes,
    }),
  });
}

export function cancelAppointment(appointmentId: string, reason = 'Patient requested cancellation') {
  return request<Appointment>(`/api/appointments/${appointmentId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export function rescheduleAppointment(
  appointmentId: string,
  input: string | { date: string; time: string; provider?: string; department?: string; notes?: string },
  time = '',
  notes = '',
) {
  const body = typeof input === 'string'
    ? { date: input, time, notes }
    : input;
  return request<Appointment>(`/api/appointments/${appointmentId}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function sendMessage(subject: string, body: string) {
  return request<Message>('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ subject, body }),
  });
}

export function sendConversationMessage(conversationId: string, body: string) {
  return request<{ message: unknown; conversation: MessageConversation }>(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export function sendConversationAttachment(conversationId: string, body: string, attachment: { fileName: string; size: string }) {
  return request<{ message: unknown; conversation: MessageConversation }>(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body, attachment }),
  });
}

export function resolveConversation(conversationId: string, resolved = true) {
  return request<MessageConversation>(`/api/messages/conversations/${conversationId}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ resolved }),
  });
}

export function requestPrescriptionRefill(prescriptionId: string) {
  return request<RefillRequest>(`/api/prescriptions/${prescriptionId}/refills`, {
    method: 'POST',
  });
}

export function requestNewMedication(medicationName: string, notes: string) {
  return request<MedicationRequest>('/api/prescriptions/medication-requests', {
    method: 'POST',
    body: JSON.stringify({ medicationName, notes }),
  });
}

export function updatePreferredPharmacy(input: Omit<PreferredPharmacy, 'id' | 'isPreferred' | 'updatedAt'>) {
  return request<PreferredPharmacy>('/api/prescriptions/preferred-pharmacy', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getPrintablePrescriptions() {
  return request<unknown>('/api/prescriptions/printable');
}

export function getMedicationLeaflet(prescriptionId: string) {
  return request<unknown>(`/api/prescriptions/${encodeURIComponent(prescriptionId)}/leaflet`);
}

export function checkDrugInteractions(medicationName: string) {
  return request<unknown>('/api/prescriptions/interactions', {
    method: 'POST',
    body: JSON.stringify({ medicationName }),
  });
}

export function submitBillingPayment(input: {
  amount?: number;
  invoiceId?: string;
  paymentMethodId?: string;
} = {}) {
  return request<BillingData>('/api/billing/payments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function payFullBalance(paymentMethodId?: string) {
  return submitBillingPayment({
    paymentMethodId,
  });
}

export function payInvoice(invoiceId: string, amount: number, paymentMethodId?: string) {
  return submitBillingPayment({
    invoiceId,
    amount,
    paymentMethodId,
  });
}

export function addBillingPaymentMethod(input: BillingPaymentMethodInput) {
  return request<BillingPaymentMethod>('/api/billing/payment-methods', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getBillingStatement(statementId = '') {
  return request<BillingStatement>(statementId ? `/api/billing/statements/${statementId}` : '/api/billing/statements');
}

export function getInvoiceDetail(invoiceId: string) {
  return request<unknown>(`/api/billing/invoices/${encodeURIComponent(invoiceId)}`);
}

export function getBillingResource(resourceId: string) {
  return request<unknown>(`/api/billing/resources/${encodeURIComponent(resourceId)}`);
}

export function createPaymentSession(invoiceId?: string) {
  return request<unknown>('/api/billing/payment-sessions', {
    method: 'POST',
    body: JSON.stringify({ invoiceId }),
  });
}

export function saveProfileSettings(profile: ProfileSettings) {
  return request<ProfileSettings>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(profile),
  });
}

export function updateInsuranceDetails(input: PortalData['insuranceDetails']) {
  return request<PortalData['insuranceDetails']>('/api/profile/insurance', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function addEmergencyContact(input: Omit<EmergencyContact, 'id'>) {
  return request<EmergencyContact>('/api/profile/emergency-contacts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateEmergencyContact(contactId: string, input: Omit<EmergencyContact, 'id'>) {
  return request<EmergencyContact>(`/api/profile/emergency-contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteEmergencyContact(contactId: string) {
  return request<EmergencyContact>(`/api/profile/emergency-contacts/${contactId}`, {
    method: 'DELETE',
  });
}

export function addPatientNote(input: { title: string; text: string; type?: string }) {
  return request<ClinicalNote>('/api/records/notes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getLabDetail(labId: string) {
  return request<unknown>(`/api/records/labs/${encodeURIComponent(labId)}`);
}

export function getDocumentDetail(documentId: string) {
  return request<unknown>(`/api/records/documents/${encodeURIComponent(documentId)}`);
}

export function getPrintableRecord() {
  return request<unknown>('/api/records/printable');
}

export function getTrendsExport(range = '12m') {
  return request<unknown>(`/api/trends/export?range=${encodeURIComponent(range)}`);
}

export function requestReferral(input: { provider?: string; specialty: string; reason: string; clinic?: string }) {
  return request<PortalData['referrals']['rows'][number]>('/api/referrals', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateReferralAction(referralId: string, action: string, note = '') {
  return request<PortalData['referrals']['rows'][number]>(`/api/referrals/${referralId}/action`, {
    method: 'PATCH',
    body: JSON.stringify({ action, note }),
  });
}

export function getReferralExport() {
  return request<unknown>('/api/referrals/export');
}

export function getReferralDetail(referralId: string) {
  return request<unknown>(`/api/referrals/${encodeURIComponent(referralId)}`);
}

export function inviteProxy(input: { name: string; relationship: string; permissions: string }) {
  return request<FamilyAccessData['proxies'][number]>('/api/family/proxies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProxyPermissions(proxyId: string, permissions: string) {
  return request<FamilyAccessData['proxies'][number]>(`/api/family/proxies/${proxyId}`, {
    method: 'PATCH',
    body: JSON.stringify({ permissions }),
  });
}

export function resendProxyInvite(proxyId: string) {
  return request<FamilyAccessData['proxies'][number]>(`/api/family/proxies/${proxyId}/resend`, {
    method: 'POST',
  });
}

export function revokeProxy(proxyId: string) {
  return request<FamilyAccessData['proxies'][number]>(`/api/family/proxies/${proxyId}`, {
    method: 'DELETE',
  });
}

export function addDependent(input: { name: string; relationship: string; detail?: string; access?: string }) {
  return request<FamilyAccessData['accounts'][number]>('/api/family/dependents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateFamilyPrivacy(input: { shareRecords?: boolean; mentalHealthNotes?: boolean }) {
  return request<PortalData['preferences']>('/api/family/privacy', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function reportUnauthorizedAccess(input: { summary: string; contactPreference?: string }) {
  return request<{ id: string; status: string }>('/api/family/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getAccessPolicy() {
  return request<unknown>('/api/family/policy');
}

export function recordResourceInteraction(resourceId: string, action: string) {
  return request<PortalData['resourceInteractions'][number]>(`/api/resources/${encodeURIComponent(resourceId)}/interactions`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export function getResourceDetail(resourceId: string) {
  return request<unknown>(`/api/resources/${encodeURIComponent(resourceId)}`);
}

export function getPrintableImmunizations() {
  return request<unknown>('/api/immunizations/printable');
}

export function getImmunizationDetail(recordId: string) {
  return request<unknown>(`/api/immunizations/${encodeURIComponent(recordId)}`);
}

export function uploadFileMetadata(input: { fileName: string; category: string; size?: string; source?: string; relatedId?: string }) {
  return request<UploadedFile>('/api/files', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
