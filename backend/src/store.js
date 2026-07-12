import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { normalizeAccessControl, normalizeUsers } from './domain/access-control.js';
import { normalizePatientData } from './domain/patient-scope.js';
import { seedData } from './seed-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const configuredDbPath = process.env.EMR_DB_PATH ? path.resolve(process.env.EMR_DB_PATH) : '';
const dataDir = configuredDbPath ? path.dirname(configuredDbPath) : path.join(rootDir, 'data');
const dbPath = configuredDbPath || path.join(dataDir, 'emr.sqlite');

const TOP_LEVEL_COLLECTIONS = [
  'tasks',
  'providers',
  'appointmentSlots',
  'appointments',
  'appointmentRequests',
  'medications',
  'prescriptions',
  'refillRequests',
  'medicationRequests',
  'labResults',
  'clinicalNotes',
  'immunizations',
  'messages',
  'messageConversations',
  'documents',
  'uploadedFiles',
  'activityLog',
  'resourceInteractions',
  'interactionChecks',
  'emergencyContacts',
  'notifications',
  'notificationOutbox',
  'accessGrants',
  'patientAccessGrants',
  'passwordResetTokens',
];

const NESTED_COLLECTIONS = [
  ['billing.paymentMethods', (db) => db.billing?.paymentMethods],
  ['billing.invoices', (db) => db.billing?.invoices],
  ['billing.payments', (db) => db.billing?.payments],
  ['billing.statements', (db) => db.billing?.statements],
  ['billing.paymentSessions', (db) => db.billing?.paymentSessions],
  ['billing.resources', (db) => db.billing?.resources],
  ['referrals.rows', (db) => db.referrals?.rows],
  ['familyAccess.proxies', (db) => db.familyAccess?.proxies],
  ['familyAccess.accounts', (db) => db.familyAccess?.accounts],
  ['familyAccess.activity', (db) => db.familyAccess?.activity],
  ['familyAccess.reports', (db) => db.familyAccess?.reports],
  ['healthTrends.metrics', (db) => db.healthTrends?.metrics],
  ['healthTrends.labComparison', (db) => db.healthTrends?.labComparison],
  ['healthTrends.goals', (db) => db.healthTrends?.goals],
  ['immunizationRecords.alerts', (db) => db.immunizationRecords?.alerts],
  ['immunizationRecords.completed', (db) => db.immunizationRecords?.completed],
  ['educationalResources.library', (db) => db.educationalResources?.library],
  ['educationalResources.groups', (db) => db.educationalResources?.groups],
];

const SINGLETON_COLLECTIONS = [
  'preferredPharmacy',
  'patient',
  'profileSettings',
  'accountStatus',
  'insuranceDetails',
  'preferences',
];

let writeQueue = Promise.resolve();
let connection = null;
let initialized = false;

export async function readDb() {
  const database = await ensureStore();
  return readDatabase(database);
}

function readDatabase(database) {
  const row = database.prepare('SELECT data_json FROM app_state WHERE key = ?').get('current');
  const globalState = row ? JSON.parse(row.data_json) : structuredClone(seedData);
  return normalizeDb(hydrateIndexedDatabase(database, globalState));
}

export async function writeDb(db) {
  const database = await ensureStore();
  const normalizedDb = normalizeDb(db);
  persistDatabase(database, normalizedDb);
}

export async function updateDb(mutator) {
  const operation = writeQueue.then(async () => {
    const database = await ensureStore();
    database.exec('BEGIN IMMEDIATE');
    try {
      const db = readDatabase(database);
      const result = await mutator(db);
      persistDatabase(database, normalizeDb(db), { manageTransaction: false });
      database.exec('COMMIT');
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  });

  writeQueue = operation.catch(() => undefined);
  return operation;
}

export async function resetDb(nextDb = seedData) {
  const database = await ensureStore();
  persistDatabase(database, normalizeDb(nextDb));
}

export function getDbPath() {
  return dbPath;
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  const database = openConnection();
  runMigrations(database);

  const state = database.prepare('SELECT data_json FROM app_state WHERE key = ?').get('current');
  if (!state) {
    persistDatabase(database, normalizeDb(seedData));
  }

  return database;
}

function openConnection() {
  if (!connection) {
    connection = new DatabaseSync(dbPath);
    connection.exec('PRAGMA journal_mode = WAL');
    connection.exec('PRAGMA foreign_keys = ON');
    connection.exec('PRAGMA busy_timeout = 5000');
  }
  return connection;
}

function runMigrations(database) {
  if (initialized) return;

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      patient_id TEXT,
      status TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT,
      expires_at TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS access_control (
      key TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patient_profiles (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      user_id TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS domain_records (
      collection TEXT NOT NULL,
      record_id TEXT NOT NULL,
      patient_id TEXT,
      user_id TEXT,
      created_by_user_id TEXT,
      status TEXT,
      event_date TEXT,
      related_id TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      provenance TEXT,
      verification_status TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      data_json TEXT NOT NULL,
      PRIMARY KEY (collection, record_id)
    );

    CREATE INDEX IF NOT EXISTS idx_domain_records_patient
      ON domain_records (collection, patient_id, deleted_at);

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT,
      patient_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      created_at TEXT NOT NULL,
      data_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_events_patient
      ON audit_events (patient_id, created_at);
  `);

  const migration = database.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(1);
  if (!migration) {
    database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());
  }

  const relationalMigration = database.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(2);
  if (!relationalMigration) {
    const legacyState = database.prepare('SELECT data_json FROM app_state WHERE key = ?').get('current');
    if (legacyState) {
      const legacyDatabase = JSON.parse(legacyState.data_json);
      indexAuditEvents(database, legacyDatabase.auditLog || []);
    }
    database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(2, new Date().toISOString());
  }

  const hashedSessionMigration = database.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(3);
  if (!hashedSessionMigration) {
    const sessionColumns = new Set(database.prepare('PRAGMA table_info(sessions)').all().map((column) => column.name));
    if (!sessionColumns.has('token_hash')) database.exec('ALTER TABLE sessions ADD COLUMN token_hash TEXT');
    database.exec('DELETE FROM sessions');
    database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash)');
    database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(3, new Date().toISOString());
  }

  const patientIdentityMigration = database.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(4);
  if (!patientIdentityMigration) {
    const userColumns = new Set(database.prepare('PRAGMA table_info(users)').all().map((column) => column.name));
    if (!userColumns.has('patient_uuid')) database.exec('ALTER TABLE users ADD COLUMN patient_uuid TEXT');
    database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_patient_uuid ON users (patient_uuid) WHERE patient_uuid IS NOT NULL AND patient_uuid <> ''");
    database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(4, new Date().toISOString());
  }

  const queryableDomainMigration = database.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(5);
  if (!queryableDomainMigration) {
    const columns = new Set(database.prepare('PRAGMA table_info(domain_records)').all().map((column) => column.name));
    const additions = [
      ['status', 'TEXT'],
      ['event_date', 'TEXT'],
      ['related_id', 'TEXT'],
      ['version', 'INTEGER NOT NULL DEFAULT 1'],
      ['provenance', 'TEXT'],
      ['verification_status', 'TEXT'],
    ];
    for (const [name, type] of additions) {
      if (!columns.has(name)) database.exec(`ALTER TABLE domain_records ADD COLUMN ${name} ${type}`);
    }
    database.exec('CREATE INDEX IF NOT EXISTS idx_domain_records_status ON domain_records (collection, patient_id, status, deleted_at)');
    database.exec('CREATE INDEX IF NOT EXISTS idx_domain_records_date ON domain_records (collection, patient_id, event_date)');
    database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(5, new Date().toISOString());
  }

  const sessionIdentityMigration = database.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(6);
  if (!sessionIdentityMigration) {
    const sessionColumns = new Set(database.prepare('PRAGMA table_info(sessions)').all().map((column) => column.name));
    if (!sessionColumns.has('id')) {
      const currentSessions = database.prepare('SELECT data_json FROM sessions').all().map((row) => JSON.parse(row.data_json));
      database.exec(`
        CREATE TABLE sessions_v6 (
          id TEXT PRIMARY KEY,
          token_hash TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
          expires_at TEXT,
          data_json TEXT NOT NULL,
          created_at TEXT,
          deleted_at TEXT
        )
      `);
      const insert = database.prepare(`
        INSERT INTO sessions_v6 (id, token_hash, user_id, expires_at, data_json, created_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const session of currentSessions.filter((item) => item.id && item.tokenHash)) {
        insert.run(session.id, session.tokenHash, session.userId || '', session.expiresAt || '', JSON.stringify(session), session.createdAt || null, deletedAt(session));
      }
      database.exec('DROP TABLE sessions');
      database.exec('ALTER TABLE sessions_v6 RENAME TO sessions');
      database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash)');
    }
    database.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(6, new Date().toISOString());
  }

  initialized = true;
}

function persistDatabase(database, db, { manageTransaction = true } = {}) {
  const now = new Date().toISOString();
  if (manageTransaction) database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare(`
      INSERT INTO app_state (key, data_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
    `).run('current', JSON.stringify(buildGlobalState(db)), now);

    database.prepare(`
      INSERT INTO access_control (key, data_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at
    `).run('current', JSON.stringify(db.accessControl || {}), now);

    database.exec('DELETE FROM users');
    database.exec('DELETE FROM sessions');
    database.exec('DELETE FROM patient_profiles');
    database.exec('DELETE FROM domain_records');

    indexUsers(database, db.users || []);
    indexSessions(database, db.sessions || []);
    indexPatientProfiles(database, db.patientProfiles || []);
    indexDomainRecords(database, db);
    indexAuditEvents(database, db.auditLog || []);

    if (manageTransaction) database.exec('COMMIT');
  } catch (error) {
    if (manageTransaction) database.exec('ROLLBACK');
    throw error;
  }
}

function indexUsers(database, users) {
  const statement = database.prepare(`
    INSERT INTO users (id, email, patient_id, patient_uuid, status, data_json, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const user of users) {
    statement.run(
      recordId(user),
      user.email || '',
      user.patientId || '',
      user.patientUuid || null,
      user.status || '',
      JSON.stringify(user),
      user.createdAt || null,
      user.updatedAt || user.accessUpdatedAt || null,
      deletedAt(user),
    );
  }
}

function indexSessions(database, sessions) {
  const statement = database.prepare(`
    INSERT INTO sessions (id, token_hash, user_id, expires_at, data_json, created_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const session of sessions) {
    statement.run(
      session.id || recordId(session),
      session.tokenHash || null,
      session.userId || '',
      session.expiresAt || '',
      JSON.stringify(session),
      session.createdAt || null,
      deletedAt(session),
    );
  }
}

function indexPatientProfiles(database, profiles) {
  const statement = database.prepare(`
    INSERT INTO patient_profiles (id, patient_id, user_id, data_json, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const profile of profiles) {
    statement.run(
      recordId(profile),
      profile.patientId || '',
      profile.userId || '',
      JSON.stringify(profile),
      profile.createdAt || null,
      profile.updatedAt || null,
      deletedAt(profile),
    );
  }
}

function indexDomainRecords(database, db) {
  const statement = database.prepare(`
    INSERT INTO domain_records (
      collection,
      record_id,
      patient_id,
      user_id,
      created_by_user_id,
      status,
      event_date,
      related_id,
      version,
      provenance,
      verification_status,
      created_at,
      updated_at,
      deleted_at,
      data_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const collection of TOP_LEVEL_COLLECTIONS) {
    indexCollection(statement, collection, db[collection]);
  }

  for (const [collection, getter] of NESTED_COLLECTIONS) {
    indexCollection(statement, collection, getter(db));
  }

  indexCollection(statement, 'referrals.focus', db.referrals?.focus ? [db.referrals.focus] : []);
  for (const collection of SINGLETON_COLLECTIONS) {
    indexCollection(statement, collection, db[collection] ? [db[collection]] : []);
  }
}

function indexAuditEvents(database, events) {
  const statement = database.prepare(`
    INSERT OR IGNORE INTO audit_events (
      id, actor_user_id, patient_id, action, resource_type, resource_id, created_at, data_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const event of Array.isArray(events) ? events : []) {
    const id = recordId(event, `audit-${event.timestamp || event.createdAt || Date.now()}`);
    statement.run(
      id,
      event.actorUserId || '',
      event.patientId || '',
      event.action || 'audit event',
      event.resourceType || event.targetType || '',
      event.resourceId || event.targetId || '',
      event.timestamp || event.createdAt || new Date().toISOString(),
      JSON.stringify({ ...event, id }),
    );
  }
}

function hydrateIndexedDatabase(database, globalState) {
  const db = structuredClone(globalState || {});
  db.users = readJsonRows(database, 'users');
  db.sessions = readJsonRows(database, 'sessions');
  db.patientProfiles = readJsonRows(database, 'patient_profiles');

  const accessControl = database.prepare('SELECT data_json FROM access_control WHERE key = ?').get('current');
  if (accessControl) db.accessControl = JSON.parse(accessControl.data_json);

  for (const collection of TOP_LEVEL_COLLECTIONS) {
    db[collection] = readDomainCollection(database, collection);
  }

  for (const [collection] of NESTED_COLLECTIONS) {
    setNestedCollection(db, collection, readDomainCollection(database, collection));
  }

  for (const collection of SINGLETON_COLLECTIONS) {
    const [record] = readDomainCollection(database, collection);
    if (record) db[collection] = record;
  }

  const focusRows = readDomainCollection(database, 'referrals.focus');
  db.referrals ||= {};
  db.referrals.focus = focusRows[0] || db.referrals.focus || null;

  db.auditLog = database.prepare(`
    SELECT data_json FROM audit_events ORDER BY created_at DESC LIMIT 1000
  `).all().reverse().map((row) => JSON.parse(row.data_json));

  return db;
}

function readJsonRows(database, table) {
  return database.prepare(`SELECT data_json FROM ${table} ORDER BY rowid`).all()
    .map((row) => JSON.parse(row.data_json));
}

function readDomainCollection(database, collection) {
  return database.prepare(`
    SELECT data_json FROM domain_records WHERE collection = ? ORDER BY rowid
  `).all(collection).map((row) => JSON.parse(row.data_json));
}

function setNestedCollection(target, dottedPath, value) {
  const parts = dottedPath.split('.');
  let current = target;
  for (const part of parts.slice(0, -1)) {
    current[part] ||= {};
    current = current[part];
  }
  current[parts.at(-1)] = value;
}

function buildGlobalState(db) {
  const globalState = structuredClone(db);
  for (const collection of TOP_LEVEL_COLLECTIONS) delete globalState[collection];
  delete globalState.users;
  delete globalState.sessions;
  delete globalState.patientProfiles;
  delete globalState.auditLog;
  delete globalState.accessControl;

  for (const [collection] of NESTED_COLLECTIONS) {
    setNestedCollection(globalState, collection, []);
  }
  for (const collection of SINGLETON_COLLECTIONS) delete globalState[collection];
  if (globalState.referrals) globalState.referrals.focus = null;
  return globalState;
}

function indexCollection(statement, collection, records) {
  if (!Array.isArray(records)) return;
  records.forEach((record, index) => {
    if (!record || typeof record !== 'object') return;
    const id = domainRecordId(record, collection, index);
    statement.run(
      collection,
      id,
      record.patientId || '',
      record.userId || '',
      record.createdByUserId || '',
      record.status || '',
      record.date || record.preferredDate || record.dueDate || record.recordedAt || '',
      record.relatedId || record.conversationId || record.invoiceId || record.prescriptionId || record.requestId || '',
      Number.isInteger(record.version) && record.version > 0 ? record.version : 1,
      record.provenance || '',
      record.verificationStatus || '',
      record.createdAt || record.uploadedAt || record.invitedAt || null,
      record.updatedAt || null,
      deletedAt(record),
      JSON.stringify(record),
    );
  });
}

function normalizeDb(db) {
  const accessControl = normalizeAccessControl(db.accessControl);
  const normalized = {
    ...structuredClone(seedData),
    ...db,
    accessControl,
    users: normalizeUsers(Array.isArray(db.users) ? db.users : [], accessControl),
    sessions: Array.isArray(db.sessions) ? db.sessions : [],
    tasks: Array.isArray(db.tasks) ? db.tasks : [],
    providers: Array.isArray(db.providers) ? db.providers : seedData.providers,
    appointmentSlots: Array.isArray(db.appointmentSlots) ? db.appointmentSlots : seedData.appointmentSlots,
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
    labResults: Array.isArray(db.labResults) ? db.labResults : seedData.labResults,
    clinicalNotes: Array.isArray(db.clinicalNotes) ? db.clinicalNotes : seedData.clinicalNotes,
    immunizations: Array.isArray(db.immunizations) ? db.immunizations : seedData.immunizations,
    immunizationRecords: mergeSeedShape(seedData.immunizationRecords, db.immunizationRecords),
    educationalResources: mergeSeedShape(seedData.educationalResources, db.educationalResources),
    referrals: mergeSeedShape(seedData.referrals, db.referrals),
    familyAccess: mergeSeedShape(seedData.familyAccess, db.familyAccess),
    healthTrends: mergeSeedShape(seedData.healthTrends, db.healthTrends),
    messages: Array.isArray(db.messages) ? db.messages : seedData.messages,
    messageConversations: Array.isArray(db.messageConversations) ? db.messageConversations : seedData.messageConversations,
    documents: Array.isArray(db.documents) ? db.documents : seedData.documents,
    uploadedFiles: Array.isArray(db.uploadedFiles) ? db.uploadedFiles : seedData.uploadedFiles,
    activityLog: Array.isArray(db.activityLog) ? db.activityLog : seedData.activityLog,
    resourceInteractions: Array.isArray(db.resourceInteractions) ? db.resourceInteractions : seedData.resourceInteractions,
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
      paymentSessions: Array.isArray(db.billing?.paymentSessions) ? db.billing.paymentSessions : [],
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

  return normalizePatientData(normalized);
}

function mergeSeedShape(seedValue, currentValue) {
  if (Array.isArray(seedValue)) {
    return Array.isArray(currentValue) ? currentValue : structuredClone(seedValue);
  }

  if (!isPlainObject(seedValue)) {
    return currentValue ?? seedValue;
  }

  if (!isPlainObject(currentValue)) {
    return structuredClone(seedValue);
  }

  const merged = {
    ...structuredClone(seedValue),
    ...currentValue,
  };

  for (const key of Object.keys(seedValue)) {
    merged[key] = mergeSeedShape(seedValue[key], currentValue[key]);
  }

  return merged;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function shouldUseExistingAppointments(appointments) {
  return Array.isArray(appointments);
}

function recordId(record, fallback = '') {
  return String(record.id || record.token || record.patientId || record.email || fallback || 'record').trim();
}

function domainRecordId(record, collection, index) {
  const fallback = `${collection}-${index}`;
  const baseId = String(record.id || record.token || record.email || fallback).trim();
  const ownerId = String(record.patientId || record.userId || record.createdByUserId || '').trim();
  return ownerId ? `${ownerId}:${baseId}` : baseId;
}

function deletedAt(record) {
  return record.deletedAt || record.deleted_at || null;
}
