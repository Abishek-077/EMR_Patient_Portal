import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { badRequest, conflict, forbidden, unauthorized } from '../../errors.js';
import { env } from '../../config.js';
import { readDb, updateDb } from '../../store.js';
import { hasPermission, resolveUserAccess } from '../../domain/access-control.js';
import { appendAuditLog, ensurePatientProfile, getPatientId } from '../../domain/patient-scope.js';
import { notificationGateway } from '../../providers/index.js';

export async function registerPatient(input, { rememberMe = false } = {}) {
  const normalizedEmail = input.email.toLowerCase();
  const normalizedPatientId = input.patientId.trim();

  const result = await updateDb((db) => {
    db.users ||= [];
    db.sessions ||= [];
    db.sessions = activeSessions(db.sessions);

    const userExists = db.users.some((user) => {
      const sameEmail = String(user.email).toLowerCase() === normalizedEmail;
      const samePatientId =
        normalizedPatientId && String(user.patientId || '').toLowerCase() === normalizedPatientId.toLowerCase();
      return sameEmail || samePatientId;
    });

    if (userExists) return null;

    const credentials = hashPassword(input.password);
    const user = {
      id: `user-${randomUUID()}`,
      fullName: input.fullName,
      email: normalizedEmail,
      dateOfBirth: input.dateOfBirth,
      patientId: normalizedPatientId,
      roles: ['patient'],
      status: 'Active',
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
      createdAt: new Date().toISOString(),
    };
    const createdSession = createSession(user.id, { rememberMe });

    db.users.push(user);
    ensurePatientProfile(db, user, { forceUserFields: true });
    db.sessions.push(createdSession.record);
    trimUserSessions(db, user.id);
    appendAuditLog(db, user, 'signup', 'auth', user.id);
    const access = resolveUserAccess(user, db.accessControl);
    const patientContexts = buildPatientContexts(db, user, access);
    return { session: createdSession.record, token: createdSession.token, user, accessControl: db.accessControl, patientContexts };
  });

  if (!result) throw conflict('An account with this email or patient ID already exists');
  return toAuthResponse(result.user, result.token, result.session, result.accessControl, result.patientContexts);
}

export async function loginPatient(input, { rememberMe = false } = {}) {
  const identity = input.usernameOrEmail.toLowerCase();
  const result = await updateDb((db) => {
    db.users ||= [];
    db.sessions ||= [];
    db.sessions = activeSessions(db.sessions);

    const user = db.users.find(
      (item) =>
        String(item.email).toLowerCase() === identity ||
        String(item.patientId || '').toLowerCase() === identity,
    );
    if (!user || !passwordMatches(input.password, user)) return null;
    const access = resolveUserAccess(user, db.accessControl);
    if (access.status === 'Suspended') return null;

    const createdSession = createSession(user.id, { rememberMe });
    db.sessions.push(createdSession.record);
    trimUserSessions(db, user.id);
    user.lastLoginAt = new Date().toISOString();
    appendAuditLog(db, user, 'login success', 'auth', user.id);
    const patientContexts = buildPatientContexts(db, user, access);
    return { session: createdSession.record, token: createdSession.token, user, accessControl: db.accessControl, patientContexts };
  });

  if (!result) throw unauthorized('Incorrect username, email, or password');
  return toAuthResponse(result.user, result.token, result.session, result.accessControl, result.patientContexts);
}

export async function findSessionUser(token, requestedPatientContext = '') {
  const db = await readDb();
  db.sessions ||= [];
  db.users ||= [];

  const tokenHash = hashSessionToken(token);
  const session = activeSessions(db.sessions).find((item) => safeHashMatches(item.tokenHash, tokenHash));
  if (!session) return null;

  const actor = db.users.find((item) => item.id === session.userId && !item.deletedAt);
  if (!actor) return null;
  const access = resolveUserAccess(actor, db.accessControl);
  if (access.status === 'Suspended') return null;
  const contexts = buildPatientContexts(db, actor, access);
  const selected = selectPatientContext(contexts, requestedPatientContext);
  const subject = selected?.user || actor;
  const subjectUser = subject.id === actor.id
    ? actor
    : {
      ...subject,
      actorUserId: actor.id,
      subjectPatientId: selected?.id || '',
    };

  return {
    session: toPublicSession(session),
    actor,
    user: subjectUser,
    subjectUser,
    access,
    patientContexts: contexts.map(toPublicPatientContext),
    currentPatientContext: selected ? toPublicPatientContext(selected) : null,
    csrfToken: createCsrfToken(token),
  };
}

export async function logoutPatient(token) {
  await updateDb((db) => {
    db.sessions ||= [];
    const tokenHash = hashSessionToken(token);
    const session = db.sessions.find((item) => safeHashMatches(item.tokenHash, tokenHash));
    const user = session ? db.users?.find((item) => item.id === session.userId) : null;
    if (user) appendAuditLog(db, user, 'logout', 'auth', user.id);
    db.sessions = db.sessions.filter((item) => !safeHashMatches(item.tokenHash, tokenHash));
  });
}

export async function changePassword(actor, sessionId, { currentPassword, newPassword }) {
  assertStrongPassword(newPassword);
  const result = await updateDb((db) => {
    const user = (db.users || []).find((item) => item.id === actor.id && !item.deletedAt);
    if (!user || !passwordMatches(currentPassword, user)) return null;
    if (passwordMatches(newPassword, user)) throw badRequest('The new password must be different from the current password');

    const credentials = hashPassword(newPassword);
    user.passwordHash = credentials.hash;
    user.passwordSalt = credentials.salt;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date().toISOString();
    db.sessions = (db.sessions || []).filter((session) => session.userId !== user.id || session.id === sessionId);
    appendAuditLog(db, user, 'password changed', 'auth', user.id);
    return { changed: true, mustChangePassword: false };
  });

  if (!result) throw unauthorized('Current password is incorrect');
  return result;
}

export async function requestPasswordReset(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  await updateDb(async (db) => {
    const now = Date.now();
    db.passwordResetTokens = (db.passwordResetTokens || []).filter((item) => (
      !item.usedAt && Date.parse(item.expiresAt || '') > now
    ));
    const user = (db.users || []).find((item) => (
      String(item.email || '').trim().toLowerCase() === normalizedEmail
      && item.status !== 'Suspended'
      && !item.deletedAt
    ));
    if (!user) return;

    const token = randomBytes(32).toString('base64url');
    const reset = {
      id: `password-reset-${randomUUID()}`,
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(now + env.passwordResetTtlMinutes * 60_000).toISOString(),
      createdAt: new Date(now).toISOString(),
    };
    db.passwordResetTokens.push(reset);
    const appBaseUrl = String(process.env.APP_BASE_URL || `http://${env.host}:${env.port}`).replace(/\/$/, '');
    const notification = await notificationGateway.deliver({
      channel: 'local-outbox',
      recipient: user.email,
      template: 'password-reset',
      subject: 'Patient portal password reset',
      body: `Use this one-time local reset link before ${reset.expiresAt}: ${appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`,
      metadata: { userId: user.id, resetTokenId: reset.id, expiresAt: reset.expiresAt },
    });
    db.notificationOutbox ||= [];
    db.notificationOutbox.push(notification);
    appendAuditLog(db, user, 'password reset requested', 'auth', user.id);
  });

  return { accepted: true };
}

export async function confirmPasswordReset(token, newPassword) {
  assertStrongPassword(newPassword);
  const tokenHash = hashResetToken(token);
  const result = await updateDb((db) => {
    const now = Date.now();
    const reset = (db.passwordResetTokens || []).find((item) => (
      !item.usedAt
      && Date.parse(item.expiresAt || '') > now
      && safeHashMatches(item.tokenHash, tokenHash)
    ));
    if (!reset) return null;
    const user = (db.users || []).find((item) => item.id === reset.userId && !item.deletedAt && item.status !== 'Suspended');
    if (!user) return null;

    const credentials = hashPassword(newPassword);
    user.passwordHash = credentials.hash;
    user.passwordSalt = credentials.salt;
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date().toISOString();
    reset.usedAt = user.passwordChangedAt;
    db.sessions = (db.sessions || []).filter((session) => session.userId !== user.id);
    appendAuditLog(db, user, 'password reset completed', 'auth', user.id);
    return { changed: true };
  });

  if (!result) throw badRequest('The password reset token is invalid or expired');
  return result;
}

export async function createDevelopmentAdmin(input) {
  const normalizedEmail = input.email.toLowerCase();
  return updateDb((db) => {
    db.users ||= [];
    db.sessions ||= [];
    const existing = db.users.find((user) => String(user.email).toLowerCase() === normalizedEmail);
    const credentials = hashPassword(input.password);
    const user = existing || {
      id: `user-${randomUUID()}`,
      email: normalizedEmail,
      patientId: input.patientId || `ADMIN-${randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
    };

    user.fullName = input.fullName;
    user.dateOfBirth = input.dateOfBirth || user.dateOfBirth || '1970-01-01';
    user.roles = ['admin'];
    user.status = 'Active';
    user.passwordHash = credentials.hash;
    user.passwordSalt = credentials.salt;

    if (!existing) db.users.push(user);
    appendAuditLog(db, user, 'development admin seeded', 'auth', user.id);
    return toPublicUser(user, resolveUserAccess(user, db.accessControl));
  });
}

export function toPublicUser(user, access = resolveUserAccess(user)) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    patientId: user.patientId || '',
    roles: access.roles,
    roleLabels: access.roleLabels,
    permissions: access.permissions,
    status: access.status,
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

export function createCsrfToken(token) {
  return createHmac('sha256', env.sessionSecret).update(String(token || '')).digest('base64url');
}

export function verifyCsrfToken(token, candidate) {
  const expected = Buffer.from(createCsrfToken(token));
  const actual = Buffer.from(String(candidate || ''));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function toAuthResponse(user, token, session, accessControl, patientContexts = []) {
  const access = resolveUserAccess(user, accessControl);
  const contexts = patientContexts.length ? patientContexts : (access.roles.includes('patient') ? [selfPatientContext(user)] : []);
  const context = selectPatientContext(contexts, '');
  return {
    token,
    user: toPublicUser(user, access),
    session: toPublicSession(session),
    access: publicAccess(access),
    csrfToken: createCsrfToken(token),
    patientContexts: contexts.map(toPublicPatientContext),
    currentPatientContext: context ? toPublicPatientContext(context) : null,
  };
}

function createSession(userId, { rememberMe = false } = {}) {
  const createdAt = new Date();
  const ttlHours = rememberMe ? env.rememberSessionTtlHours : env.sessionTtlHours;
  const expiresAt = new Date(createdAt.getTime() + ttlHours * 60 * 60 * 1000);
  const token = randomBytes(32).toString('base64url');

  return {
    token,
    record: {
      id: `session-${randomUUID()}`,
      tokenHash: hashSessionToken(token),
      userId,
      rememberMe: Boolean(rememberMe),
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
  };
}

function activeSessions(sessions) {
  const now = Date.now();
  return sessions.filter((session) => (
    Boolean(session.tokenHash)
    && !session.deletedAt
    && (!session.expiresAt || Date.parse(session.expiresAt) > now)
  ));
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString('hex'),
  };
}

function passwordMatches(password, user) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const expected = Buffer.from(user.passwordHash || '', 'hex');
  const actual = scryptSync(password, user.passwordSalt || '', 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function toPublicSession(session) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt || null,
    rememberMe: Boolean(session.rememberMe),
  };
}

function hashSessionToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex');
}

function hashResetToken(token) {
  return createHash('sha256').update(`password-reset:${String(token || '')}`).digest('hex');
}

function safeHashMatches(left, right) {
  const expected = Buffer.from(String(left || ''));
  const actual = Buffer.from(String(right || ''));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function trimUserSessions(db, userId) {
  const sessions = (db.sessions || [])
    .filter((session) => session.userId === userId)
    .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0));
  const keep = new Set(sessions.slice(0, env.maxSessionsPerUser).map((session) => session.id));
  db.sessions = (db.sessions || []).filter((session) => session.userId !== userId || keep.has(session.id));
}

function buildPatientContexts(db, actor, access) {
  const contexts = [];
  const seen = new Set();
  const add = (context) => {
    if (!context?.id || seen.has(context.id)) return;
    seen.add(context.id);
    contexts.push(context);
  };

  if (access.roles.includes('patient')) add(selfPatientContext(actor));

  if (hasPermission(access, 'patients.context.select')) {
    for (const user of db.users || []) {
      if (user.id === actor.id || user.deletedAt || user.status === 'Suspended') continue;
      const roles = Array.isArray(user.roles) ? user.roles : [user.role].filter(Boolean);
      if (!roles.includes('patient')) continue;
      add(patientContext(user, 'staff', 'Staff-authorized patient'));
    }
  }

  const normalizedActorEmail = String(actor.email || '').trim().toLowerCase();
  for (const grant of db.accessGrants || []) {
    const active = String(grant.status || '').trim().toLowerCase() === 'active'
      && !grant.revokedAt
      && !grant.deletedAt;
    const notExpired = !grant.expiresAt || Date.parse(grant.expiresAt) > Date.now();
    const matchesActor = grant.granteeUserId === actor.id
      || (normalizedActorEmail && String(grant.granteeEmail || '').trim().toLowerCase() === normalizedActorEmail);
    if (!active || !notExpired || !matchesActor || grant.type !== 'proxy') continue;
    const subject = (db.users || []).find((user) => getPatientId(user) === grant.subjectPatientId && !user.deletedAt);
    if (subject) add(patientContext(subject, 'proxy', 'Accepted proxy access'));
  }

  for (const grant of db.familyAccess?.proxies || []) {
    const status = String(grant.status || '').trim().toLowerCase();
    const accepted = ['accepted', 'active'].includes(status) && !grant.revokedAt && !grant.deletedAt;
    const notExpired = !grant.expiresAt || Date.parse(grant.expiresAt) > Date.now();
    const matchesActor = grant.proxyUserId === actor.id
      || grant.acceptedByUserId === actor.id
      || (normalizedActorEmail && String(grant.proxyEmail || grant.email || '').trim().toLowerCase() === normalizedActorEmail);
    if (!accepted || !notExpired || !matchesActor) continue;
    const subject = (db.users || []).find((user) => getPatientId(user) === grant.patientId && !user.deletedAt);
    if (subject) add(patientContext(subject, 'proxy', grant.relationship || 'Accepted proxy access'));
  }

  return contexts;
}

function selectPatientContext(contexts, requestedPatientContext) {
  const requested = String(requestedPatientContext || '').trim();
  if (!requested) return contexts.find((context) => context.type === 'self') || contexts[0] || null;
  const selected = contexts.find((context) => context.id === requested);
  if (!selected) throw forbidden('The requested patient context is not authorized');
  return selected;
}

function selfPatientContext(user) {
  return patientContext(user, 'self', 'My account');
}

function patientContext(user, type, relationship) {
  return {
    id: getPatientId(user),
    userId: user.id,
    label: user.fullName || user.email || 'Patient',
    medicalRecordNumber: user.patientId || '',
    type,
    relationship,
    user,
  };
}

function toPublicPatientContext(context) {
  return {
    id: context.id,
    label: context.label,
    medicalRecordNumber: context.medicalRecordNumber,
    type: context.type,
    relationship: context.relationship,
  };
}

function publicAccess(access) {
  return {
    roles: access.roles,
    roleLabels: access.roleLabels,
    permissions: access.permissions,
    status: access.status,
  };
}

function assertStrongPassword(password) {
  const normalized = String(password || '');
  const failures = [];
  if (normalized.length < 8) failures.push('at least 8 characters');
  if (!/[A-Z]/.test(normalized)) failures.push('one uppercase letter');
  if (!/\d/.test(normalized)) failures.push('one number');
  if (!/[^A-Za-z0-9]/.test(normalized)) failures.push('one special character');
  if (failures.length) throw badRequest('Password does not meet the security requirements', { requirements: failures });
}
