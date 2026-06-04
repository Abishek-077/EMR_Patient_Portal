import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(tmpdir(), 'emr-backend-'));
process.env.EMR_DB_PATH = path.join(tempDir, 'db.json');
process.env.PORT = '0';

const { createServer } = await import('node:http');
const { createApp } = await import('../src/app.js');

const server = createServer(createApp());
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  await expectStatus('/api/health', { method: 'GET' }, 200);
  await expectStatus('/api/portal', { method: 'GET' }, 401);

  const signup = await json('/api/auth/signup', {
    method: 'POST',
    body: {
      fullName: 'Backend Smoke Patient',
      email: 'smoke.patient@example.com',
      dateOfBirth: '1985-05-12',
      patientId: 'SMOKE-100-234',
      password: 'Smoke@Test1',
    },
  });

  assert(signup.status === 201, 'signup should return 201');
  assert(Boolean(signup.body.token), 'signup should return a token');

  const token = signup.body.token;
  const me = await json('/api/auth/me', { method: 'GET', token });
  assert(me.status === 200, 'me should return 200');
  assert(me.body.user.email === 'smoke.patient@example.com', 'me should return public user');

  const login = await json('/api/auth/login', {
    method: 'POST',
    body: {
      usernameOrEmail: 'smoke.patient@example.com',
      password: 'Smoke@Test1',
    },
  });
  assert(login.status === 200, 'login should return 200');

  const dashboard = await json('/api/patient/dashboard', { method: 'GET', token: login.body.token });
  assert(dashboard.status === 200, 'dashboard should return 200');
  assert(dashboard.body.summary.healthId, 'dashboard should include health summary');
  assert(Array.isArray(dashboard.body.latestLabResults), 'dashboard should include lab results');

  const portal = await json('/api/portal', { method: 'GET', token: login.body.token });
  assert(portal.status === 200, 'portal should return 200');
  assert(!('users' in portal.body), 'portal response must not expose users');
  assert(!('sessions' in portal.body), 'portal response must not expose sessions');
  assert(Array.isArray(portal.body.messageConversations), 'portal should include Sprint 3 conversations');

  const conversations = await json('/api/messages/conversations', { method: 'GET', token: login.body.token });
  assert(conversations.status === 200, 'conversation list should return 200');
  assert(conversations.body.conversations.length >= 1, 'conversation list should include seeded conversations');

  const conversationId = conversations.body.conversations[0].id;
  const thread = await json(`/api/messages/conversations/${conversationId}`, { method: 'GET', token: login.body.token });
  assert(thread.status === 200, 'conversation detail should return 200');
  assert(Array.isArray(thread.body.messages), 'conversation detail should include messages');

  const reply = await json(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    token: login.body.token,
    body: { body: 'Thanks, I will follow the updated care plan.' },
  });
  assert(reply.status === 201, 'conversation reply should return 201');
  assert(reply.body.conversation.messages.at(-1).body.includes('updated care plan'), 'conversation reply should append message');

  const resolved = await json(`/api/messages/conversations/${conversationId}/resolve`, {
    method: 'PATCH',
    token: login.body.token,
    body: { resolved: true },
  });
  assert(resolved.status === 200, 'conversation resolve should return 200');
  assert(resolved.body.resolved === true, 'conversation should be marked resolved');

  const appointmentList = await json('/api/appointments?status=upcoming', { method: 'GET', token: login.body.token });
  assert(appointmentList.status === 200, 'appointment list should return 200');
  assert(appointmentList.body.appointments.length >= 1, 'appointment list should include seeded appointments');

  const scheduled = await json('/api/appointments', {
    method: 'POST',
    token: login.body.token,
    body: {
      service: 'Follow-up lab review',
      clinician: 'Dr. Sarah Jenkins',
      date: 'Dec 05, 2023',
      time: '10:00 AM (Tuesday)',
      department: 'Cardiology',
      location: 'Main Clinic, Suite 402',
    },
  });
  assert(scheduled.status === 201, 'schedule appointment should return 201');
  assert(scheduled.body.status === 'Pending', 'scheduled appointment should be pending');

  const rescheduled = await json(`/api/appointments/${scheduled.body.id}/reschedule`, {
    method: 'PATCH',
    token: login.body.token,
    body: { date: 'Dec 08, 2023', time: '11:30 AM (Friday)' },
  });
  assert(rescheduled.status === 200, 'reschedule appointment should return 200');
  assert(rescheduled.body.date === 'Dec 08, 2023', 'rescheduled appointment should update date');

  const cancelled = await json(`/api/appointments/${scheduled.body.id}/cancel`, {
    method: 'PATCH',
    token: login.body.token,
    body: { reason: 'Smoke test cancellation' },
  });
  assert(cancelled.status === 200, 'cancel appointment should return 200');
  assert(cancelled.body.status === 'Cancelled', 'cancelled appointment should update status');

  const prescriptions = await json('/api/prescriptions', { method: 'GET', token: login.body.token });
  assert(prescriptions.status === 200, 'prescriptions overview should return 200');
  assert(prescriptions.body.summary.activeMedications >= 1, 'prescriptions should include summary');
  assert(prescriptions.body.preferredPharmacy.name, 'prescriptions should include preferred pharmacy');

  const refill = await json('/api/prescriptions/rx-lisinopril/refills', {
    method: 'POST',
    token: login.body.token,
  });
  assert(refill.status === 201, 'refill request should return 201');
  assert(refill.body.prescriptionId === 'rx-lisinopril', 'refill should point to prescription');

  const medicationRequest = await json('/api/prescriptions/medication-requests', {
    method: 'POST',
    token: login.body.token,
    body: {
      medicationName: 'Montelukast 10 mg',
      notes: 'Seasonal allergy symptoms',
    },
  });
  assert(medicationRequest.status === 201, 'medication request should return 201');
  assert(medicationRequest.body.status === 'Pending', 'medication request should be pending');

  const pharmacy = await json('/api/prescriptions/preferred-pharmacy', {
    method: 'PATCH',
    token: login.body.token,
    body: {
      name: 'Main Pharmacy #100',
      addressLine1: '45 Clinic Way',
      addressLine2: 'Boston, MA 02115',
      phone: '(617) 555-0100',
      hours: 'Mon-Fri 8 AM - 8 PM',
    },
  });
  assert(pharmacy.status === 200, 'preferred pharmacy update should return 200');
  assert(pharmacy.body.name === 'Main Pharmacy #100', 'preferred pharmacy should update');

  const billing = await json('/api/billing', { method: 'GET', token: login.body.token });
  assert(billing.status === 200, 'billing overview should return 200');
  assert(Array.isArray(billing.body.invoices), 'billing should include invoices');

  const paymentMethod = await json('/api/billing/payment-methods', {
    method: 'POST',
    token: login.body.token,
    body: {
      type: 'Card',
      label: 'Mastercard **** 1000',
      detail: 'Expires 01/28',
      isDefault: true,
    },
  });
  assert(paymentMethod.status === 201, 'payment method create should return 201');
  assert(paymentMethod.body.isDefault === true, 'new payment method should be default');

  const payment = await json('/api/billing/payments', {
    method: 'POST',
    token: login.body.token,
    body: { paymentMethodId: paymentMethod.body.id },
  });
  assert(payment.status === 201, 'payment should return 201');
  assert(payment.body.outstandingBalance === 0, 'payment should clear outstanding balance');
  assert(payment.body.paymentStatus === 'Paid', 'payment should mark billing paid');

  const statement = await json('/api/billing/statements', { method: 'GET', token: login.body.token });
  assert(statement.status === 200, 'statement should return 200');
  assert(Array.isArray(statement.body.invoices), 'statement should include invoices');

  const profile = await json('/api/profile', { method: 'GET', token: login.body.token });
  assert(profile.status === 200, 'profile overview should return 200');
  assert(profile.body.profileSettings.email, 'profile should include settings');

  const updatedProfile = await json('/api/profile', {
    method: 'PATCH',
    token: login.body.token,
    body: {
      fullName: 'Backend Smoke Patient',
      email: 'smoke.patient@example.com',
      phone: '+1 (555) 000-1234',
      dateOfBirth: '05/12/1985',
      address: '1 Smoke Test Way',
      language: 'English (US)',
      timezone: '(GMT-05:00) Eastern Time',
    },
  });
  assert(updatedProfile.status === 200, 'profile update should return 200');
  assert(updatedProfile.body.phone === '+1 (555) 000-1234', 'profile should update phone');

  const insurance = await json('/api/profile/insurance', {
    method: 'PATCH',
    token: login.body.token,
    body: {
      primaryProvider: 'SmokeShield',
      memberId: 'SMOKE-123',
      groupNumber: 'SMOKE-GROUP',
      policyHolder: 'Self',
      activeThrough: '12/2026',
      verifiedAt: 'Jun 04, 2026',
    },
  });
  assert(insurance.status === 200, 'insurance update should return 200');
  assert(insurance.body.primaryProvider === 'SmokeShield', 'insurance should update provider');

  const contact = await json('/api/profile/emergency-contacts', {
    method: 'POST',
    token: login.body.token,
    body: {
      name: 'Smoke Contact',
      relationship: 'Friend',
      primaryPhone: '(555) 111-2222',
      alternatePhone: '-',
      access: 'Emergency Only',
    },
  });
  assert(contact.status === 201, 'emergency contact create should return 201');

  const updatedContact = await json(`/api/profile/emergency-contacts/${contact.body.id}`, {
    method: 'PATCH',
    token: login.body.token,
    body: {
      name: 'Smoke Contact Updated',
      relationship: 'Friend',
      primaryPhone: '(555) 111-2222',
      alternatePhone: '(555) 333-4444',
      access: 'Full Proxy',
    },
  });
  assert(updatedContact.status === 200, 'emergency contact update should return 200');
  assert(updatedContact.body.access === 'Full Proxy', 'emergency contact should update access');

  const deletedContact = await json(`/api/profile/emergency-contacts/${contact.body.id}`, {
    method: 'DELETE',
    token: login.body.token,
  });
  assert(deletedContact.status === 200, 'emergency contact delete should return 200');

  await expectStatus('/api/auth/logout', { method: 'POST', token: login.body.token }, 204);
  await expectStatus('/api/auth/me', { method: 'GET', token: login.body.token }, 401);

  console.log('API smoke test passed');
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(tempDir, { recursive: true, force: true });
}

async function expectStatus(url, options, expectedStatus) {
  const response = await raw(url, options);
  assert(response.status === expectedStatus, `${url} expected ${expectedStatus}, received ${response.status}`);
}

async function json(url, options) {
  const response = await raw(url, options);
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

function raw(url, options = {}) {
  return fetch(`${baseUrl}${url}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
