import {
  cancelReferral,
  getReferralDetail,
  getReferralExport,
  requestReferral,
  updateReferralAction,
} from '../../shared/api/api';

export const referralsApi = {
  requestReferral,
  updateReferralAction,
  getReferralExport,
  getReferralDetail,
  cancelReferral,
};
