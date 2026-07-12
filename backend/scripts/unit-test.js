import { getDefaultAccessControl, hasPermission, normalizeAccessControl, normalizeUsers, resolveUserAccess } from '../src/domain/access-control.js';
import { getPatientId } from '../src/domain/patient-scope.js';
import { createCsv, createTextPdf } from '../src/shared/http/download.js';
import { appointmentDecisionSchema, billingPaymentSchema, trendGoalSchema } from '../src/validation.js';
import { drugInteractionGateway, paymentGateway } from '../src/providers/index.js';

const firstPatientId = getPatientId({ id: 'unit-patient-a', patientId: '' });
const repeatedPatientId = getPatientId({ id: 'unit-patient-a', patientId: 'OPTIONAL-MRN' });
const secondPatientId = getPatientId({ id: 'unit-patient-b', patientId: '' });
assert(firstPatientId === repeatedPatientId, 'canonical patient UUID must not depend on optional MRN');
assert(firstPatientId !== secondPatientId, 'canonical patient UUID must be unique per internal user');

const legacyAccess = getDefaultAccessControl();
legacyAccess.roles = legacyAccess.roles.map((role) => ({ ...role, permissionVersion: 2 }));
const upgradedAccess = normalizeAccessControl(legacyAccess);
const patientAccess = resolveUserAccess({ roles: ['patient'], status: 'Active' }, upgradedAccess);
assert(hasPermission(patientAccess, 'billing.statements.manage'), 'own statement permission alias should authorize patient statement generation');
assert(!hasPermission(patientAccess, 'billing.invoices.manage'), 'patient view permissions must not authorize invoice management');

const [deletedUser] = normalizeUsers([{ id: 'deleted', email: 'deleted@example.test', roles: [], deletedAt: new Date().toISOString() }], upgradedAccess);
assert(deletedUser.roles.length === 0 && deletedUser.status === 'Suspended', 'deleted users must not regain default patient access');

expectApiError(() => billingPaymentSchema({ amount: 0 }), 400);
expectApiError(() => appointmentDecisionSchema({ decision: 'Rejected' }), 400);
assert(trendGoalSchema({ label: 'Daily walk', progress: 0 }).progress === 0, 'trend goal progress must allow zero');

const csv = createCsv([{ name: 'Doe, Jane', note: 'Quoted "value"' }]);
assert(csv.includes('"Doe, Jane"') && csv.includes('"Quoted ""value"""'), 'CSV exports must escape commas and quotes');
assert(createTextPdf('Unit PDF', { value: 'safe' }).subarray(0, 5).toString('ascii') === '%PDF-', 'PDF exports must have a valid PDF header');

const firstCharge = await paymentGateway.charge({ amountCents: 1250, paymentMethodToken: 'unit-token', idempotencyKey: 'unit-patient:charge-1' });
const repeatedCharge = await paymentGateway.charge({ amountCents: 1250, paymentMethodToken: 'unit-token', idempotencyKey: 'unit-patient:charge-1' });
assert(firstCharge.providerPaymentId === repeatedCharge.providerPaymentId, 'local payment gateway must be idempotent');

const interaction = await drugInteractionGateway.check({ medicationName: 'Ibuprofen', currentMedications: ['Lisinopril'] });
assert(interaction.warnings.length > 0 && interaction.disclaimer.includes('Informational'), 'local drug screening must be clearly informational');

console.log('Backend unit test passed');

function expectApiError(operation, status) {
  try {
    operation();
  } catch (error) {
    assert(error.statusCode === status, `expected API error status ${status}`);
    return;
  }
  throw new Error(`Expected operation to throw status ${status}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
