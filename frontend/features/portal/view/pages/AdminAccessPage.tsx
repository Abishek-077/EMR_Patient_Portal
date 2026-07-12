import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  ComposedModal,
  InlineLoading,
  InlineNotification,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  TextInput,
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import {
  createAdminUser,
  deleteAdminUser,
  getAccessControlOverview,
  updateRolePermissions,
  updateUserAccess,
} from '../../../../shared/api/api';
import type { AccessControlOverview, AccessRole, AccessStatus } from '../../../../shared/types';
import { formatAuditTime } from '../../model/formatters';

export function AdminAccessPage({
  canManageRoles,
  canManageUsers,
}: {
  canManageRoles: boolean;
  canManageUsers: boolean;
}) {
  const [overview, setOverview] = useState<AccessControlOverview | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [roleDraft, setRoleDraft] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ fullName: '', email: '', roles: ['patient'] as string[], status: 'Active', password: '' });
  const [creatingUser, setCreatingUser] = useState(false);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState('');
  const [oneTimeCredentials, setOneTimeCredentials] = useState<NonNullable<AccessControlOverview['oneTimeCredentials']> | null>(null);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getAccessControlOverview();
      setOverview(data);
      setSelectedRoleId((current) => current || data.roles[0]?.id || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load access control.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const selectedRole = overview?.roles.find((role) => role.id === selectedRoleId) || overview?.roles[0] || null;

  useEffect(() => {
    if (selectedRole) setRoleDraft(selectedRole.permissions);
  }, [selectedRole]);

  const permissionGroups = overview
    ? [...new Set(overview.permissionCatalog.map((permission) => permission.group))]
      .map((group) => ({
        group,
        permissions: overview.permissionCatalog.filter((permission) => permission.group === group),
      }))
    : [];
  const activeAdmins = overview?.users.filter((user) => user.status === 'Active' && user.permissions.includes('admin.access.manage')).length || 0;
  const isRoleDirty = Boolean(selectedRole) && [...roleDraft].sort().join('|') !== [...(selectedRole?.permissions || [])].sort().join('|');

  const togglePermission = (permissionId: string) => {
    setRoleDraft((current) => current.includes(permissionId)
      ? current.filter((item) => item !== permissionId)
      : [...current, permissionId]);
  };

  const saveRole = async () => {
    if (!selectedRole) return;
    setIsSavingRole(true);
    setNotice('');
    setError('');
    try {
      const nextOverview = await updateRolePermissions(selectedRole.id, roleDraft);
      setOverview(nextOverview);
      setNotice(`${selectedRole.label} permissions updated.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update role.');
    } finally {
      setIsSavingRole(false);
    }
  };

  const saveUserAccess = async (userId: string, roles: string[], status: AccessStatus) => {
    const nextOverview = await updateUserAccess(userId, roles, status);
    setOverview(nextOverview);
    setNotice('User access updated.');
  };

  const handleCreateUser = async () => {
    if (!createUserForm.fullName.trim() || !createUserForm.email.trim()) return;
    setCreatingUser(true);
    setError('');
    try {
      const nextOverview = await createAdminUser({
        fullName: createUserForm.fullName,
        email: createUserForm.email,
        roles: createUserForm.roles,
        status: createUserForm.status as 'Active' | 'Suspended',
        password: createUserForm.password || undefined,
      });
      const { oneTimeCredentials: credentials, ...safeOverview } = nextOverview;
      setOverview(safeOverview);
      setOneTimeCredentials(credentials || null);
      setCreateUserOpen(false);
      setCreateUserForm({ fullName: '', email: '', roles: ['patient'], status: 'Active', password: '' });
      setNotice(`User ${createUserForm.fullName} created.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create user.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setError('');
    try {
      const nextOverview = await deleteAdminUser(userId);
      setOverview(nextOverview);
      setDeleteConfirmUserId('');
      setNotice('User suspended and removed from active access.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not delete user.');
    }
  };

  if (isLoading) return <section className="settings-configuration admin-page"><InlineLoading description="Loading configuration" /></section>;

  return (
    <section className="settings-configuration admin-page" aria-label="Settings configuration">
      <section className="records-title admin-title">
        <div>
          <p>Admin / <strong>Access Control</strong></p>
          <h1>Access Control</h1>
          <span>Configure role permissions, user assignments, account status, and audit review from the admin workspace.</span>
        </div>
      </section>

      {notice && <p className="workspace-notice">{notice}</p>}
      {error && <InlineNotification kind="error" lowContrast title="Access control issue" subtitle={error} />}

      {overview && (
        <>
          <section className="access-summary">
            <article><span>Roles</span><strong>{overview.roles.length}</strong></article>
            <article><span>Users</span><strong>{overview.users.length}</strong></article>
            <article><span>Active access admins</span><strong>{activeAdmins}</strong></article>
            <article><span>Permissions</span><strong>{overview.permissionCatalog.length}</strong></article>
          </section>

          <section className="access-shell">
            <aside className="role-list">
              <h2>Roles</h2>
              {overview.roles.map((role) => (
                <button className={role.id === selectedRole?.id ? 'active' : ''} type="button" key={role.id} onClick={() => setSelectedRoleId(role.id)}>
                  <strong>{role.label}</strong>
                  <span>{role.userCount || 0} user{role.userCount === 1 ? '' : 's'}</span>
                </button>
              ))}
            </aside>

            <section className="role-editor">
              {selectedRole && (
                <>
                  <header>
                    <div>
                      <h2>{selectedRole.label}</h2>
                      <p>{selectedRole.description}</p>
                    </div>
                    <button className="primary-action" type="button" disabled={!canManageRoles || !isRoleDirty || isSavingRole} onClick={saveRole}>
                      {isSavingRole ? 'Saving...' : canManageRoles ? 'Save Permissions' : 'View Only'}
                    </button>
                  </header>
                  <div className="permission-groups">
                    {permissionGroups.map(({ group, permissions }) => (
                      <fieldset key={group}>
                        <legend>{group}</legend>
                        {permissions.map((permission) => (
                          <label key={permission.id}>
                            <input
                              type="checkbox"
                              checked={roleDraft.includes(permission.id)}
                              disabled={!canManageRoles || (selectedRole.id === 'admin' && permission.id.startsWith('admin.'))}
                              onChange={() => togglePermission(permission.id)}
                            />
                            <span><strong>{permission.label}</strong><small>{permission.description}</small></span>
                          </label>
                        ))}
                      </fieldset>
                    ))}
                  </div>
                </>
              )}
            </section>
          </section>

          <section className="user-access-panel">
            <header>
              <h2>User Access</h2>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span>{canManageUsers ? 'Role and status changes are audited.' : 'View-only access'}</span>
                {canManageUsers && (
                  <button className="primary-action" type="button" onClick={() => setCreateUserOpen(true)}>
                    <Add size={16} /> Add User
                  </button>
                )}
              </div>
            </header>
            <div className="portal-table-wrap">
              <table>
                <thead><tr><th>User</th><th>Assigned roles</th><th>Status</th><th>Effective access</th><th>Action</th></tr></thead>
                <tbody>
                  {overview.users.map((user) => (
                    <UserAccessRow
                      key={user.id}
                      user={user}
                      roles={overview.roles}
                      canManage={canManageUsers}
                      onSave={saveUserAccess}
                      onDelete={canManageUsers ? (userId) => setDeleteConfirmUserId(userId) : undefined}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="access-audit">
            <header><h2>Audit Trail</h2><span>Latest {overview.auditLog.length} events</span></header>
            {overview.auditLog.length ? overview.auditLog.map((event) => (
              <article key={event.id}>
                <strong>{event.summary}</strong>
                <span>{event.actorName} - {formatAuditTime(event.createdAt)}</span>
              </article>
            )) : <p className="empty-appointments">No access-control changes have been recorded yet.</p>}
          </section>
        </>
      )}

      <ComposedModal open={createUserOpen} onClose={() => setCreateUserOpen(false)} size="sm">
        <ModalHeader title="Create new user" />
        <ModalBody>
          <Stack gap={5}>
            <TextInput id="cu-fullname" labelText="Full name" value={createUserForm.fullName} onChange={(e) => setCreateUserForm((c) => ({ ...c, fullName: e.target.value }))} />
            <TextInput id="cu-email" labelText="Email address" value={createUserForm.email} onChange={(e) => setCreateUserForm((c) => ({ ...c, email: e.target.value }))} />
            <TextInput id="cu-password" labelText="Temporary password (optional)" value={createUserForm.password} onChange={(e) => setCreateUserForm((c) => ({ ...c, password: e.target.value }))} />
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>Assign roles</p>
              <div className="user-role-checks">
                {overview?.roles.map((role) => (
                  <label key={role.id}>
                    <input
                      type="checkbox"
                      checked={createUserForm.roles.includes(role.id)}
                      onChange={() => setCreateUserForm((c) => ({
                        ...c,
                        roles: c.roles.includes(role.id)
                          ? c.roles.filter((r) => r !== role.id)
                          : [...c.roles, role.id],
                      }))}
                    />
                    <span>{role.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="payment-method-select" htmlFor="cu-status">
              <span>Status</span>
              <select id="cu-status" value={createUserForm.status} onChange={(e) => setCreateUserForm((c) => ({ ...c, status: e.target.value }))}>
                <option>Active</option>
                <option>Suspended</option>
              </select>
            </label>
            {error && <InlineNotification kind="error" lowContrast title="Cannot create user" subtitle={error} />}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setCreateUserOpen(false)}>Cancel</Button>
          <Button disabled={creatingUser || !createUserForm.fullName.trim() || !createUserForm.email.trim() || !createUserForm.roles.length} onClick={handleCreateUser}>
            {creatingUser ? 'Creating...' : 'Create user'}
          </Button>
        </ModalFooter>
      </ComposedModal>

      <ComposedModal open={Boolean(deleteConfirmUserId)} onClose={() => setDeleteConfirmUserId('')} size="sm">
        <ModalHeader title="Suspend user account" />
        <ModalBody>
          <p>This will suspend the user account and remove active role access. This action is recorded in the audit log.</p>
          {error && <InlineNotification kind="error" lowContrast title="Cannot delete user" subtitle={error} />}
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setDeleteConfirmUserId('')}>Cancel</Button>
          <Button kind="danger" onClick={() => void handleDeleteUser(deleteConfirmUserId)}>Suspend user</Button>
        </ModalFooter>
      </ComposedModal>

      <ComposedModal open={Boolean(oneTimeCredentials)} onClose={() => setOneTimeCredentials(null)} size="sm">
        <ModalHeader title="Temporary sign-in credentials" />
        <ModalBody>
          <Stack gap={4}>
            <p>Share these credentials through an approved secure channel. This password is shown only once and the user must change it after signing in.</p>
            <TextInput id="temporary-user-email" labelText="Email" readOnly value={oneTimeCredentials?.email || ''} />
            <TextInput id="temporary-user-password" labelText="Temporary password" readOnly value={oneTimeCredentials?.temporaryPassword || ''} />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => oneTimeCredentials && void navigator.clipboard.writeText(`${oneTimeCredentials.email}\n${oneTimeCredentials.temporaryPassword}`)}>Copy credentials</Button>
          <Button onClick={() => setOneTimeCredentials(null)}>I have stored them securely</Button>
        </ModalFooter>
      </ComposedModal>
    </section>
  );
}

function UserAccessRow({
  user,
  roles,
  canManage,
  onSave,
  onDelete,
}: {
  user: AccessControlOverview['users'][number];
  roles: AccessRole[];
  canManage: boolean;
  onSave: (userId: string, roles: string[], status: AccessStatus) => Promise<void>;
  onDelete?: (userId: string) => void;
}) {
  const [selectedRoles, setSelectedRoles] = useState(user.roles);
  const [status, setStatus] = useState<AccessStatus>(user.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedRoles(user.roles);
    setStatus(user.status);
  }, [user.roles, user.status]);

  const dirty = [...selectedRoles].sort().join('|') !== [...user.roles].sort().join('|') || status !== user.status;

  const toggleRole = (roleId: string) => {
    setSelectedRoles((current) => current.includes(roleId)
      ? current.filter((item) => item !== roleId)
      : [...current, roleId]);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(user.id, selectedRoles, status);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update user access.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td><strong>{user.fullName}</strong><small>{user.email}</small></td>
      <td>
        <div className="user-role-checks">
          {roles.map((role) => (
            <label key={role.id}>
              <input type="checkbox" disabled={!canManage} checked={selectedRoles.includes(role.id)} onChange={() => toggleRole(role.id)} />
              <span>{role.label}</span>
            </label>
          ))}
        </div>
      </td>
      <td>
        <select disabled={!canManage} value={status} onChange={(event) => setStatus(event.target.value as AccessStatus)}>
          <option>Active</option>
          <option>Suspended</option>
        </select>
      </td>
      <td><span>{user.permissions.length} permission{user.permissions.length === 1 ? '' : 's'}</span>{error && <small className="composer-error">{error}</small>}</td>
      <td>
        <button type="button" disabled={!canManage || !dirty || !selectedRoles.length || saving} onClick={save}>{saving ? 'Saving...' : 'Save'}</button>
        {onDelete && <button type="button" aria-label={`Delete ${user.fullName}`} style={{ marginLeft: '4px' }} onClick={() => onDelete(user.id)}><TrashCan size={15} /></button>}
      </td>
    </tr>
  );
}
