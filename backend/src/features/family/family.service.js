import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { conflict, notFound } from '../../errors.js';
import { appendAuditLog, findOwned, scopeDbToPatient, stampPatientOwnership, updatePatientProfile } from '../../domain/patient-scope.js';
import { notificationGateway } from '../../providers/index.js';
import { readDb, updateDb } from '../../store.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export async function getFamilyAccess(user) {
  const db = scopeDbToPatient(await readDb(), user);
  return {
    familyAccess: {
      proxies: (db.familyAccess?.proxies || []).map(publicProxy),
      accounts: (db.familyAccess?.accounts || []).map(publicDependent),
      activity: (db.familyAccess?.activity || []).map(publicActivity),
      reports: (db.familyAccess?.reports || []).map(publicReport),
    },
    preferences: { shareRecords: Boolean(db.preferences?.shareRecords), mentalHealthNotes: Boolean(db.preferences?.mentalHealthNotes) },
  };
}

export async function inviteProxy(user, input) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const now = new Date();
  const delivery = await notificationGateway.deliver({
    channel: 'email',
    recipient: input.email,
    template: 'proxy-invitation',
    subject: 'Patient portal proxy invitation',
    body: `${input.name}, you were invited to access a patient portal. This invitation expires in 7 days.`,
    metadata: { acceptanceUrl: acceptanceUrl(token), expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString() },
  });

  return updateDb((db) => {
    db.familyAccess ||= {};
    db.familyAccess.proxies ||= [];
    const duplicate = findOwned(db.familyAccess.proxies, user, (item) => item.proxyEmail?.toLowerCase() === input.email && !['revoked', 'expired'].includes(String(item.status).toLowerCase()));
    if (duplicate) throw conflict('This email already has an active or pending proxy invitation');
    const proxy = stampPatientOwnership({
      id: `proxy-${randomUUID()}`,
      name: input.name,
      relationship: input.relationship,
      permissions: input.permissions,
      proxyEmail: input.email,
      status: 'Invitation Pending',
      invitationTokenHash: tokenHash,
      invitationExpiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
      invitedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdByUserId: user.id,
    }, user);
    db.familyAccess.proxies.push(proxy);
    enqueueNotification(db, delivery, proxy);
    appendActivity(db, user, 'Proxy invited', `${proxy.name} - invitation queued for ${proxy.proxyEmail}`);
    appendAuditLog(db, user, 'proxy invited', 'proxyAccess', proxy.id, { deliveryId: delivery.id });
    return publicProxy(proxy);
  });
}

export async function acceptProxyInvitation(input) {
  const tokenHash = hashToken(input.token);
  const accepted = await updateDb((db) => {
    const proxy = (db.familyAccess?.proxies || []).find((item) => item.invitationTokenHash === tokenHash && !item.deletedAt);
    if (!proxy) return null;
    if (proxy.status === 'Active') return { proxy: publicProxy(proxy), grant: publicGrant((db.accessGrants || []).find((item) => item.proxyId === proxy.id)) };
    if (proxy.status !== 'Invitation Pending') throw conflict(`This invitation is ${String(proxy.status).toLowerCase()}`);
    if (Date.parse(proxy.invitationExpiresAt) <= Date.now()) {
      proxy.status = 'Expired';
      proxy.updatedAt = new Date().toISOString();
      throw conflict('This proxy invitation has expired');
    }

    const now = new Date().toISOString();
    const grantee = (db.users || []).find((item) => String(item.email || '').toLowerCase() === proxy.proxyEmail.toLowerCase()) || null;
    proxy.status = 'Active';
    proxy.acceptedAt = now;
    proxy.updatedAt = now;
    proxy.granteeUserId = grantee?.id || null;
    delete proxy.invitationTokenHash;
    db.accessGrants ||= [];
    let grant = db.accessGrants.find((item) => item.proxyId === proxy.id);
    if (!grant) {
      grant = {
        id: `grant-${randomUUID()}`,
        proxyId: proxy.id,
        type: 'proxy',
        subjectPatientId: proxy.patientId,
        granteeEmail: proxy.proxyEmail,
        granteeUserId: grantee?.id || null,
        permissions: proxy.permissions,
        status: 'Active',
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      db.accessGrants.push(grant);
    }
    const owner = (db.users || []).find((item) => item.id === proxy.createdByUserId || item.id === proxy.userId) || { id: proxy.createdByUserId || proxy.userId, patientId: proxy.patientId };
    appendActivity(db, owner, 'Proxy invitation accepted', proxy.name);
    appendAuditLog(db, owner, 'proxy invitation accepted', 'proxyAccess', proxy.id, { grantId: grant.id, granteeUserId: grantee?.id || null });
    return { proxy: publicProxy(proxy), grant: publicGrant(grant) };
  });
  if (!accepted) throw notFound('Proxy invitation not found');
  return accepted;
}

export async function updateProxyPermissions(user, proxyId, input) {
  const proxy = await updateDb((db) => {
    const foundProxy = findOwned(db.familyAccess?.proxies || [], user, (item) => item.id === proxyId);
    if (!foundProxy) return null;
    if (foundProxy.status === 'revoked' || foundProxy.status === 'Revoked') throw conflict('Revoked proxy access cannot be updated');
    foundProxy.permissions = input.permissions;
    foundProxy.updatedAt = new Date().toISOString();
    const grant = (db.accessGrants || []).find((item) => item.proxyId === foundProxy.id && item.status === 'Active');
    if (grant) {
      grant.permissions = input.permissions;
      grant.updatedAt = foundProxy.updatedAt;
    }
    appendActivity(db, user, 'Proxy permissions updated', `${foundProxy.name}: ${foundProxy.permissions}`);
    appendAuditLog(db, user, 'proxy permissions updated', 'proxyAccess', foundProxy.id);
    return publicProxy(foundProxy);
  });
  if (!proxy) throw notFound('Proxy not found');
  return proxy;
}

export async function resendProxyInvite(user, proxyId) {
  const token = randomBytes(32).toString('base64url');
  const prepared = await readDb();
  const found = findOwned(prepared.familyAccess?.proxies || [], user, (item) => item.id === proxyId);
  if (!found) throw notFound('Proxy not found');
  if (!['Invitation Pending', 'Expired'].includes(found.status)) throw conflict('Only pending or expired invitations can be resent');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
  const delivery = await notificationGateway.deliver({
    channel: 'email', recipient: found.proxyEmail, template: 'proxy-invitation', subject: 'Patient portal proxy invitation',
    body: `${found.name}, your patient portal proxy invitation was resent and expires in 7 days.`,
    metadata: { acceptanceUrl: acceptanceUrl(token), expiresAt },
  });

  return updateDb((db) => {
    const proxy = findOwned(db.familyAccess?.proxies || [], user, (item) => item.id === proxyId);
    if (!proxy) throw notFound('Proxy not found');
    proxy.status = 'Invitation Pending';
    proxy.invitationTokenHash = hashToken(token);
    proxy.invitationExpiresAt = expiresAt;
    proxy.resentAt = new Date().toISOString();
    proxy.updatedAt = proxy.resentAt;
    enqueueNotification(db, delivery, proxy);
    appendActivity(db, user, 'Proxy invite resent', proxy.name);
    appendAuditLog(db, user, 'proxy invite resent', 'proxyAccess', proxy.id, { deliveryId: delivery.id });
    return publicProxy(proxy);
  });
}

export async function revokeProxy(user, proxyId) {
  const proxy = await updateDb((db) => {
    const foundProxy = findOwned(db.familyAccess?.proxies || [], user, (item) => item.id === proxyId);
    if (!foundProxy) return null;
    if (foundProxy.status === 'Revoked') return publicProxy(foundProxy);
    foundProxy.status = 'Revoked';
    foundProxy.revokedAt = new Date().toISOString();
    foundProxy.updatedAt = foundProxy.revokedAt;
    delete foundProxy.invitationTokenHash;
    for (const grant of (db.accessGrants || []).filter((item) => item.proxyId === foundProxy.id && item.status === 'Active')) {
      grant.status = 'Revoked';
      grant.revokedAt = foundProxy.revokedAt;
      grant.updatedAt = foundProxy.revokedAt;
    }
    appendActivity(db, user, 'Proxy access revoked', foundProxy.name);
    appendAuditLog(db, user, 'proxy revoked', 'proxyAccess', foundProxy.id);
    return publicProxy(foundProxy);
  });
  if (!proxy) throw notFound('Proxy not found');
  return proxy;
}

export async function addDependent(user, input) {
  return updateDb((db) => {
    db.familyAccess ||= {};
    db.familyAccess.accounts ||= [];
    const dependent = stampPatientOwnership({
      id: `acct-${randomUUID()}`,
      name: input.name,
      relationship: input.relationship,
      detail: input.detail,
      access: input.access,
      createdAt: new Date().toISOString(),
    }, user);
    db.familyAccess.accounts.push(dependent);
    appendActivity(db, user, 'Dependent added', dependent.name);
    appendAuditLog(db, user, 'dependent added', 'familyAccount', dependent.id);
    return publicDependent(dependent);
  });
}

export async function updateDependent(user, dependentId, input) {
  const dependent = await updateDb((db) => {
    const found = findOwned(db.familyAccess?.accounts || [], user, (item) => item.id === dependentId);
    if (!found) return null;
    found.name = input.name;
    found.relationship = input.relationship;
    found.detail = input.detail;
    found.access = input.access;
    found.updatedAt = new Date().toISOString();
    appendActivity(db, user, 'Dependent updated', found.name);
    appendAuditLog(db, user, 'dependent updated', 'familyAccount', found.id);
    return publicDependent(found);
  });
  if (!dependent) throw notFound('Dependent not found');
  return dependent;
}

export async function deleteDependent(user, dependentId) {
  const dependent = await updateDb((db) => {
    const found = findOwned(db.familyAccess?.accounts || [], user, (item) => item.id === dependentId);
    if (!found) return null;
    found.deletedAt = new Date().toISOString();
    found.updatedAt = found.deletedAt;
    appendActivity(db, user, 'Dependent removed', found.name);
    appendAuditLog(db, user, 'dependent deleted', 'familyAccount', found.id);
    return publicDependent(found);
  });
  if (!dependent) throw notFound('Dependent not found');
  return dependent;
}

export async function updatePrivacySettings(user, input) {
  return updateDb((db) => {
    const scoped = scopeDbToPatient(db, user);
    const preferences = { ...scoped.preferences };
    if (input.shareRecords !== null) preferences.shareRecords = input.shareRecords;
    if (input.mentalHealthNotes !== null) preferences.mentalHealthNotes = input.mentalHealthNotes;
    updatePatientProfile(db, user, { preferences });
    appendActivity(db, user, 'Privacy settings updated', 'Proxy sharing settings changed');
    appendAuditLog(db, user, 'privacy settings updated', 'preferences');
    return { shareRecords: Boolean(preferences.shareRecords), mentalHealthNotes: Boolean(preferences.mentalHealthNotes) };
  });
}

export async function reportUnauthorizedAccess(user, input) {
  return updateDb((db) => {
    db.familyAccess ||= {};
    db.familyAccess.reports ||= [];
    const now = new Date().toISOString();
    const report = stampPatientOwnership({
      id: `report-${randomUUID()}`,
      summary: input.summary,
      contactPreference: input.contactPreference,
      status: 'Submitted',
      statusHistory: [{ status: 'Submitted', changedAt: now, changedByUserId: user.id }],
      createdAt: now,
      updatedAt: now,
    }, user);
    db.familyAccess.reports.unshift(report);
    appendActivity(db, user, 'Unauthorized access report submitted', report.summary);
    appendAuditLog(db, user, 'unauthorized access report submitted', 'proxyAccessReport', report.id);
    return publicReport(report);
  });
}

export async function getUnauthorizedAccessReport(user, reportId) {
  const db = scopeDbToPatient(await readDb(), user);
  const report = findOwned(db.familyAccess?.reports || [], user, (item) => item.id === reportId);
  if (!report) throw notFound('Access report not found');
  return publicReport(report);
}

export async function reviewUnauthorizedAccessReport(user, reportId, input) {
  const report = await updateDb((db) => {
    const found = findOwned(db.familyAccess?.reports || [], user, (item) => item.id === reportId);
    if (!found) return null;
    const now = new Date().toISOString();
    found.status = input.status;
    found.resolution = input.resolution;
    found.reviewedByUserId = actorId(user);
    found.reviewedAt = now;
    found.updatedAt = now;
    found.statusHistory ||= [];
    found.statusHistory.push({ status: input.status, resolution: input.resolution, changedAt: now, changedByUserId: actorId(user) });
    appendAuditLog(db, user, `unauthorized access report ${input.status.toLowerCase()}`, 'proxyAccessReport', found.id);
    return publicReport(found);
  });
  if (!report) throw notFound('Access report not found');
  return report;
}

export async function getAccessPolicy(user) {
  const db = scopeDbToPatient(await readDb(), user);
  return {
    title: 'Proxy Access Policy', generatedAt: new Date().toISOString(), shareRecords: Boolean(db.preferences.shareRecords),
    mentalHealthNotes: Boolean(db.preferences.mentalHealthNotes),
    policy: 'Proxy users must accept an expiring invitation before access is granted. Access is scoped, audited, and can be revoked at any time.',
  };
}

function enqueueNotification(db, delivery, proxy) {
  db.notificationOutbox ||= [];
  db.notificationOutbox.unshift({ ...delivery, proxyId: proxy.id, patientId: proxy.patientId });
}

function appendActivity(db, user, title, detail) {
  db.familyAccess ||= {};
  db.familyAccess.activity ||= [];
  db.familyAccess.activity.unshift(stampPatientOwnership({ id: `access-${randomUUID()}`, title, detail, tone: 'info', createdAt: new Date().toISOString() }, user));
}

function acceptanceUrl(token) {
  const base = String(process.env.APP_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
  return `${base}/accept-proxy?token=${encodeURIComponent(token)}`;
}

function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function publicProxy(proxy) {
  return { id: proxy.id, name: proxy.name, email: proxy.proxyEmail || '', relationship: proxy.relationship, permissions: proxy.permissions, status: proxy.status, invitedAt: proxy.invitedAt || null, invitationExpiresAt: proxy.invitationExpiresAt || null, acceptedAt: proxy.acceptedAt || null, revokedAt: proxy.revokedAt || null, updatedAt: proxy.updatedAt || null };
}

function publicDependent(item) {
  return { id: item.id, name: item.name, relationship: item.relationship || String(item.detail || '').split(' - ')[0], detail: item.detail || '', access: item.access, createdAt: item.createdAt || null, updatedAt: item.updatedAt || null, deletedAt: item.deletedAt || null };
}

function publicActivity(item) {
  return { id: item.id, title: item.title, detail: item.detail, tone: item.tone, createdAt: item.createdAt || null };
}

function publicReport(item) {
  return { id: item.id, summary: item.summary, contactPreference: item.contactPreference, status: item.status, resolution: item.resolution || '', statusHistory: (item.statusHistory || []).map((entry) => ({ status: entry.status, resolution: entry.resolution || '', changedAt: entry.changedAt })), createdAt: item.createdAt || null, updatedAt: item.updatedAt || null, reviewedAt: item.reviewedAt || null };
}

function publicGrant(grant) {
  if (!grant) return null;
  return { id: grant.id, type: grant.type, permissions: grant.permissions, status: grant.status, acceptedAt: grant.acceptedAt };
}

function actorId(user) {
  return user.actorUserId || user.id;
}
