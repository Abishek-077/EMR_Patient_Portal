import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import {
  ACCESS_STATUSES,
  PERMISSION_CATALOG,
  REQUIRED_ADMIN_PERMISSIONS,
  normalizePermissionList,
  normalizeRoleId,
  resolveUserAccess,
} from '../../domain/access-control.js';
import { badRequest, conflict, forbidden, notFound } from '../../errors.js';
import { appendAuditLog, provisionPatientDemoData } from '../../domain/patient-scope.js';
import { readDb, updateDb } from '../../store.js';
import { toPublicUser } from '../auth/auth.service.js';

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

export async function createAdminUser(actor, input) {
  const normalizedEmail = input.email.toLowerCase();
  const normalizedRoles = normalizeRequestedRoles(input.roles || ['patient']);
  const status = normalizeStatus(input.status || 'Active');

  return updateDb((db) => {
    db.users ||= [];
    const exists = db.users.some(
      (u) => String(u.email).toLowerCase() === normalizedEmail ||
        (input.patientId && String(u.patientId || '').toLowerCase() === input.patientId.toLowerCase()),
    );
    if (exists) throw conflict('A user with this email or patient ID already exists');

    const roleIds = new Set(db.accessControl.roles.map((r) => r.id));
    const validRoles = normalizedRoles.filter((id) => roleIds.has(id));
    if (!validRoles.length) throw badRequest('At least one valid role is required');

    const salt = randomBytes(16).toString('hex');
    const temporaryPassword = input.password || `Temp@${randomUUID().slice(0, 8)}`;
    const hash = scryptSync(temporaryPassword, salt, 64).toString('hex');

    const user = {
      id: `user-${randomUUID()}`,
      fullName: input.fullName,
      email: normalizedEmail,
      dateOfBirth: input.dateOfBirth || '1970-01-01',
      patientId: input.patientId || (validRoles.includes('patient') ? `P-${randomUUID().slice(0, 8).toUpperCase()}` : ''),
      roles: validRoles,
      status,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
      createdByAdminId: actor.id,
      mustChangePassword: true,
    };

    db.users.push(user);
    if (validRoles.includes('patient')) provisionPatientDemoData(db, user);
    appendAuditLog(db, actor, 'admin.user.created', 'user', user.id, { email: user.email });
    appendAudit(db, actor, 'user.created', 'user', user.id, `Created user ${user.fullName}`);
    const overview = buildOverview(db);
    if (!input.password) {
      overview.oneTimeCredentials = {
        userId: user.id,
        email: user.email,
        temporaryPassword,
      };
    }
    return overview;
  });
}

export async function deleteAdminUser(actor, userId) {
  const result = await updateDb((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return { missing: true };

    if (wouldRemoveLastAccessAdmin(db, userId, { ...user, status: 'Suspended', roles: [] })) {
      throw forbidden('Cannot delete the last active administrator');
    }

    user.status = 'Suspended';
    user.deletedAt = new Date().toISOString();
    user.roles = [];
    appendAudit(db, actor, 'user.deleted', 'user', user.id, `Deleted user ${user.fullName}`);
    appendAuditLog(db, actor, 'admin.user.deleted', 'user', user.id);
    return buildOverview(db);
  });

  if (result?.missing) throw notFound('User not found');
  return result;
}
