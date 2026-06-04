import type {
  Appointment,
  AppointmentList,
  AppointmentRequest,
  BillingData,
  MedicationRequest,
  Message,
  MessageConversation,
  PortalData,
  ProfileSettings,
  RefillRequest,
  Task,
  VisitRequestInput,
} from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('emr-auth-token');
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

export function scheduleAppointment(input: VisitRequestInput) {
  return request<Appointment>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify({
      service: input.reason,
      date: input.preferredDate,
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

export function rescheduleAppointment(appointmentId: string, date: string, time: string, notes = '') {
  return request<Appointment>(`/api/appointments/${appointmentId}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify({ date, time, notes }),
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

export function payFullBalance() {
  return request<BillingData>('/api/billing/payments', {
    method: 'POST',
  });
}

export function saveProfileSettings(profile: ProfileSettings) {
  return request<ProfileSettings>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(profile),
  });
}
