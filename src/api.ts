import type { AppointmentRequest, Message, PortalData, Task, VisitRequestInput } from './types';

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

export function sendMessage(subject: string, body: string) {
  return request<Message>('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ subject, body }),
  });
}
