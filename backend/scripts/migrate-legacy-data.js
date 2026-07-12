import { access, copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const legacyPath = path.resolve(process.env.LEGACY_DB_PATH || path.join(rootDir, 'data', 'db.json'));

try {
  await access(legacyPath);
} catch {
  console.log(`No legacy data found at ${legacyPath}; nothing to migrate.`);
  process.exit(0);
}

const legacy = JSON.parse(await readFile(legacyPath, 'utf8'));
assertLegacyShape(legacy);
const { ensurePatientProfile, getPatientId } = await import('../src/domain/patient-scope.js');
assignLegacyOwnership(legacy, { ensurePatientProfile, getPatientId });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(
  path.dirname(legacyPath),
  `${path.basename(legacyPath, path.extname(legacyPath))}.migrated-backup-${stamp}.json`,
);
await copyFile(legacyPath, backupPath);

// Sessions are intentionally invalidated during the persistence migration.
legacy.sessions = [];
legacy.migrationMetadata = {
  source: legacyPath,
  migratedAt: new Date().toISOString(),
  sessionsRevoked: true,
};

const { seedData } = await import('../src/seed-data.js');
// Provider and availability catalogs are operational configuration, not patient history.
legacy.providers = structuredClone(seedData.providers);
legacy.appointmentSlots = structuredClone(seedData.appointmentSlots);

const { getDbPath, resetDb } = await import('../src/store.js');
await resetDb(legacy);

console.log(`Legacy data migrated to ${getDbPath()}`);
console.log(`Legacy backup written to ${backupPath}`);
console.log('All legacy sessions were revoked; users must sign in again.');

function assertLegacyShape(database) {
  if (!database || typeof database !== 'object' || Array.isArray(database)) {
    throw new Error('Legacy data must contain a JSON object');
  }

  const users = Array.isArray(database.users) ? database.users : [];
  assertUnique(users.map((user) => String(user.email || '').trim().toLowerCase()).filter(Boolean), 'email');
  assertUnique(users.map((user) => String(user.patientId || '').trim().toLowerCase()).filter(Boolean), 'patient ID');

  for (const user of users) {
    if (!user.id || !user.email) {
      throw new Error('Each legacy user must have an id and email before migration');
    }
  }
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Legacy data contains a duplicate user ${label}: ${value}`);
    seen.add(value);
  }
}

function assignLegacyOwnership(database, { ensurePatientProfile, getPatientId }) {
  const patients = (database.users || []).filter((user) => {
    const roles = Array.isArray(user.roles) ? user.roles : [user.role || 'patient'];
    return roles.includes('patient') && !user.deletedAt;
  });
  const identities = patients.map((user) => {
    const patientUuid = getPatientId(user);
    user.patientUuid = patientUuid;
    return {
      user,
      patientUuid,
      identifiers: new Set([user.id, user.patientId, patientUuid].map((value) => String(value || '').trim()).filter(Boolean)),
    };
  });

  const resolveOwner = (record, location) => {
    const explicitUserId = String(record.userId || '').trim();
    const explicitPatientId = String(record.patientId || '').trim();
    const matches = identities.filter(({ user, identifiers }) => (
      (!explicitUserId || user.id === explicitUserId)
      && (!explicitPatientId || identifiers.has(explicitPatientId))
    ));
    const hasExplicitOwner = Boolean(explicitUserId || explicitPatientId);
    const candidates = hasExplicitOwner ? matches : identities;
    if (candidates.length !== 1) {
      throw new Error(`Ambiguous legacy ownership at ${location}; expected exactly one patient owner, found ${candidates.length}`);
    }
    record.userId = candidates[0].user.id;
    record.patientId = candidates[0].patientUuid;
    record.createdByUserId ||= candidates[0].user.id;
    return candidates[0].user;
  };

  const ownedCollections = [
    'tasks',
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
  ];
  for (const collection of ownedCollections) {
    for (const [index, record] of (database[collection] || []).entries()) {
      if (record && typeof record === 'object') resolveOwner(record, `${collection}[${index}]`);
    }
  }

  const nestedCollections = [
    ['billing', ['paymentMethods', 'invoices', 'payments', 'statements', 'paymentSessions']],
    ['immunizationRecords', ['alerts', 'completed']],
    ['referrals', ['rows']],
    ['familyAccess', ['proxies', 'accounts', 'activity', 'reports']],
    ['healthTrends', ['metrics', 'labComparison', 'goals']],
  ];
  for (const [parent, collections] of nestedCollections) {
    for (const collection of collections) {
      for (const [index, record] of (database[parent]?.[collection] || []).entries()) {
        if (record && typeof record === 'object') resolveOwner(record, `${parent}.${collection}[${index}]`);
      }
    }
  }

  if (database.referrals?.focus && typeof database.referrals.focus === 'object') {
    resolveOwner(database.referrals.focus, 'referrals.focus');
  }

  for (const [index, profile] of (database.patientProfiles || []).entries()) {
    if (profile && typeof profile === 'object') resolveOwner(profile, `patientProfiles[${index}]`);
  }

  if (identities.length === 1) {
    const owner = identities[0].user;
    const profile = ensurePatientProfile(database, owner, { forceUserFields: true });
    for (const key of ['patient', 'profileSettings', 'accountStatus', 'insuranceDetails', 'preferences', 'preferredPharmacy']) {
      if (database[key] && typeof database[key] === 'object' && !Array.isArray(database[key])) {
        profile[key] = structuredClone(database[key]);
      }
    }
    profile.userId = owner.id;
    profile.patientId = identities[0].patientUuid;
  } else if (identities.length > 1 && hasLegacyGlobalPatientProfile(database)) {
    throw new Error('Ambiguous legacy global patient profile; migrate it into an explicitly owned patientProfiles record first');
  }
}

function hasLegacyGlobalPatientProfile(database) {
  return ['patient', 'profileSettings', 'accountStatus', 'insuranceDetails', 'preferences', 'preferredPharmacy']
    .some((key) => database[key] && typeof database[key] === 'object' && Object.values(database[key]).some((value) => value !== '' && value !== null && value !== false && value !== 0));
}
