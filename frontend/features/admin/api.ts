import {
  createAdminUser,
  deleteAdminUser,
  getAccessControlOverview,
  updateRolePermissions,
  updateUserAccess,
} from '../../shared/api/api';

export const adminApi = {
  getAccessControlOverview,
  updateRolePermissions,
  updateUserAccess,
  createAdminUser,
  deleteAdminUser,
};
