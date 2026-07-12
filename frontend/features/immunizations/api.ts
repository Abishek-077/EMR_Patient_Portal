import {
  addImmunizationAlert,
  addImmunizationRecord,
  deleteImmunizationRecord,
  dismissImmunizationAlert,
  getImmunizationDetail,
  getPrintableImmunizations,
  updateImmunizationRecord,
} from '../../shared/api/api';

export const immunizationsApi = {
  getPrintableImmunizations,
  getImmunizationDetail,
  addImmunizationRecord,
  updateImmunizationRecord,
  deleteImmunizationRecord,
  addImmunizationAlert,
  dismissImmunizationAlert,
};
