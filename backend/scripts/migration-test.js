import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const execute = promisify(execFile);
const tempDir = await mkdtemp(path.join(tmpdir(), 'emr-migration-'));
const migrationScript = path.resolve('backend/scripts/migrate-legacy-data.js');

try {
  const legacyPath = path.join(tempDir, 'legacy.json');
  const databasePath = path.join(tempDir, 'migrated.sqlite');
  await writeFile(legacyPath, JSON.stringify(singlePatientLegacy()), 'utf8');
  await execute(process.execPath, [migrationScript], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SESSION_SECRET: 'migration-test-secret',
      LEGACY_DB_PATH: legacyPath,
      EMR_DB_PATH: databasePath,
      EMR_UPLOAD_DIR: path.join(tempDir, 'uploads'),
    },
  });

  const sqlite = new DatabaseSync(databasePath, { readOnly: true });
  assert(sqlite.prepare('SELECT COUNT(*) AS count FROM sessions').get().count === 0, 'legacy sessions must be revoked');
  const user = JSON.parse(sqlite.prepare('SELECT data_json FROM users WHERE id = ?').get('legacy-user')?.data_json || '{}');
  assert(user.patientUuid, 'migration must create a canonical internal patient UUID');
  const lab = sqlite.prepare("SELECT patient_id, user_id, data_json FROM domain_records WHERE collection = 'labResults' AND json_extract(data_json, '$.id') = 'legacy-lab'").get();
  assert(lab?.patient_id === user.patientUuid && lab?.user_id === user.id, `unowned single-patient legacy records must receive the unambiguous owner: ${JSON.stringify({ lab, user })}`);
  assert(JSON.parse(lab.data_json).label === 'Durable legacy lab', 'durable clinical data must survive migration');
  const appState = sqlite.prepare("SELECT data_json FROM app_state WHERE key = 'current'").get().data_json;
  assert(!appState.includes('legacy@example.test'), 'indexed users must not remain in app_state');
  sqlite.close();
  const backups = (await readdir(tempDir)).filter((name) => name.startsWith('legacy.migrated-backup-') && name.endsWith('.json'));
  assert(backups.length === 1, 'migration must create exactly one timestamped JSON backup');

  const ambiguousPath = path.join(tempDir, 'ambiguous.json');
  await writeFile(ambiguousPath, JSON.stringify(ambiguousLegacy()), 'utf8');
  const ambiguousResult = await runExpectingFailure(ambiguousPath, path.join(tempDir, 'ambiguous.sqlite'));
  assert(ambiguousResult.includes('Ambiguous legacy ownership'), 'ambiguous patient ownership must stop migration');

  const duplicatePath = path.join(tempDir, 'duplicate.json');
  await writeFile(duplicatePath, JSON.stringify(duplicateEmailLegacy()), 'utf8');
  const duplicateResult = await runExpectingFailure(duplicatePath, path.join(tempDir, 'duplicate.sqlite'));
  assert(duplicateResult.includes('duplicate user email'), 'duplicate account identities must stop migration');

  console.log('Legacy migration test passed');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

async function runExpectingFailure(legacyPath, databasePath) {
  try {
    await execute(process.execPath, [migrationScript], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        SESSION_SECRET: 'migration-test-secret',
        LEGACY_DB_PATH: legacyPath,
        EMR_DB_PATH: databasePath,
      },
    });
  } catch (error) {
    return `${error.stdout || ''}\n${error.stderr || ''}`;
  }
  throw new Error('Migration unexpectedly accepted an invalid legacy fixture');
}

function singlePatientLegacy() {
  return {
    users: [{ id: 'legacy-user', fullName: 'Legacy Patient', email: 'legacy@example.test', patientId: 'LEGACY-100', roles: ['patient'], status: 'Active' }],
    sessions: [{ token: 'raw-legacy-session', userId: 'legacy-user', createdAt: '2025-01-01T00:00:00.000Z' }],
    patient: { name: 'Legacy Patient', identifier: 'Health ID: LEGACY-100' },
    profileSettings: { fullName: 'Legacy Patient', email: 'legacy@example.test', dateOfBirth: '1980-01-01' },
    labResults: [{ id: 'legacy-lab', label: 'Durable legacy lab', value: '42', unit: 'mg/dL', createdAt: '2025-01-01T00:00:00.000Z' }],
    clinicalNotes: [{ id: 'legacy-note', title: 'Durable note', text: 'Migrated', createdAt: '2025-01-02T00:00:00.000Z' }],
    billing: { invoices: [{ id: 'legacy-invoice', description: 'Legacy invoice', amount: 10, status: 'Pending' }] },
  };
}

function ambiguousLegacy() {
  return {
    users: [
      { id: 'patient-one', email: 'one@example.test', patientId: '', roles: ['patient'], status: 'Active' },
      { id: 'patient-two', email: 'two@example.test', patientId: '', roles: ['patient'], status: 'Active' },
    ],
    sessions: [],
    labResults: [{ id: 'ambiguous-lab', label: 'No owner' }],
  };
}

function duplicateEmailLegacy() {
  return {
    users: [
      { id: 'patient-one', email: 'duplicate@example.test', roles: ['patient'] },
      { id: 'patient-two', email: 'duplicate@example.test', roles: ['patient'] },
    ],
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
