import type {
  Appointment,
  AppointmentList,
  AppointmentRequest,
  AccessControlOverview,
  AccessStatus,
  AdminUserInput,
  BillingData,
  BillingInvoice,
  BillingInvoiceInput,
  BillingPaymentMethod,
  BillingPaymentMethodInput,
  BillingStatement,
  ClinicalNote,
  EmergencyContact,
  FamilyAccessData,
  HomeData,
  ImmunizationCompletedRecord,
  ImmunizationAlert,
  ImmunizationRecordInput,
  MedicationRequest,
  Message,
  MessageConversation,
  PortalData,
  PreferredPharmacy,
  Prescription,
  ProfileSettings,
  RefillRequest,
  RegistrationDemographics,
  RegistrationIntake,
  Task,
  TrendGoal,
  TrendGoalInput,
  TrendReadingInput,
  UploadedFile,
  VisitRequestInput,
} from '../types';
import { queryCache } from './query-cache';

export const UNAUTHORIZED_EVENT = 'emr:unauthorized';
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export type ApiErrorBody = {
  code?: string;
  message?: string;
  error?: string;
  status?: number;
  fieldErrors?: Record<string, string | string[]>;
  requestId?: string;
  details?: unknown;
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Record<string, string | string[]>;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(body: ApiErrorBody, status: number, fallbackMessage: string) {
    super(body.message || body.error || fallbackMessage || 'Request failed');
    this.name = 'ApiError';
    this.code = body.code || `HTTP_${status}`;
    this.status = body.status || status;
    this.fieldErrors = body.fieldErrors;
    this.requestId = body.requestId;
    this.details = body.details;
  }
}

let csrfToken = '';
let patientContext = sessionStorage.getItem('emr-patient-context') || '';

export function getStoredAuthToken() {
  return localStorage.getItem('emr-auth-token') || sessionStorage.getItem('emr-auth-token') || '';
}

export function setPatientContext(contextId: string) {
  if (patientContext !== contextId) queryCache.clear();
  patientContext = contextId;
  if (contextId) sessionStorage.setItem('emr-patient-context', contextId);
  else sessionStorage.removeItem('emr-patient-context');
}

export function clearClientSession() {
  queryCache.clear();
  csrfToken = '';
  setPatientContext('');
  clearLegacyAuthToken();
}

export function clearLegacyAuthToken() {
  localStorage.removeItem('emr-auth-token');
  sessionStorage.removeItem('emr-auth-token');
}

function isMutation(method = 'GET') {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

function requestHeaders(options?: RequestInit) {
  const token = getStoredAuthToken();
  const headers = new Headers(options?.headers);
  if (!(options?.body instanceof FormData) && options?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  if (patientContext && !headers.has('X-Patient-Context')) headers.set('X-Patient-Context', patientContext);
  if (csrfToken && isMutation(options?.method) && !headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', csrfToken);
  return headers;
}

async function parseError(response: Response) {
  const fallbackMessage = response.statusText || `Request failed (${response.status})`;
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => ({})) as ApiErrorBody
    : { error: await response.text().catch(() => fallbackMessage) };
  return new ApiError(body, response.status, fallbackMessage);
}

async function rawRequest(url: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(resolveApiUrl(url), {
    ...options,
    credentials: 'include',
    headers: requestHeaders(options),
  });

  if (!response.ok) {
    const error = await parseError(response);
    if (response.status === 401 && !url.endsWith('/auth/me')) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: error }));
    }
    throw error;
  }

  if (isMutation(options?.method)) invalidateMutationQueries(url);

  return response;
}

function resolveApiUrl(url: string) {
  if (!API_BASE_URL || /^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/api/')) return `${API_BASE_URL}${url.slice(4)}`;
  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
}

function cachedRequest<T>(feature: string, url: string, options: RequestInit = {}) {
  const scope = patientContext || 'actor';
  return queryCache.query([scope, feature, url], ({ signal }) => request<T>(url, { ...options, signal }), {
    staleTimeMs: 10_000,
    retries: 1,
  });
}

async function optionalFeature<T>(
  allowed: boolean,
  feature: string,
  url: string,
  fallback: T,
  onError?: (error: unknown) => void,
) {
  if (!allowed) return fallback;
  try {
    return await cachedRequest<T>(feature, url);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw error;
    onError?.(error);
    return fallback;
  }
}

function invalidateMutationQueries(url: string) {
  const scope = patientContext || 'actor';
  const feature = String(url).replace(/^https?:\/\/[^/]+/i, '').replace(/^\/api\//, '').split(/[/?]/)[0] || 'portal';
  queryCache.invalidate([scope, feature]);
  queryCache.invalidate([scope, 'portal']);
  queryCache.invalidate([scope, 'portal-bootstrap']);
  queryCache.invalidate([scope, 'home']);
  queryCache.invalidate([scope, 'dashboard']);
  queryCache.invalidate([scope, 'notifications']);
  if (feature === 'preferences') queryCache.invalidate([scope, 'family']);
}

function emptyAppointmentsFeature() {
  return { appointments: [], requests: [], providers: [], appointmentSlots: [] };
}

function emptyPrescriptionsFeature() {
  return { preferredPharmacy: emptyPreferredPharmacy(), prescriptions: [], refillRequests: [], medicationRequests: [] };
}

function emptyPreferredPharmacy(): PreferredPharmacy {
  return { id: '', name: '', addressLine1: '', addressLine2: '', phone: '', hours: '', isPreferred: false, updatedAt: '' };
}

function emptyBillingFeature(): BillingData {
  return {
    outstandingBalance: 0,
    paymentStatus: 'Paid',
    breakdown: { consultation: 0, laboratory: 0, radiology: 0, pharmacy: 0 },
    paymentMethods: [],
    invoices: [],
    payments: [],
    statements: [],
    resources: [],
  };
}

function emptyProfileFeature() {
  return {
    profileSettings: { fullName: '', email: '', phone: '', dateOfBirth: '', address: '', language: '', timezone: '' },
    accountStatus: { profileCompletion: 0, twoFactorEnabled: false, lastLogin: '', privacyNotice: '' },
    insuranceDetails: { primaryProvider: '', memberId: '', groupNumber: '', policyHolder: '', activeThrough: '', verifiedAt: '' },
    emergencyContacts: [],
  };
}

function emptyRecordsFeature() {
  return { labResults: [], clinicalNotes: [], documents: [], immunizations: [], total: 0 };
}

function emptyTrendsFeature() {
  return { summary: { withinRange: 0, attentionRequired: 0, updates: [] }, metrics: [], labComparison: [], goals: [] };
}

function emptyReferralsFeature() {
  return {
    summary: { active: 0, pending: 0, completedYear: 0 },
    rows: [],
    focus: { caseId: '', title: '', note: '', attachment: '', lastUpdate: '', clinic: '', address: '', phone: '', email: '' },
  };
}

function emptyFamilyFeature() {
  return { familyAccess: { proxies: [], accounts: [], activity: [], reports: [] }, preferences: { shareRecords: false, mentalHealthNotes: false } };
}

function emptyImmunizationsFeature() {
  return { records: { alerts: [], completed: [], compliance: { percent: 0, completed: 0, recommended: 0, detail: '' } } };
}

function emptyResourcesFeature() {
  return {
    featured: { id: '', category: '', title: '', detail: '', meta: '', updated: '', actionLabel: '' },
    video: { id: '', title: '', detail: '', duration: '', category: '' },
    groups: [],
    library: [],
    interactions: [],
  };
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await rawRequest(url, options);

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return await response.text() as T;
  return response.json() as Promise<T>;
}

async function requestBlob(url: string, options?: RequestInit) {
  const response = await rawRequest(url, options);
  const disposition = response.headers.get('content-disposition') || '';
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quotedName = disposition.match(/filename="([^"]+)"/i)?.[1];
  return {
    blob: await response.blob(),
    fileName: encodedName ? decodeURIComponent(encodedName) : quotedName || 'download',
    contentType: response.headers.get('content-type') || '',
  };
}

function saveBlob(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

export type AuthResponse = {
  token?: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    patientId: string;
    roles: string[];
    roleLabels: string[];
    permissions: string[];
    status: AccessStatus;
    mustChangePassword?: boolean;
  };
  session?: Record<string, unknown>;
  csrfToken?: string;
  patientContexts?: Array<{ id: string; patientId?: string; medicalRecordNumber?: string; label: string; relationship?: string; type?: string }>;
  currentPatientContext?: string | { id: string; patientId?: string; medicalRecordNumber?: string; label: string; relationship?: string; type?: string };
};

type PortalBootstrap = Pick<PortalData, 'currentUser' | 'subjectUser' | 'access' | 'patientContexts' | 'currentPatientContext'> & {
  navigation: Array<{ id: string; label: string }>;
  featureEndpoints: Record<string, string>;
};

export async function getCurrentSession() {
  let response: AuthResponse;
  try {
    response = await request<AuthResponse>('/api/auth/me');
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 403 || !patientContext) throw error;
    setPatientContext('');
    response = await request<AuthResponse>('/api/auth/me');
  }
  csrfToken = response.csrfToken || String(response.session?.csrfToken || '');
  if (response.currentPatientContext) setPatientContext(typeof response.currentPatientContext === 'string' ? response.currentPatientContext : response.currentPatientContext.id);
  return response;
}

export async function signup(input: {
  fullName: string;
  email: string;
  dateOfBirth: string;
  patientId: string;
  password: string;
}) {
  setPatientContext('');
  const response = await request<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  csrfToken = response.csrfToken || String(response.session?.csrfToken || '');
  return response;
}

export async function login(usernameOrEmail: string, password: string, rememberMe = false) {
  setPatientContext('');
  const response = await request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ usernameOrEmail, password, rememberMe }),
  });
  csrfToken = response.csrfToken || String(response.session?.csrfToken || '');
  return response;
}

export function logout() {
  return request<void>('/api/auth/logout', {
    method: 'POST',
  });
}

export function requestPasswordReset(email: string) {
  return request<{ accepted: boolean; message?: string }>('/api/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string) {
  return request<{ changed: boolean }>('/api/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword: password }),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<{ changed: boolean; mustChangePassword: boolean }>('/api/auth/password/change', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function selectPatientContext(contextId: string) {
  setPatientContext(contextId);
  return getCurrentSession();
}

export type PortalNotification = {
  id: string;
  title: string;
  body?: string;
  detail?: string;
  read?: boolean;
  readAt?: string | null;
  createdAt: string;
  target?: string;
};

export function getNotifications(unreadOnly = false) {
  const url = `/api/notifications${unreadOnly ? '?unread=true' : ''}`;
  return cachedRequest<{ notifications: PortalNotification[]; unreadCount?: number } | PortalNotification[]>('notifications', url);
}

export function markNotificationRead(notificationId: string) {
  return request<PortalNotification>(`/api/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return request<{ updated: number }>('/api/notifications/read-all', { method: 'PATCH' });
}

export function submitSupportRequest(subject: string, body: string) {
  return request<{ message?: unknown; status: string }>('/api/support', {
    method: 'POST',
    body: JSON.stringify({ subject, body }),
  });
}

export async function getPortalData(): Promise<PortalData> {
  const bootstrap = await cachedRequest<PortalBootstrap>('portal-bootstrap', '/api/portal');
  const permissions = bootstrap.access.permissions;
  const can = (...permissionIds: string[]) => permissionIds.some((permission) => permissions.includes(permission));
  const featureErrors: Record<string, string> = {};
  const loadOptional = <T>(allowed: boolean, feature: string, url: string, fallback: T) => optionalFeature(
    allowed,
    feature,
    url,
    fallback,
    (error) => {
      featureErrors[feature] = error instanceof Error ? error.message : `Could not load ${feature}.`;
      console.error(`Could not load portal feature: ${feature}`, error);
    },
  );

  const [dashboard, home, registration, appointments, prescriptions, billing, profile, records, trends, referrals, immunizations, resources, files, conversations] = await Promise.all([
    cachedRequest<PortalData['dashboard']>('dashboard', '/api/patient/dashboard'),
    cachedRequest<HomeData>('home', '/api/patient/home'),
    loadOptional<RegistrationIntake | undefined>(can('registration.view', 'registration.viewOwn'), 'registration', '/api/registration', undefined),
    loadOptional<Record<string, unknown>>(can('appointments.view', 'appointments.viewOwn'), 'appointments', '/api/appointments?status=all&pageSize=500', emptyAppointmentsFeature()),
    loadOptional<Record<string, unknown>>(can('prescriptions.view', 'prescriptions.viewOwn'), 'prescriptions', '/api/prescriptions', emptyPrescriptionsFeature()),
    loadOptional<BillingData>(can('billing.view', 'billing.viewOwn'), 'billing', '/api/billing', emptyBillingFeature()),
    loadOptional<Record<string, unknown>>(can('profile.view', 'profile.viewOwn'), 'profile', '/api/profile', emptyProfileFeature()),
    loadOptional<Record<string, unknown>>(can('records.view', 'records.viewOwn'), 'records', '/api/records?type=all', emptyRecordsFeature()),
    loadOptional<Record<string, unknown>>(can('trends.view', 'trends.viewOwn'), 'trends', '/api/trends?range=12m', emptyTrendsFeature()),
    loadOptional<Record<string, unknown>>(can('referrals.view', 'referrals.viewOwn'), 'referrals', '/api/referrals?pageSize=500', emptyReferralsFeature()),
    loadOptional<Record<string, unknown>>(can('immunizations.view', 'immunizations.viewOwn'), 'immunizations', '/api/immunizations', emptyImmunizationsFeature()),
    loadOptional<Record<string, unknown>>(can('resources.view'), 'resources', '/api/resources?pageSize=500', emptyResourcesFeature()),
    loadOptional<Record<string, unknown>>(can('files.manage', 'files.manageOwn', 'records.view', 'records.viewOwn', 'messages.view', 'messages.viewOwn'), 'files', '/api/files', { files: [] }),
    loadOptional<Record<string, unknown>>(can('messages.view', 'messages.viewOwn'), 'messages', '/api/messages/conversations?include=messages', { conversations: [] }),
  ]);

  const appointmentData = appointments as unknown as {
    appointments: PortalData['appointments'];
    requests: PortalData['appointmentRequests'];
    providers: PortalData['providers'];
    appointmentSlots: PortalData['appointmentSlots'];
  };
  const prescriptionData = prescriptions as unknown as {
    preferredPharmacy: PreferredPharmacy;
    prescriptions: PortalData['prescriptions'];
    refillRequests: PortalData['refillRequests'];
    medicationRequests: PortalData['medicationRequests'];
  };
  const profileData = profile as unknown as {
    profileSettings: ProfileSettings;
    accountStatus: PortalData['accountStatus'];
    insuranceDetails: PortalData['insuranceDetails'];
    emergencyContacts: PortalData['emergencyContacts'];
  };
  const recordData = records as unknown as {
    labResults: PortalData['labResults'];
    clinicalNotes: PortalData['clinicalNotes'];
    documents: PortalData['documents'];
  };
  const familyData = emptyFamilyFeature();
  const immunizationData = immunizations as unknown as { records: PortalData['immunizationRecords'] };
  const resourceData = resources as unknown as PortalData['educationalResources'] & { interactions?: PortalData['resourceInteractions'] };
  const fileData = files as unknown as { files: UploadedFile[] };
  const conversationData = conversations as unknown as { conversations: MessageConversation[] };
  const educationalResources: PortalData['educationalResources'] = {
    featured: resourceData.featured || emptyResourcesFeature().featured,
    video: resourceData.video || emptyResourcesFeature().video,
    library: resourceData.library || [],
    groups: (resourceData.groups || []).map((group) => ({
      ...group,
      items: group.items.map((item) => ({
        ...item,
        action: item.action || String((item as typeof item & { actionLabel?: string }).actionLabel || 'Read'),
      })),
    })),
  };

  return {
    ...bootstrap,
    featureErrors,
    patient: dashboard.patient,
    preferences: familyData.preferences || { shareRecords: false, mentalHealthNotes: false },
    tasks: home.tasks || [],
    providers: appointmentData.providers || [],
    appointmentSlots: appointmentData.appointmentSlots || [],
    appointments: appointmentData.appointments || [],
    appointmentRequests: appointmentData.requests || [],
    medications: [],
    preferredPharmacy: prescriptionData.preferredPharmacy || emptyPreferredPharmacy(),
    prescriptions: prescriptionData.prescriptions || [],
    refillRequests: prescriptionData.refillRequests || [],
    medicationRequests: prescriptionData.medicationRequests || [],
    billing,
    registration,
    profileSettings: profileData.profileSettings || emptyProfileFeature().profileSettings as ProfileSettings,
    accountStatus: profileData.accountStatus || emptyProfileFeature().accountStatus as PortalData['accountStatus'],
    insuranceDetails: profileData.insuranceDetails || emptyProfileFeature().insuranceDetails as PortalData['insuranceDetails'],
    emergencyContacts: profileData.emergencyContacts || [],
    labResults: recordData.labResults || [],
    clinicalNotes: recordData.clinicalNotes || [],
    documents: recordData.documents || [],
    uploadedFiles: fileData.files || [],
    activityLog: (home.recentActivity || []).map((item) => ({ id: item.id, type: 'activity', title: item.title, detail: item.detail, createdAt: item.occurredAt })),
    resourceInteractions: resourceData.interactions || [],
    immunizations: (immunizationData.records?.completed || []).map((item) => ({
      id: item.id,
      title: item.vaccine,
      last: item.date,
      doses: item.dose,
      status: item.verificationStatus || 'Recorded',
      tone: item.verificationStatus === 'Verified' ? 'green' : 'yellow',
    })),
    immunizationRecords: immunizationData.records || emptyImmunizationsFeature().records as PortalData['immunizationRecords'],
    educationalResources,
    referrals: referrals as unknown as PortalData['referrals'],
    familyAccess: familyData.familyAccess || emptyFamilyFeature().familyAccess as FamilyAccessData,
    healthTrends: trends as unknown as PortalData['healthTrends'],
    messages: [],
    messageConversations: conversationData.conversations || [],
    dashboard,
  };
}

export function getHomeData() {
  return cachedRequest<HomeData>('home', '/api/patient/home');
}

export function getRegistrationIntake() {
  return cachedRequest<RegistrationIntake>('registration', '/api/registration');
}

export function updateRegistrationDemographics(input: RegistrationDemographics) {
  return request<RegistrationIntake>('/api/registration/demographics', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateRegistrationInsurance(input: PortalData['insuranceDetails']) {
  return request<RegistrationIntake>('/api/registration/insurance', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function signRegistrationConsent(consentId: string, signerName: string) {
  return request<RegistrationIntake>(`/api/registration/consents/${encodeURIComponent(consentId)}/sign`, {
    method: 'POST',
    body: JSON.stringify({ signerName }),
  });
}

export function updateRegistrationForm(formId: string, fields: Record<string, string>, status?: string) {
  return request<RegistrationIntake>(`/api/registration/forms/${encodeURIComponent(formId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields, status }),
  });
}

export function getAccessControlOverview() {
  return cachedRequest<AccessControlOverview>('admin', '/api/admin/access-control');
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

export function updateVisitRequest(requestId: string, input: Pick<VisitRequestInput, 'reason' | 'preferredDate' | 'notes'>) {
  return request<AppointmentRequest>(`/api/appointments/requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getAppointments(status: 'upcoming' | 'past' | 'cancelled', provider = '') {
  const params = new URLSearchParams({ status });
  if (provider.trim()) params.set('provider', provider.trim());
  const url = `/api/appointments?${params.toString()}`;
  return cachedRequest<AppointmentList>('appointments', url);
}

export function getAppointmentDetail(appointmentId: string) {
  const url = `/api/appointments/${encodeURIComponent(appointmentId)}`;
  return cachedRequest<unknown>('appointments', url);
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

export function getMessageRecipients() {
  return cachedRequest<{
    recipients: Array<{ id: string; name: string; role: string; department: string; available: boolean }>;
  }>('messages', '/api/messages/recipients');
}

export function sendMessage(recipientId: string, subject: string, body: string) {
  return request<Message>('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ recipientId, subject, body }),
  });
}

export function sendConversationMessage(conversationId: string, body: string) {
  return request<{ message: unknown; conversation: MessageConversation }>(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export function sendConversationAttachment(conversationId: string, body: string, attachment: { fileName: string; size: string; fileId?: string }) {
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
  const url = `/api/prescriptions/${encodeURIComponent(prescriptionId)}/leaflet`;
  return cachedRequest<unknown>('prescriptions', url);
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
  idempotencyKey?: string;
} = {}) {
  return request<BillingData>('/api/billing/payments', {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey: input.idempotencyKey || crypto.randomUUID() }),
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
  const url = `/api/billing/resources/${encodeURIComponent(resourceId)}`;
  return cachedRequest<unknown>('billing', url);
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
  const url = `/api/records/labs/${encodeURIComponent(labId)}`;
  return cachedRequest<unknown>('records', url);
}

export function getDocumentDetail(documentId: string) {
  const url = `/api/records/documents/${encodeURIComponent(documentId)}`;
  return cachedRequest<unknown>('records', url);
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
  const url = `/api/referrals/${encodeURIComponent(referralId)}`;
  return cachedRequest<unknown>('referrals', url);
}

export function getReferralContact(referralId: string) {
  const url = `/api/referrals/${encodeURIComponent(referralId)}/contact`;
  return cachedRequest<unknown>('referrals', url);
}

export function getReferralCalendar(referralId: string) {
  const url = `/api/referrals/${encodeURIComponent(referralId)}/calendar`;
  return cachedRequest<unknown>('referrals', url);
}

export function inviteProxy(input: { name: string; email: string; relationship: string; permissions: string }) {
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
  return cachedRequest<unknown>('family', '/api/family/policy');
}

export function recordResourceInteraction(resourceId: string, action: string) {
  return request<PortalData['resourceInteractions'][number]>(`/api/resources/${encodeURIComponent(resourceId)}/interactions`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export function getResourceDetail(resourceId: string) {
  const url = `/api/resources/${encodeURIComponent(resourceId)}`;
  return cachedRequest<unknown>('resources', url);
}

export function getResources(input: { query?: string; format?: string; category?: string; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (input.query?.trim()) params.set('query', input.query.trim());
  if (input.format && input.format !== 'All Formats') params.set('format', input.format);
  if (input.category && input.category !== 'All') params.set('category', input.category);
  params.set('page', String(input.page || 1));
  params.set('pageSize', String(input.pageSize || 50));
  const url = `/api/resources?${params.toString()}`;
  return cachedRequest<PortalData['educationalResources'] & { interactions: PortalData['resourceInteractions'] }>('resources', url);
}

export function getPrintableImmunizations() {
  return request<unknown>('/api/immunizations/printable');
}

export function getImmunizationDetail(recordId: string) {
  const url = `/api/immunizations/${encodeURIComponent(recordId)}`;
  return cachedRequest<unknown>('immunizations', url);
}

export function uploadFileMetadata(input: { fileName: string; category: string; size?: string; source?: string; relatedId?: string }) {
  void input;
  return Promise.reject<UploadedFile>(new ApiError({ code: 'FILE_REQUIRED', message: 'Choose a real file to upload.' }, 400, 'Choose a real file to upload.'));
}

export function uploadFile(file: File, input: { category: string; source?: string; relatedId?: string }) {
  const body = new FormData();
  body.append('file', file, file.name);
  body.append('fileName', file.name);
  body.append('category', input.category);
  body.append('size', `${file.size} B`);
  body.append('mimeType', file.type || 'application/octet-stream');
  body.append('source', input.source || 'patient-portal');
  if (input.relatedId) body.append('relatedId', input.relatedId);
  return request<UploadedFile>('/api/files', { method: 'POST', body });
}

// ── Immunizations CRUD ──────────────────────────────────────────────────────

export function addImmunizationRecord(input: ImmunizationRecordInput) {
  return request<ImmunizationCompletedRecord>('/api/immunizations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateImmunizationRecord(recordId: string, input: ImmunizationRecordInput) {
  return request<ImmunizationCompletedRecord>(`/api/immunizations/${encodeURIComponent(recordId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteImmunizationRecord(recordId: string) {
  return request<ImmunizationCompletedRecord>(`/api/immunizations/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
  });
}

export function addImmunizationAlert(input: { title: string; detail?: string; tone?: string }) {
  return request<ImmunizationAlert>('/api/immunizations/alerts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function dismissImmunizationAlert(alertId: string) {
  return request<ImmunizationAlert>(`/api/immunizations/alerts/${encodeURIComponent(alertId)}`, {
    method: 'DELETE',
  });
}

// ── Health Trends CRUD ──────────────────────────────────────────────────────

export function addTrendReading(input: TrendReadingInput) {
  return request<{ metric: unknown; reading: unknown }>('/api/trends/readings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTrendReading(metricId: string, readingId: string, input: TrendReadingInput) {
  return request<{ metric: unknown; reading: unknown }>(
    `/api/trends/metrics/${encodeURIComponent(metricId)}/readings/${encodeURIComponent(readingId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteTrendReading(metricId: string, readingId: string) {
  return request<unknown>(
    `/api/trends/metrics/${encodeURIComponent(metricId)}/readings/${encodeURIComponent(readingId)}`,
    { method: 'DELETE' },
  );
}

export function addTrendGoal(input: TrendGoalInput) {
  return request<TrendGoal>('/api/trends/goals', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTrendGoal(goalId: string, input: TrendGoalInput) {
  return request<TrendGoal>(`/api/trends/goals/${encodeURIComponent(goalId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTrendGoal(goalId: string) {
  return request<TrendGoal>(`/api/trends/goals/${encodeURIComponent(goalId)}`, {
    method: 'DELETE',
  });
}

// ── Admin User Management ───────────────────────────────────────────────────

export function createAdminUser(input: AdminUserInput) {
  return request<AccessControlOverview>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteAdminUser(userId: string) {
  return request<AccessControlOverview>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

// ── Billing Invoice CRUD ────────────────────────────────────────────────────

export function createInvoice(input: BillingInvoiceInput) {
  return request<BillingInvoice>('/api/billing/invoices', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateInvoice(invoiceId: string, input: BillingInvoiceInput) {
  return request<BillingInvoice>(`/api/billing/invoices/${encodeURIComponent(invoiceId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteInvoice(invoiceId: string) {
  return request<BillingInvoice>(`/api/billing/invoices/${encodeURIComponent(invoiceId)}`, {
    method: 'DELETE',
  });
}

export function generateStatement() {
  return request<BillingStatement>('/api/billing/statements/generate', {
    method: 'POST',
  });
}

export function updateBillingPaymentMethod(methodId: string, input: BillingPaymentMethodInput) {
  return request<BillingPaymentMethod>(`/api/billing/payment-methods/${encodeURIComponent(methodId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setDefaultPaymentMethod(methodId: string) {
  return request<BillingPaymentMethod>(`/api/billing/payment-methods/${encodeURIComponent(methodId)}/default`, {
    method: 'PATCH',
  });
}

export function deleteBillingPaymentMethod(methodId: string) {
  return request<BillingPaymentMethod>(`/api/billing/payment-methods/${encodeURIComponent(methodId)}`, {
    method: 'DELETE',
  });
}

// ── Records CRUD ────────────────────────────────────────────────────────────

export function updatePatientNote(noteId: string, input: { title: string; text: string; type?: string }) {
  return request<ClinicalNote>(`/api/records/notes/${encodeURIComponent(noteId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deletePatientNote(noteId: string) {
  return request<ClinicalNote>(`/api/records/notes/${encodeURIComponent(noteId)}`, {
    method: 'DELETE',
  });
}

// ── Files CRUD ──────────────────────────────────────────────────────────────

export function updateFileMetadata(fileId: string, input: { fileName: string; category: string; source?: string; relatedId?: string }) {
  return request<UploadedFile>(`/api/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteFile(fileId: string) {
  return request<UploadedFile>(`/api/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  });
}

export function downloadFile(fileId: string) {
  return requestBlob(`/api/files/${encodeURIComponent(fileId)}/download`).then(({ blob, fileName }) => {
    saveBlob(blob, fileName);
  });
}

export function downloadResource(resourceId: string) {
  return requestBlob(`/api/resources/${encodeURIComponent(resourceId)}/download`).then(({ blob, fileName }) => {
    saveBlob(blob, fileName);
  });
}

export function downloadApiExport(url: string, fallbackFileName: string) {
  return rawRequest(url).then(async (response) => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return { downloaded: false as const, data: await response.json() as unknown };
    }
    const disposition = response.headers.get('content-disposition') || '';
    const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const quotedName = disposition.match(/filename="([^"]+)"/i)?.[1];
    const fileName = encodedName ? decodeURIComponent(encodedName) : quotedName || fallbackFileName;
    saveBlob(await response.blob(), fileName);
    return { downloaded: true as const, data: null };
  });
}

// ── Prescriptions extra ─────────────────────────────────────────────────────

export function cancelMedicationRequest(requestId: string) {
  return request<MedicationRequest>(`/api/prescriptions/medication-requests/${encodeURIComponent(requestId)}`, {
    method: 'DELETE',
  });
}

export function cancelAppointmentRequest(requestId: string) {
  return request<AppointmentRequest>(`/api/appointments/requests/${encodeURIComponent(requestId)}`, {
    method: 'DELETE',
  });
}

export function reviewAppointmentRequest(requestId: string, input: {
  decision: 'Approved' | 'Rejected';
  reason?: string;
  slotId?: string;
  provider?: string;
  department?: string;
  date?: string;
  time?: string;
  location?: string;
}) {
  return request<{ request: AppointmentRequest; appointment: Appointment | null }>(
    `/api/appointments/requests/${encodeURIComponent(requestId)}/decision`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function reviewMedicationRequest(requestId: string, input: {
  decision: 'Approved' | 'Rejected';
  reason?: string;
  dosage?: string;
  frequency?: string;
  instructions?: string;
  refillCount?: number;
}) {
  return request<{ request: MedicationRequest; prescription: Prescription | null }>(
    `/api/prescriptions/medication-requests/${encodeURIComponent(requestId)}/decision`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function reviewRefillRequest(requestId: string, decision: 'Approved' | 'Rejected', reason = '') {
  return request<RefillRequest>(`/api/prescriptions/refill-requests/${encodeURIComponent(requestId)}/decision`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, reason }),
  });
}

export function updateReferralStatus(referralId: string, status: 'Approved' | 'Rejected' | 'Scheduled' | 'Completed' | 'Cancelled', reason = '') {
  return request<PortalData['referrals']['rows'][number]>(`/api/referrals/${encodeURIComponent(referralId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
}

export function verifyImmunization(recordId: string, decision: 'Verified' | 'Rejected', note = '') {
  return request<ImmunizationCompletedRecord>(`/api/immunizations/${encodeURIComponent(recordId)}/verification`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, note }),
  });
}

export function addVerifiedImmunization(input: ImmunizationRecordInput) {
  return request<ImmunizationCompletedRecord>('/api/immunizations/verified', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function reviewAccessReport(reportId: string, status: 'Under Review' | 'Resolved' | 'Dismissed', resolution = '') {
  return request<{ id: string; status: string }>(`/api/family/reports/${encodeURIComponent(reportId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, resolution }),
  });
}

// ── Referrals extra ─────────────────────────────────────────────────────────

export function cancelReferral(referralId: string) {
  return request<PortalData['referrals']['rows'][number]>(`/api/referrals/${encodeURIComponent(referralId)}`, {
    method: 'DELETE',
  });
}

// ── Messages extra ──────────────────────────────────────────────────────────

export function archiveConversation(conversationId: string) {
  return request<MessageConversation>(`/api/messages/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
  });
}

export function listConversations(query = '') {
  const params = query ? `?query=${encodeURIComponent(query)}` : '';
  const url = `/api/messages/conversations${params}`;
  return cachedRequest<{ conversations: MessageConversation[]; activeConversationId: string | null; total: number }>('messages', url);
}

// ── Family extra ────────────────────────────────────────────────────────────

export function updateDependent(dependentId: string, input: { name: string; relationship: string; detail?: string; access?: string }) {
  return request<FamilyAccessData['accounts'][number]>(`/api/family/dependents/${encodeURIComponent(dependentId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteDependent(dependentId: string) {
  return request<FamilyAccessData['accounts'][number]>(`/api/family/dependents/${encodeURIComponent(dependentId)}`, {
    method: 'DELETE',
  });
}
