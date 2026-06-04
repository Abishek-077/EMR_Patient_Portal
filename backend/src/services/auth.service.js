import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { conflict, unauthorized } from '../errors.js';
import { env } from '../config.js';
import { readDb, updateDb } from '../store.js';

export async function registerPatient(input) {
  const normalizedEmail = input.email.toLowerCase();
  const normalizedPatientId = input.patientId.trim();

  const result = await updateDb((db) => {
    db.users ||= [];
    db.sessions ||= [];

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
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
      createdAt: new Date().toISOString(),
    };
    const session = createSession(user.id);

    db.users.push(user);
    db.sessions.push(session);
    return { session, user };
  });

  if (!result) throw conflict('An account with this email or patient ID already exists');
  return toAuthResponse(result.user, result.session);
}

export async function loginPatient(input) {
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

    const session = createSession(user.id);
    db.sessions.push(session);
    return { session, user };
  });

  if (!result) throw unauthorized('Incorrect username, email, or password');
  return toAuthResponse(result.user, result.session);
}

export async function findSessionUser(token) {
  const db = await readDb();
  db.sessions ||= [];
  db.users ||= [];

  const session = activeSessions(db.sessions).find((item) => item.token === token);
  if (!session) return null;

  const user = db.users.find((item) => item.id === session.userId);
  if (!user) return null;

  return {
    session: toPublicSession(session),
    user,
  };
}

export async function logoutPatient(token) {
  await updateDb((db) => {
    db.sessions ||= [];
    db.sessions = db.sessions.filter((session) => session.token !== token);
  });
}

export function toPublicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    patientId: user.patientId || '',
  };
}

function toAuthResponse(user, session) {
  return {
    token: session.token,
    user: toPublicUser(user),
  };
}

function createSession(userId) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + env.sessionTtlHours * 60 * 60 * 1000);

  return {
    token: randomUUID(),
    userId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

function activeSessions(sessions) {
  const now = Date.now();
  return sessions.filter((session) => !session.expiresAt || Date.parse(session.expiresAt) > now);
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString('hex'),
  };
}

function passwordMatches(password, user) {
  const expected = Buffer.from(user.passwordHash || '', 'hex');
  const actual = scryptSync(password, user.passwordSalt || '', 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function toPublicSession(session) {
  return {
    createdAt: session.createdAt,
    expiresAt: session.expiresAt || null,
  };
}

