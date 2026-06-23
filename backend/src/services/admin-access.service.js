import { randomUUID } from 'node:crypto';
import {
  ACCESS_STATUSES,
  PERMISSION_CATALOG,
  REQUIRED_ADMIN_PERMISSIONS,
  normalizePermissionList,
  normalizeRoleId,
  resolveUserAccess,
} from '../domain/access-control.js';
import { badRequest, forbidden, notFound } from '../errors.js';
import { readDb, updateDb } from '../store.js';
import { toPublicUser } from './auth.service.js';

export async function getAccessControlOverview() {
  const db = await readDb();
  return buildOverview(db);
}

export async function updateRolePermissions(actor, roleId, permissions) {
  const normalizedRoleId = normalizeRoleId(roleId);
  const normalizedPermissions = normalizePermissionList(permissions);
  if (!normalizedRoleId) throw badRequest('roleId is required');

  const result = await updateDb((db) => {
    const role = db.accessControl.roles.find((item) => item.id === normalizedRoleId);
    if (!role) return null;

    role.permissions = normalizedRoleId === 'admin'
      ? [...new Set([...normalizedPermissions, ...REQUIRED_ADMIN_PERMISSIONS])]
      : normalizedPermissions;
    appendAudit(db, actor, 'role.permissions.updated', 'role', role.id, `Updated ${role.label} permissions`);
    return buildOverview(db);
  });

  if (!result) throw notFound('Role not found');
  return result;
}

export async function updateUserAccess(actor, userId, input) {
  const normalizedRoles = normalizeRequestedRoles(input.roles);
  const status = normalizeStatus(input.status);

  const result = await updateDb((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) return { missing: true };

    const roleIds = new Set(db.accessControl.roles.map((role) => role.id));
    const validRoles = normalizedRoles.filter((roleId) => roleIds.has(roleId));
    if (!validRoles.length) {
      throw badRequest('At least one valid role is required');
    }

    const nextUser = {
      ...user,
      roles: validRoles,
      status,
    };

    if (wouldRemoveLastAccessAdmin(db, user.id, nextUser)) {
      throw forbidden('At least one active administrator with access-management permission is required');
    }

    user.roles = validRoles;
    user.status = status;
    user.accessUpdatedAt = new Date().toISOString();
    appendAudit(db, actor, 'user.access.updated', 'user', user.id, `Updated access for ${user.fullName}`);
    return buildOverview(db);
  });

  if (result?.missing) throw notFound('User not found');
  return result;
}

function buildOverview(db) {
  const users = db.users.map((user) => {
    const access = resolveUserAccess(user, db.accessControl);
    return {
      ...toPublicUser(user, access),
      createdAt: user.createdAt || null,
      accessUpdatedAt: user.accessUpdatedAt || null,
    };
  });

  return {
    permissionCatalog: PERMISSION_CATALOG,
    roles: db.accessControl.roles.map((role) => ({
      ...role,
      userCount: users.filter((user) => user.roles.includes(role.id)).length,
    })),
    users,
    auditLog: [...(db.accessControl.auditLog || [])].slice(-25).reverse(),
  };
}

function normalizeRequestedRoles(roles) {
  return [...new Set((Array.isArray(roles) ? roles : []).map(normalizeRoleId).filter(Boolean))];
}

function normalizeStatus(status) {
  if (!ACCESS_STATUSES.includes(status)) throw badRequest('status must be Active or Suspended');
  return status;
}

function wouldRemoveLastAccessAdmin(db, userId, nextUser) {
  return !db.users.some((user) => {
    const candidate = user.id === userId ? nextUser : user;
    const access = resolveUserAccess(candidate, db.accessControl);
    return access.status === 'Active' && access.permissions.includes('admin.access.manage');
  });
}

function appendAudit(db, actor, action, targetType, targetId, summary) {
  db.accessControl.auditLog ||= [];
  db.accessControl.auditLog.push({
    id: `audit-${randomUUID()}`,
    action,
    targetType,
    targetId,
    summary,
    actorUserId: actor.id,
    actorName: actor.fullName,
    createdAt: new Date().toISOString(),
  });
  db.accessControl.auditLog = db.accessControl.auditLog.slice(-100);
}
