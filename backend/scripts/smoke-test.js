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
  assert(me.body.user.roles.includes('admin'), 'first registered user should bootstrap as admin');

  const limitedSignup = await json('/api/auth/signup', {
    method: 'POST',
    body: {
      fullName: 'Limited Portal Patient',
      email: 'limited.patient@example.com',
      dateOfBirth: '1992-03-04',
      patientId: 'SMOKE-200-345',
      password: 'Limited@Test1',
    },
  });
  assert(limitedSignup.status === 201, 'second signup should return 201');
  assert(limitedSignup.body.user.roles.includes('patient'), 'second signup should be a patient');
  assert(!limitedSignup.body.user.roles.includes('admin'), 'second signup should not be an admin');

  const login = await json('/api/auth/login', {
    method: 'POST',
    body: {
      usernameOrEmail: 'smoke.patient@example.com',
      password: 'Smoke@Test1',
    },
  });
  assert(login.status === 200, 'login should return 200');

  const accessOverview = await json('/api/admin/access-control', { method: 'GET', token: login.body.token });
  assert(accessOverview.status === 200, 'admin access overview should return 200');
  assert(accessOverview.body.permissionCatalog.length >= 1, 'access overview should include permissions');
  assert(accessOverview.body.roles.some((role) => role.id === 'doctor'), 'access overview should include doctor role');

  const limitedAdminDenied = await json('/api/admin/access-control', { method: 'GET', token: limitedSignup.body.token });
  assert(limitedAdminDenied.status === 403, 'patient should not access admin access control');

  const patientRole = accessOverview.body.roles.find((role) => role.id === 'patient');
  assert(patientRole, 'patient role should exist');
  const patientWithoutBilling = patientRole.permissions.filter((permission) => !permission.startsWith('billing.'));
  const roleUpdate = await json('/api/admin/access-control/roles/patient', {
    method: 'PATCH',
    token: login.body.token,
    body: { permissions: patientWithoutBilling },
  });
  assert(roleUpdate.status === 200, 'admin should update patient role permissions');
  assert(
    !roleUpdate.body.roles.find((role) => role.id === 'patient').permissions.includes('billing.view'),
    'patient role should lose billing view permission',
  );

  const limitedBilling = await json('/api/billing', { method: 'GET', token: limitedSignup.body.token });
  assert(limitedBilling.status === 403, 'patient without billing.view should be blocked from billing API');

  const limitedPortal = await json('/api/portal', { method: 'GET', token: limitedSignup.body.token });
  assert(limitedPortal.status === 200, 'limited patient portal should still load');
  assert(!('users' in limitedPortal.body), 'limited portal response must not expose users');
  assert(!('sessions' in limitedPortal.body), 'limited portal response must not expose sessions');
  assert(!('accessControl' in limitedPortal.body), 'limited portal response must not expose access control internals');
  assert(limitedPortal.body.billing.invoices.length === 0, 'limited portal should redact billing invoices');

  const limitedUser = roleUpdate.body.users.find((user) => user.email === 'limited.patient@example.com');
  assert(limitedUser, 'limited user should appear in admin overview');
  const userAccessUpdate = await json(`/api/admin/users/${limitedUser.id}/access`, {
    method: 'PATCH',
    token: login.body.token,
    body: { roles: ['doctor'], status: 'Active' },
  });
  assert(userAccessUpdate.status === 200, 'admin should update user access');
  assert(
    userAccessUpdate.body.users.find((user) => user.id === limitedUser.id).roles.includes('doctor'),
    'user access update should assign doctor role',
  );

  const limitedMe = await json('/api/auth/me', { method: 'GET', token: limitedSignup.body.token });
  assert(limitedMe.status === 200, 'updated user session should remain valid');
  assert(limitedMe.body.user.roles.includes('doctor'), 'updated user session should resolve new role');

  const suspendedUser = await json(`/api/admin/users/${limitedUser.id}/access`, {
    method: 'PATCH',
    token: login.body.token,
    body: { roles: ['doctor'], status: 'Suspended' },
  });
  assert(suspendedUser.status === 200, 'admin should suspend a user');

  const suspendedLogin = await json('/api/auth/login', {
    method: 'POST',
    body: {
      usernameOrEmail: 'limited.patient@example.com',
      password: 'Limited@Test1',
    },
  });
  assert(suspendedLogin.status === 401, 'suspended user should not be able to log in');

  const adminUser = accessOverview.body.users.find((user) => user.email === 'smoke.patient@example.com');
  assert(adminUser, 'admin user should appear in access overview');
  const lastAdminRemoval = await json(`/api/admin/users/${adminUser.id}/access`, {
    method: 'PATCH',
    token: login.body.token,
    body: { roles: ['patient'], status: 'Suspended' },
  });
  assert(lastAdminRemoval.status === 403, 'API should prevent removing the last active access admin');

  const dashboard = await json('/api/patient/dashboard', { method: 'GET', token: login.body.token });
  assert(dashboard.status === 200, 'dashboard should return 200');
  assert(dashboard.body.summary.healthId, 'dashboard should include health summary');
  assert(Array.isArray(dashboard.body.latestLabResults), 'dashboard should include lab results');

  const portal = await json('/api/portal', { method: 'GET', token: login.body.token });
  assert(portal.status === 200, 'portal should return 200');
  assert(!('users' in portal.body), 'portal response must not expose users');
  assert(!('sessions' in portal.body), 'portal response must not expose sessions');
  assert(Array.isArray(portal.body.messageConversations), 'portal should include Sprint 3 conversations');

  const records = await json('/api/records?query=glucose&type=all', { method: 'GET', token: login.body.token });
  assert(records.status === 200, 'records list should return 200');
  assert(records.body.labResults.some((lab) => lab.label === 'Glucose, Fasting'), 'records list should filter labs');

  const patientNote = await json('/api/records/notes', {
    method: 'POST',
    token: login.body.token,
    body: {
      title: 'Smoke test patient note',
      text: 'Patient-entered note from smoke coverage.',
      type: 'Patient Note',
    },
  });
  assert(patientNote.status === 201, 'patient note create should return 201');
  assert(patientNote.body.title === 'Smoke test patient note', 'patient note should persist title');

  const labDetail = await json('/api/records/labs/glucose-fasting', { method: 'GET', token: login.body.token });
  assert(labDetail.status === 200, 'lab detail should return 200');
  assert(labDetail.body.narrative.includes('Glucose'), 'lab detail should include narrative');

  const documentDetail = await json('/api/records/documents/doc-1', { method: 'GET', token: login.body.token });
  assert(documentDetail.status === 200, 'document detail should return 200');
  assert(documentDetail.body.document.id === 'doc-1', 'document detail should include document');

  const printableRecord = await json('/api/records/printable', { method: 'GET', token: login.body.token });
  assert(printableRecord.status === 200, 'printable records payload should return 200');
  assert(Array.isArray(printableRecord.body.clinicalNotes), 'printable records should include notes');

  const trends = await json('/api/trends?range=6m', { method: 'GET', token: login.body.token });
  assert(trends.status === 200, 'trends should return 200');
  assert(trends.body.selectedRange === '6m', 'trends should echo selected range');

  const trendsExport = await json('/api/trends/export?range=3m', { method: 'GET', token: login.body.token });
  assert(trendsExport.status === 200, 'trends export should return 200');
  assert(trendsExport.body.printable === true, 'trends export should be printable');

  const upload = await json('/api/files', {
    method: 'POST',
    token: login.body.token,
    body: {
      fileName: 'smoke-upload.pdf',
      category: 'Health records upload',
      size: '42 KB',
      source: 'smoke-test',
    },
  });
  assert(upload.status === 201, 'file metadata upload should return 201');
  assert(upload.body.fileName === 'smoke-upload.pdf', 'file metadata should persist file name');

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

  const attachmentReply = await json(`/api/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    token: login.body.token,
    body: {
      body: 'Attached file metadata for review.',
      attachment: {
        fileName: 'home-blood-pressure-log.pdf',
        size: '96 KB',
      },
    },
  });
  assert(attachmentReply.status === 201, 'conversation attachment reply should return 201');
  assert(attachmentReply.body.conversation.messages.at(-1).attachment.fileName === 'home-blood-pressure-log.pdf', 'attachment metadata should append to thread');

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

  const appointmentsExport = await json('/api/appointments/export?status=upcoming', { method: 'GET', token: login.body.token });
  assert(appointmentsExport.status === 200, 'appointments export should return 200');
  assert(Array.isArray(appointmentsExport.body.appointments), 'appointments export should include appointments');

  const scheduled = await json('/api/appointments', {
    method: 'POST',
    token: login.body.token,
    body: {
      service: 'Follow-up lab review',
      clinician: 'Dr. Sarah Jenkins',
      provider: 'Dr. Sarah Jenkins',
      date: 'Dec 05, 2023',
      time: '10:00 AM (Tuesday)',
      department: 'Cardiology',
      location: 'Main Clinic, Suite 402',
      reason: 'Follow-up lab review',
    },
  });
  assert(scheduled.status === 201, 'schedule appointment should return 201');
  assert(scheduled.body.status === 'Pending', 'scheduled appointment should be pending');

  const appointmentDetail = await json(`/api/appointments/${scheduled.body.id}`, { method: 'GET', token: login.body.token });
  assert(appointmentDetail.status === 200, 'appointment detail should return 200');
  assert(appointmentDetail.body.appointment.id === scheduled.body.id, 'appointment detail should include appointment');

  const rescheduled = await json(`/api/appointments/${scheduled.body.id}/reschedule`, {
    method: 'PATCH',
    token: login.body.token,
    body: {
      date: 'Dec 08, 2023',
      time: '11:30 AM (Friday)',
      provider: 'Dr. Michael Chen',
      department: 'Cardiology',
      notes: 'Smoke test reschedule',
    },
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

  const referrals = await json('/api/referrals', { method: 'GET', token: login.body.token });
  assert(referrals.status === 200, 'referrals list should return 200');
  assert(referrals.body.rows.length >= 1, 'referrals should include seeded rows');

  const referralRequest = await json('/api/referrals', {
    method: 'POST',
    token: login.body.token,
    body: {
      provider: 'Care Team',
      specialty: 'Physical Therapy',
      reason: 'Smoke test mobility referral',
      clinic: 'Metro Rehab Clinic',
    },
  });
  assert(referralRequest.status === 201, 'referral request should return 201');
  assert(referralRequest.body.status === 'Pending', 'referral request should be pending');

  const referralAction = await json(`/api/referrals/${referralRequest.body.id}/action`, {
    method: 'PATCH',
    token: login.body.token,
    body: {
      action: 'View Calendar',
      note: 'Smoke test referral action',
    },
  });
  assert(referralAction.status === 200, 'referral action should return 200');
  assert(referralAction.body.status === 'Scheduled', 'calendar action should mark referral scheduled');

  const referralDetail = await json(`/api/referrals/${referralRequest.body.id}`, { method: 'GET', token: login.body.token });
  assert(referralDetail.status === 200, 'referral detail should return 200');
  assert(referralDetail.body.referral.id === referralRequest.body.id, 'referral detail should include referral');

  const referralExport = await json('/api/referrals/export', { method: 'GET', token: login.body.token });
  assert(referralExport.status === 200, 'referral export should return 200');
  assert(Array.isArray(referralExport.body.referrals), 'referral export should include referrals');

  const resources = await json('/api/resources?query=lab&format=Article', { method: 'GET', token: login.body.token });
  assert(resources.status === 200, 'resources list should return 200');
  assert(resources.body.library.some((resource) => resource.id === 'lib-cbc'), 'resources list should filter library');

  const resourceDetail = await json('/api/resources/lib-cbc', { method: 'GET', token: login.body.token });
  assert(resourceDetail.status === 200, 'resource detail should return 200');
  assert(resourceDetail.body.body.includes('Understanding Lab Results'), 'resource detail should include body');

  const resourceInteraction = await json('/api/resources/lib-cbc/interactions', {
    method: 'POST',
    token: login.body.token,
    body: { action: 'Save' },
  });
  assert(resourceInteraction.status === 201, 'resource interaction should return 201');
  assert(resourceInteraction.body.action === 'Save', 'resource interaction should persist action');

  const groupedResourceDetail = await json('/api/resources/condition-guides-0', { method: 'GET', token: login.body.token });
  assert(groupedResourceDetail.status === 200, 'grouped resource detail should return 200');
  assert(groupedResourceDetail.body.title === 'Type 2 Diabetes Basics', 'grouped resource detail should resolve generated id');

  const groupedResourceInteraction = await json('/api/resources/condition-guides-0/interactions', {
    method: 'POST',
    token: login.body.token,
    body: { action: 'Read Article' },
  });
  assert(groupedResourceInteraction.status === 201, 'grouped resource interaction should return 201');
  assert(groupedResourceInteraction.body.resourceTitle === 'Type 2 Diabetes Basics', 'grouped interaction should persist resource title');

  const immunizations = await json('/api/immunizations', { method: 'GET', token: login.body.token });
  assert(immunizations.status === 200, 'immunizations list should return 200');
  assert(immunizations.body.summary.completed >= 1, 'immunizations list should include completed summary');

  const immunizationDetail = await json('/api/immunizations/imm-covid-3', { method: 'GET', token: login.body.token });
  assert(immunizationDetail.status === 200, 'immunization detail should return 200');
  assert(immunizationDetail.body.record.id === 'imm-covid-3', 'immunization detail should include record');

  const immunizationPrintable = await json('/api/immunizations/printable', { method: 'GET', token: login.body.token });
  assert(immunizationPrintable.status === 200, 'printable immunization record should return 200');
  assert(immunizationPrintable.body.printable === true, 'printable immunization record should be printable');

  const family = await json('/api/family', { method: 'GET', token: login.body.token });
  assert(family.status === 200, 'family access should return 200');
  assert(Array.isArray(family.body.familyAccess.proxies), 'family access should include proxies');

  const proxy = await json('/api/family/proxies', {
    method: 'POST',
    token: login.body.token,
    body: {
      name: 'Smoke Proxy',
      relationship: 'Sibling',
      permissions: 'View Only',
    },
  });
  assert(proxy.status === 201, 'proxy invite should return 201');

  const proxyPermissions = await json(`/api/family/proxies/${proxy.body.id}`, {
    method: 'PATCH',
    token: login.body.token,
    body: { permissions: 'Billing Only' },
  });
  assert(proxyPermissions.status === 200, 'proxy permission update should return 200');
  assert(proxyPermissions.body.permissions === 'Billing Only', 'proxy permission should update');

  const resentProxy = await json(`/api/family/proxies/${proxy.body.id}/resend`, {
    method: 'POST',
    token: login.body.token,
  });
  assert(resentProxy.status === 200, 'proxy resend should return 200');

  const dependent = await json('/api/family/dependents', {
    method: 'POST',
    token: login.body.token,
    body: {
      name: 'Smoke Dependent',
      relationship: 'Child',
      detail: 'Last Visit: Pending',
      access: 'View Only',
    },
  });
  assert(dependent.status === 201, 'dependent add should return 201');

  const privacy = await json('/api/family/privacy', {
    method: 'PATCH',
    token: login.body.token,
    body: {
      shareRecords: false,
      mentalHealthNotes: true,
    },
  });
  assert(privacy.status === 200, 'family privacy update should return 200');
  assert(privacy.body.shareRecords === false && privacy.body.mentalHealthNotes === true, 'family privacy should update');

  const accessReport = await json('/api/family/reports', {
    method: 'POST',
    token: login.body.token,
    body: {
      summary: 'Smoke test access concern',
      contactPreference: 'Secure message',
    },
  });
  assert(accessReport.status === 201, 'unauthorized access report should return 201');
  assert(accessReport.body.status === 'Submitted', 'unauthorized access report should be submitted');

  const accessPolicy = await json('/api/family/policy', { method: 'GET', token: login.body.token });
  assert(accessPolicy.status === 200, 'family access policy should return 200');
  assert(accessPolicy.body.title === 'Proxy Access Policy', 'family access policy should include title');

  const revokedProxy = await json(`/api/family/proxies/${proxy.body.id}`, {
    method: 'DELETE',
    token: login.body.token,
  });
  assert(revokedProxy.status === 200, 'proxy revoke should return 200');

  const prescriptions = await json('/api/prescriptions', { method: 'GET', token: login.body.token });
  assert(prescriptions.status === 200, 'prescriptions overview should return 200');
  assert(prescriptions.body.summary.activeMedications >= 1, 'prescriptions should include summary');
  assert(prescriptions.body.preferredPharmacy.name, 'prescriptions should include preferred pharmacy');

  const printablePrescriptions = await json('/api/prescriptions/printable', { method: 'GET', token: login.body.token });
  assert(printablePrescriptions.status === 200, 'printable prescriptions should return 200');
  assert(Array.isArray(printablePrescriptions.body.prescriptions), 'printable prescriptions should include prescriptions');

  const leaflet = await json('/api/prescriptions/rx-lisinopril/leaflet', { method: 'GET', token: login.body.token });
  assert(leaflet.status === 200, 'medication leaflet should return 200');
  assert(leaflet.body.prescription.id === 'rx-lisinopril', 'medication leaflet should include prescription');

  const interactionCheck = await json('/api/prescriptions/interactions', {
    method: 'POST',
    token: login.body.token,
    body: { medicationName: 'Ibuprofen 200 mg' },
  });
  assert(interactionCheck.status === 201, 'interaction check should return 201');
  assert(interactionCheck.body.medicationName === 'Ibuprofen 200 mg', 'interaction check should include medication');

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

  const invoiceToPay = billing.body.invoices.find((invoice) => invoice.status === 'Overdue' || invoice.status === 'Pending');
  assert(invoiceToPay, 'billing should include an invoice that can be paid');

  const invoiceDetail = await json(`/api/billing/invoices/${invoiceToPay.id}`, { method: 'GET', token: login.body.token });
  assert(invoiceDetail.status === 200, 'invoice detail should return 200');
  assert(invoiceDetail.body.invoice.id === invoiceToPay.id, 'invoice detail should include invoice');

  const billingResource = await json('/api/billing/resources/tax-form-1095-b', { method: 'GET', token: login.body.token });
  assert(billingResource.status === 200, 'billing resource should return 200');
  assert(billingResource.body.id === 'tax-form-1095-b', 'billing resource should include resource');

  const paymentSession = await json('/api/billing/payment-sessions', {
    method: 'POST',
    token: login.body.token,
    body: { invoiceId: invoiceToPay.id },
  });
  assert(paymentSession.status === 201, 'payment session should return 201');
  assert(paymentSession.body.invoiceId === invoiceToPay.id, 'payment session should include invoice id');

  const invoicePayment = await json('/api/billing/payments', {
    method: 'POST',
    token: login.body.token,
    body: {
      invoiceId: invoiceToPay.id,
      amount: invoiceToPay.amount,
      paymentMethodId: paymentMethod.body.id,
    },
  });
  assert(invoicePayment.status === 201, 'invoice payment should return 201');
  assert(
    invoicePayment.body.outstandingBalance === Number((billing.body.outstandingBalance - invoiceToPay.amount).toFixed(2)),
    'invoice payment should reduce outstanding balance by invoice amount',
  );
  assert(
    invoicePayment.body.invoices.find((invoice) => invoice.id === invoiceToPay.id).status === 'Paid',
    'invoice payment should mark that invoice paid',
  );

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
