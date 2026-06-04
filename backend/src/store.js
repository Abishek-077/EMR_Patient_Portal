import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedData } from './seed-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const configuredDbPath = process.env.EMR_DB_PATH ? path.resolve(process.env.EMR_DB_PATH) : '';
const dataDir = configuredDbPath ? path.dirname(configuredDbPath) : path.join(rootDir, 'data');
const dbPath = configuredDbPath || path.join(dataDir, 'db.json');
const tmpPath = path.join(dataDir, 'db.tmp.json');

let writeQueue = Promise.resolve();

export async function readDb() {
  await ensureStore();
  const db = JSON.parse(await readFile(dbPath, 'utf8'));
  return normalizeDb(db);
}

export async function writeDb(db) {
  await ensureStore();
  const normalizedDb = normalizeDb(db);
  await writeFile(tmpPath, `${JSON.stringify(normalizedDb, null, 2)}\n`, 'utf8');
  await rename(tmpPath, dbPath);
}

export async function updateDb(mutator) {
  const operation = writeQueue.then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    await writeDb(db);
    return result;
  });

  writeQueue = operation.catch(() => undefined);
  return operation;
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(dbPath)) {
    await writeFile(dbPath, `${JSON.stringify(seedData, null, 2)}\n`, 'utf8');
  }
}

function normalizeDb(db) {
  return {
    ...structuredClone(seedData),
    ...db,
    users: Array.isArray(db.users) ? db.users : [],
    sessions: Array.isArray(db.sessions) ? db.sessions : [],
    tasks: Array.isArray(db.tasks) ? db.tasks : [],
    appointments: shouldUseExistingAppointments(db.appointments) ? db.appointments : seedData.appointments,
    appointmentRequests: Array.isArray(db.appointmentRequests) ? db.appointmentRequests : [],
    medications: Array.isArray(db.medications) ? db.medications : [],
    prescriptions: Array.isArray(db.prescriptions) ? db.prescriptions : [],
    refillRequests: Array.isArray(db.refillRequests) ? db.refillRequests : [],
    medicationRequests: Array.isArray(db.medicationRequests) ? db.medicationRequests : [],
    preferredPharmacy: {
      ...seedData.preferredPharmacy,
      ...(db.preferredPharmacy || {}),
    },
    labResults: Array.isArray(db.labResults) ? db.labResults : [],
    messages: Array.isArray(db.messages) ? db.messages : [],
    messageConversations: Array.isArray(db.messageConversations) ? db.messageConversations : seedData.messageConversations,
    documents: Array.isArray(db.documents) ? db.documents : [],
    billing: {
      ...seedData.billing,
      ...(db.billing || {}),
      breakdown: {
        ...seedData.billing.breakdown,
        ...(db.billing?.breakdown || {}),
      },
      paymentMethods: Array.isArray(db.billing?.paymentMethods) ? db.billing.paymentMethods : [],
      invoices: Array.isArray(db.billing?.invoices) ? db.billing.invoices : [],
      payments: Array.isArray(db.billing?.payments) ? db.billing.payments : [],
      statements: Array.isArray(db.billing?.statements) ? db.billing.statements : seedData.billing.statements,
      resources: Array.isArray(db.billing?.resources) ? db.billing.resources : seedData.billing.resources,
    },
    preferences: {
      ...seedData.preferences,
      ...(db.preferences || {}),
    },
    patient: {
      ...seedData.patient,
      ...(db.patient || {}),
    },
    profileSettings: {
      ...seedData.profileSettings,
      ...(db.profileSettings || {}),
    },
    accountStatus: {
      ...seedData.accountStatus,
      ...(db.accountStatus || {}),
    },
    insuranceDetails: {
      ...seedData.insuranceDetails,
      ...(db.insuranceDetails || {}),
    },
    emergencyContacts: Array.isArray(db.emergencyContacts) ? db.emergencyContacts : seedData.emergencyContacts,
  };
}

function shouldUseExistingAppointments(appointments) {
  return Array.isArray(appointments) && appointments.some((appointment) => appointment.statusGroup || appointment.department);
}
