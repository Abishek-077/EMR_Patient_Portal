import {
  addDependent,
  deleteDependent,
  getAccessPolicy,
  inviteProxy,
  reportUnauthorizedAccess,
  resendProxyInvite,
  revokeProxy,
  updateDependent,
  updateFamilyPrivacy,
  updateProxyPermissions,
} from '../../shared/api/api';

export const familyApi = {
  inviteProxy,
  updateProxyPermissions,
  resendProxyInvite,
  revokeProxy,
  addDependent,
  updateDependent,
  deleteDependent,
  updateFamilyPrivacy,
  reportUnauthorizedAccess,
  getAccessPolicy,
};
