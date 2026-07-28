import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const tempDir = await mkdtemp(path.join(tmpdir(), 'emr-security-'));
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'security-regression-test-secret-change-me';
process.env.EMR_DB_PATH = path.join(tempDir, 'emr.sqlite');
process.env.EMR_UPLOAD_DIR = path.join(tempDir, 'uploads');
process.env.APP_BASE_URL = 'http://127.0.0.1:4000';
process.env.PORT = '0';

const { createApp } = await import('../src/app.js');
const { createDevelopmentAdmin } = await import('../src/features/auth/auth.service.js');
const { getPatientId, stampPatientOwnership } = await import('../src/domain/patient-scope.js');
const { getDbPath, readDb, updateDb } = await import('../src/store.js');

const server = createServer(createApp());
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

try {
  const patientA = await signup({
    fullName: 'Security Patient Alpha',
    email: 'security.alpha@example.test',
    dateOfBirth: '1980-01-01',
    patientId: '',
    password: 'Alpha@Test1',
  });
  const patientB = await signup({
    fullName: 'Security Patient Beta',
    email: 'security.beta@example.test',
    dateOfBirth: '1981-02-02',
    patientId: '',
    password: 'Beta@Test1',
    rememberMe: true,
  });

  assert(patientA.body.currentPatientContext.id, 'patient A must receive a patient context');
  assert(patientB.body.currentPatientContext.id, 'patient B must receive a patient context');
  assert(patientA.body.currentPatientContext.id !== patientB.body.currentPatientContext.id, 'empty MRNs must never collapse patient ownership');
  assert(Date.parse(patientB.body.session.expiresAt) > Date.parse(patientA.body.session.expiresAt), 'Remember Me must use a longer server-controlled expiry');

  await seedPrivateRecords(patientA.body.user.id, patientB.body.user.id);

  const persisted = await readDb();
  assert(persisted.sessions.length === 2, 'signup sessions should persist');
  assert(persisted.sessions.every((session) => session.tokenHash && !session.token), 'only hashed session tokens may be persisted');
  assert(!JSON.stringify(persisted.sessions).includes(patientA.body.token), 'raw bearer tokens must not be readable from persistence');

  const sqlite = new DatabaseSync(getDbPath(), { readOnly: true });
  const appState = sqlite.prepare("SELECT data_json FROM app_state WHERE key = 'current'").get()?.data_json || '';
  sqlite.close();
  assert(!appState.includes('security.alpha@example.test'), 'app_state must not contain indexed users');
  assert(!appState.includes(patientA.body.token), 'app_state must not contain raw session tokens');
  assert(!appState.includes('patientProfiles'), 'app_state must not contain patient profile collections');

  const portalA = await api('/api/portal', { token: patientA.body.token });
  const portalB = await api('/api/portal', { token: patientB.body.token });
  assert(portalA.status === 200 && portalB.status === 200, 'both patients should load their portal bootstrap');
  for (const unsafeKey of ['users', 'sessions', 'patientProfiles', 'auditLog', 'accessControl']) {
    assert(!(unsafeKey in portalA.body), `portal DTO must not expose ${unsafeKey}`);
  }
  assert(!JSON.stringify(portalA.body).includes('ALPHA-PRIVATE-MARKER'), 'portal bootstrap must not embed patient feature records');
  assert(!JSON.stringify(portalB.body).includes('BETA-PRIVATE-MARKER'), 'portal bootstrap must not embed patient feature records');
  assert(portalA.body.featureEndpoints.records === '/api/records', 'portal bootstrap should advertise dedicated feature endpoints');
  const recordsA = await api('/api/records', { token: patientA.body.token });
  const recordsB = await api('/api/records', { token: patientB.body.token });
  assert(JSON.stringify(recordsA.body).includes('ALPHA-PRIVATE-MARKER'), 'patient A should see patient A records');
  assert(!JSON.stringify(recordsA.body).includes('BETA-PRIVATE-MARKER'), 'patient A must not see patient B records');
  assert(JSON.stringify(recordsB.body).includes('BETA-PRIVATE-MARKER'), 'patient B should see patient B records');
  assert(!JSON.stringify(recordsB.body).includes('ALPHA-PRIVATE-MARKER'), 'patient B must not see patient A records');

  await expectDenied('/api/records/labs/lab-alpha-private', patientB.body.token, 404);
  await expectDenied('/api/records/documents/document-alpha-private', patientB.body.token, 404);
  await expectDenied('/api/billing/invoices/INV-ALPHA-PRIVATE', patientB.body.token, 404);
  const billingB = await api('/api/billing', { token: patientB.body.token });
  assert(billingB.status === 200, 'patient B billing should load');
  assert(!JSON.stringify(billingB.body).includes('ALPHA-PRIVATE-MARKER'), 'billing overview must remain patient scoped');
  const zeroPayment = await api('/api/billing/payments', {
    method: 'POST',
    token: patientB.body.token,
    body: { invoiceId: 'INV-ALPHA-PRIVATE', amount: 0 },
  });
  assert(zeroPayment.status === 400, 'zero-amount payment requests must be rejected before any billing data is returned');
  assert(!JSON.stringify(zeroPayment.body).includes('ALPHA-PRIVATE-MARKER'), 'billing errors must not expose another patient invoice');

  const printableA = await api('/api/records/printable', { token: patientA.body.token });
  const printableB = await api('/api/records/printable', { token: patientB.body.token });
  assert(printableA.status === 200 && printableB.status === 200, 'printable record DTOs should load');
  assert(JSON.stringify(printableA.body).includes('ALPHA-PRIVATE-MARKER'), 'patient A printable record should contain patient A data');
  assert(!JSON.stringify(printableA.body).includes('BETA-PRIVATE-MARKER'), 'patient A printable record must exclude patient B data');
  assert(!JSON.stringify(printableB.body).includes('ALPHA-PRIVATE-MARKER'), 'patient B printable record must exclude patient A data');

  const upload = new FormData();
  upload.set('category', 'Security regression');
  upload.set('file', new Blob(['%PDF-1.4\nALPHA-FILE-CONTENT\n%%EOF'], { type: 'application/pdf' }), 'alpha-private.pdf');
  const uploaded = await api('/api/files', { method: 'POST', token: patientA.body.token, body: upload });
  assert(uploaded.status === 201, 'patient A should upload a real multipart file');
  await expectDenied(`/api/files/${uploaded.body.id}`, patientB.body.token, 404);
  await expectDenied(`/api/files/${uploaded.body.id}/download`, patientB.body.token, 404);

  const cookieMe = await api('/api/auth/me', { cookie: patientA.cookie });
  assert(cookieMe.status === 200, 'HttpOnly cookie bootstrap should authenticate');
  const missingCsrf = await api('/api/preferences/share-records', {
    method: 'PATCH',
    cookie: patientA.cookie,
    body: { shareRecords: false },
  });
  assert(missingCsrf.status === 403 && missingCsrf.body.code === 'FORBIDDEN', 'cookie mutations must require CSRF');
  const validCsrf = await api('/api/preferences/share-records', {
    method: 'PATCH',
    cookie: patientA.cookie,
    csrf: patientA.body.csrfToken,
    body: { shareRecords: false },
  });
  assert(validCsrf.status === 200, 'valid cookie CSRF token should permit the mutation');
  const bearerMutation = await api('/api/preferences/share-records', {
    method: 'PATCH',
    token: patientA.body.token,
    body: { shareRecords: true },
  });
  assert(bearerMutation.status === 200, 'development bearer clients should not require browser CSRF');
  const hostileOrigin = await api('/api/preferences/share-records', {
    method: 'PATCH',
    token: patientA.body.token,
    origin: 'https://attacker.invalid',
    body: { shareRecords: false },
  });
  assert(hostileOrigin.status === 403, 'mutations from unapproved origins must be rejected');

  const resetKnown = await api('/api/auth/password-reset/request', {
    method: 'POST',
    body: { email: 'security.beta@example.test' },
  });
  const resetUnknown = await api('/api/auth/password-reset/request', {
    method: 'POST',
    body: { email: 'missing-account@example.test' },
  });
  assert(resetKnown.status === 202 && resetUnknown.status === 202, 'password reset requests should be non-enumerating');
  assert(JSON.stringify(resetKnown.body) === JSON.stringify(resetUnknown.body), 'known and unknown reset responses must match');
  const resetDb = await readDb();
  const resetDelivery = [...(resetDb.notificationOutbox || [])].reverse().find((item) => item.template === 'password-reset' && item.recipient === 'security.beta@example.test');
  assert(resetDelivery, 'local notification outbox should receive a password reset link');
  const resetToken = tokenFromUrl(resetDelivery.body, '/reset-password');
  assert(resetToken, 'password reset delivery should contain a one-time token');
  assert((resetDb.passwordResetTokens || []).every((item) => item.tokenHash && !item.token), 'only password reset token hashes may be stored in the token repository');
  const resetConfirmed = await api('/api/auth/password-reset/confirm', {
    method: 'POST',
    body: { token: resetToken, newPassword: 'Beta@Changed2' },
  });
  assert(resetConfirmed.status === 200 && resetConfirmed.body.changed === true, 'valid reset token should change the password');
  await expectDenied('/api/auth/me', patientB.body.token, 401);
  const reusedReset = await api('/api/auth/password-reset/confirm', {
    method: 'POST',
    body: { token: resetToken, newPassword: 'Beta@Changed3' },
  });
  assert(reusedReset.status === 400, 'password reset tokens must be one-time');
  const oldPasswordLogin = await login('security.beta@example.test', 'Beta@Test1');
  assert(oldPasswordLogin.status === 401, 'the old password must stop working after reset');
  const newPasswordLogin = await login('security.beta@example.test', 'Beta@Changed2');
  assert(newPasswordLogin.status === 200, 'the new password should work after reset');

  const removedFamilyEndpoint = await api('/api/family', { token: patientA.body.token });
  assert(removedFamilyEndpoint.status === 404, 'removed family access endpoints must remain unavailable');

  await createDevelopmentAdmin({
    fullName: 'Security Administrator',
    email: 'security.admin@example.test',
    dateOfBirth: '1970-01-01',
    patientId: '',
    password: 'Admin@Test1',
  });
  const adminLogin = await login('security.admin@example.test', 'Admin@Test1');
  assert(adminLogin.status === 200, 'development administrator should log in');
  assert(adminLogin.body.currentPatientContext.id === patientA.body.currentPatientContext.id, 'staff login should default only to a verified patient context, not a fabricated staff patient');
  const suspended = await api(`/api/admin/users/${patientB.body.user.id}/access`, {
    method: 'PATCH',
    token: adminLogin.body.token,
    body: { roles: ['patient'], status: 'Suspended' },
  });
  assert(suspended.status === 200, 'administrator should suspend the selected account');
  await expectDenied('/api/auth/me', newPasswordLogin.body.token, 401);
  const suspendedLogin = await login('security.beta@example.test', 'Beta@Changed2');
  assert(suspendedLogin.status === 401, 'suspended accounts must not create sessions');

  const loggedOut = await api('/api/auth/logout', {
    method: 'POST',
    cookie: patientA.cookie,
    csrf: patientA.body.csrfToken,
  });
  assert(loggedOut.status === 204, 'cookie logout should revoke the current session');
  const afterLogout = await api('/api/auth/me', { cookie: patientA.cookie });
  assert(afterLogout.status === 401, 'revoked cookie session must not bootstrap again');

  console.log('Security regression test passed');
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(tempDir, { recursive: true, force: true });
}

async function signup(input) {
  const result = await api('/api/auth/signup', { method: 'POST', body: input });
  assert(result.status === 201, `signup failed for ${input.email}: ${JSON.stringify(result.body)}`);
  assert(result.cookie, 'signup must set an HttpOnly session cookie');
  assert(String(result.setCookie).toLowerCase().includes('httponly'), 'session cookie must be HttpOnly');
  return result;
}

async function login(usernameOrEmail, password) {
  return api('/api/auth/login', { method: 'POST', body: { usernameOrEmail, password } });
}

async function seedPrivateRecords(userAId, userBId) {
  await updateDb((database) => {
    const userA = database.users.find((user) => user.id === userAId);
    const userB = database.users.find((user) => user.id === userBId);
    assert(userA && userB, 'security fixture users must exist');
    const createdAt = new Date().toISOString();

    database.labResults ||= [];
    database.labResults.push(
      stampPatientOwnership({ id: 'lab-alpha-private', name: 'ALPHA-PRIVATE-MARKER', value: '101', unit: 'mg/dL', status: 'Final', date: '2026-01-01', createdAt }, userA),
      stampPatientOwnership({ id: 'lab-beta-private', name: 'BETA-PRIVATE-MARKER', value: '202', unit: 'mg/dL', status: 'Final', date: '2026-01-02', createdAt }, userB),
    );
    database.clinicalNotes ||= [];
    database.clinicalNotes.push(
      stampPatientOwnership({ id: 'note-alpha-private', title: 'ALPHA-PRIVATE-MARKER', text: 'Alpha clinical note', type: 'Clinical Note', provenance: 'clinician', verificationStatus: 'Verified', createdAt }, userA),
      stampPatientOwnership({ id: 'note-beta-private', title: 'BETA-PRIVATE-MARKER', text: 'Beta clinical note', type: 'Clinical Note', provenance: 'clinician', verificationStatus: 'Verified', createdAt }, userB),
    );
    database.documents ||= [];
    database.documents.push(
      stampPatientOwnership({ id: 'document-alpha-private', name: 'ALPHA-PRIVATE-MARKER', category: 'Clinical', status: 'Available', createdAt }, userA),
      stampPatientOwnership({ id: 'document-beta-private', name: 'BETA-PRIVATE-MARKER', category: 'Clinical', status: 'Available', createdAt }, userB),
    );
    database.messageConversations ||= [];
    database.messageConversations.push(
      stampPatientOwnership({ id: 'conversation-alpha-private', subject: 'ALPHA-PRIVATE-MARKER', participants: [], messages: [], createdAt }, userA),
      stampPatientOwnership({ id: 'conversation-beta-private', subject: 'BETA-PRIVATE-MARKER', participants: [], messages: [], createdAt }, userB),
    );
    database.billing ||= {};
    database.billing.invoices ||= [];
    database.billing.invoices.push(
      stampPatientOwnership({ id: 'INV-ALPHA-PRIVATE', description: 'ALPHA-PRIVATE-MARKER', date: '2026-01-01', amount: 125, paidAmount: 0, balanceDue: 125, status: 'Pending', createdAt }, userA),
      stampPatientOwnership({ id: 'INV-BETA-PRIVATE', description: 'BETA-PRIVATE-MARKER', date: '2026-01-02', amount: 75, paidAmount: 0, balanceDue: 75, status: 'Pending', createdAt }, userB),
    );
    assert(getPatientId(userA) !== getPatientId(userB), 'fixture patient UUIDs must be unique');
  });
}

async function expectDenied(url, token, status) {
  const response = await api(url, { token });
  assert(response.status === status, `${url} should return ${status}, received ${response.status}: ${JSON.stringify(response.body)}`);
  assert(response.body.requestId, 'structured API errors must include requestId');
  assert(response.body.status === status, 'structured API errors must include numeric status');
}

async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  if (options.cookie) headers.set('Cookie', options.cookie);
  if (options.csrf) headers.set('X-CSRF-Token', options.csrf);
  if (options.patientContext) headers.set('X-Patient-Context', options.patientContext);
  if (options.origin) headers.set('Origin', options.origin);

  let body = options.body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${url}`, {
    method: options.method || 'GET',
    headers,
    body,
    redirect: 'manual',
  });
  const contentType = response.headers.get('content-type') || '';
  const responseBody = response.status === 204
    ? null
    : contentType.includes('application/json')
      ? await response.json()
      : await response.text();
  const setCookie = response.headers.get('set-cookie') || '';
  const cookieValue = setCookie.match(/(?:^|,\s*)emr_session=([^;]+)/)?.[1] || '';
  return {
    status: response.status,
    body: responseBody,
    setCookie,
    cookie: cookieValue ? `emr_session=${cookieValue}` : '',
    headers: response.headers,
  };
}

function tokenFromUrl(value, expectedPath) {
  const match = String(value || '').match(/https?:\/\/[^\s]+/);
  if (!match) return '';
  const parsed = new URL(match[0]);
  if (parsed.pathname !== expectedPath) return '';
  return parsed.searchParams.get('token') || '';
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
