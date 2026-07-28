import { createAdminUser } from '../src/features/admin/admin-access.service.js';
import { createDevelopmentAdmin, registerPatient } from '../src/features/auth/auth.service.js';
import { provisionPatientDemoData } from '../src/domain/patient-scope.js';
import { resetDb, updateDb } from '../src/store.js';
import { seedData } from '../src/seed-data.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Development demo users cannot be seeded in production');
}

await resetDb(seedData);

const patientCredentials = {
  fullName: 'Sarah Mitchell',
  email: 'patient@example.test',
  dateOfBirth: '1985-05-12',
  patientId: '100-234-567',
  password: 'Patient@Test1',
};
await registerPatient(patientCredentials);

await updateDb((database) => {
  const patient = database.users.find((user) => user.email === patientCredentials.email);
  provisionPatientDemoData(database, patient);
  database.sessions = [];
});

const admin = await createDevelopmentAdmin({
  fullName: 'Development Admin',
  email: 'admin@example.test',
  dateOfBirth: '1970-01-01',
  patientId: '',
  password: 'Admin@Test1',
});

await createAdminUser(admin, {
  fullName: 'Dr. Demo Clinician',
  email: 'clinician@example.test',
  dateOfBirth: '1980-01-01',
  patientId: '',
  roles: ['doctor'],
  status: 'Active',
  password: 'Clinician@Test1',
});

await updateDb((database) => {
  database.sessions = [];
});

console.log('Development demo users seeded.');
console.log('Patient: patient@example.test / Patient@Test1');
console.log('Clinician: clinician@example.test / Clinician@Test1');
console.log('Admin: admin@example.test / Admin@Test1');
