import { createDevelopmentAdmin } from '../src/features/auth/auth.service.js';

const email = process.env.ADMIN_EMAIL || 'admin@example.test';
const password = process.env.ADMIN_PASSWORD || 'Admin@Test1';
const fullName = process.env.ADMIN_NAME || 'Development Admin';
const patientId = process.env.ADMIN_PATIENT_ID || 'DEV-ADMIN';

const admin = await createDevelopmentAdmin({
  email,
  password,
  fullName,
  patientId,
  dateOfBirth: process.env.ADMIN_DOB || '1970-01-01',
});

console.log(`Development admin ready: ${admin.email}`);
