import { randomUUID } from 'node:crypto';
import { notFound } from '../../errors.js';
import { readDb, updateDb } from '../../store.js';

export async function getFamilyAccess() {
  const db = await readDb();
  return {
    familyAccess: db.familyAccess,
    preferences: db.preferences,
  };
}

export async function inviteProxy(input) {
  return updateDb((db) => {
    db.familyAccess.proxies ||= [];
    const proxy = {
      id: `proxy-${randomUUID()}`,
      name: input.name,
      relationship: input.relationship,
      permissions: input.permissions,
      status: 'Invitation Pending',
      invitedAt: new Date().toISOString(),
    };
    db.familyAccess.proxies.push(proxy);
    appendActivity(db, 'Proxy invited', `${proxy.name} - ${proxy.relationship}`);
    return proxy;
  });
}

export async function updateProxyPermissions(proxyId, input) {
  const proxy = await updateDb((db) => {
    const foundProxy = db.familyAccess.proxies.find((item) => item.id === proxyId);
    if (!foundProxy) return null;
    foundProxy.permissions = input.permissions;
    foundProxy.updatedAt = new Date().toISOString();
    appendActivity(db, 'Proxy permissions updated', `${foundProxy.name}: ${foundProxy.permissions}`);
    return foundProxy;
  });

  if (!proxy) throw notFound('Proxy not found');
  return proxy;
}

export async function resendProxyInvite(proxyId) {
  const proxy = await updateDb((db) => {
    const foundProxy = db.familyAccess.proxies.find((item) => item.id === proxyId);
    if (!foundProxy) return null;
    foundProxy.status = 'Invitation Pending';
    foundProxy.resentAt = new Date().toISOString();
    appendActivity(db, 'Proxy invite resent', foundProxy.name);
    return foundProxy;
  });

  if (!proxy) throw notFound('Proxy not found');
  return proxy;
}

export async function revokeProxy(proxyId) {
  const proxy = await updateDb((db) => {
    const foundProxy = db.familyAccess.proxies.find((item) => item.id === proxyId);
    if (!foundProxy) return null;
    db.familyAccess.proxies = db.familyAccess.proxies.filter((item) => item.id !== proxyId);
    appendActivity(db, 'Proxy access revoked', foundProxy.name);
    return foundProxy;
  });

  if (!proxy) throw notFound('Proxy not found');
  return proxy;
}

export async function addDependent(input) {
  return updateDb((db) => {
    db.familyAccess.accounts ||= [];
    const dependent = {
      id: `acct-${randomUUID()}`,
      name: input.name,
      detail: `${input.relationship} - ${input.detail}`,
      access: input.access,
      createdAt: new Date().toISOString(),
    };
    db.familyAccess.accounts.push(dependent);
    appendActivity(db, 'Dependent added', dependent.name);
    return dependent;
  });
}

export async function updatePrivacySettings(input) {
  return updateDb((db) => {
    db.preferences ||= {};
    if (input.shareRecords !== null) db.preferences.shareRecords = input.shareRecords;
    if (input.mentalHealthNotes !== null) db.preferences.mentalHealthNotes = input.mentalHealthNotes;
    appendActivity(db, 'Privacy settings updated', 'Global proxy sharing settings changed');
    return db.preferences;
  });
}

export async function reportUnauthorizedAccess(input) {
  return updateDb((db) => {
    db.familyAccess.reports ||= [];
    const report = {
      id: `report-${randomUUID()}`,
      summary: input.summary,
      contactPreference: input.contactPreference,
      status: 'Submitted',
      createdAt: new Date().toISOString(),
    };
    db.familyAccess.reports.unshift(report);
    appendActivity(db, 'Unauthorized access report submitted', report.summary);
    return report;
  });
}

export async function getAccessPolicy() {
  const db = await readDb();
  return {
    title: 'Proxy Access Policy',
    generatedAt: new Date().toISOString(),
    shareRecords: db.preferences.shareRecords,
    mentalHealthNotes: db.preferences.mentalHealthNotes,
    policy: 'Proxy users must verify identity before accessing sensitive diagnostic information. All proxy access is logged and can be revoked at any time.',
  };
}

function appendActivity(db, title, detail) {
  db.familyAccess.activity ||= [];
  db.familyAccess.activity.unshift({
    id: `access-${randomUUID()}`,
    title,
    detail: `Just now - ${detail}`,
    tone: 'info',
  });
}
