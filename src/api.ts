import type { AppointmentRequest, Message, PortalData, Task, VisitRequestInput } from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorBody.error || response.statusText);
  }

  return response.json() as Promise<T>;
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
