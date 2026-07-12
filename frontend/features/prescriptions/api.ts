import {
  cancelMedicationRequest,
  checkDrugInteractions,
  getMedicationLeaflet,
  getPrintablePrescriptions,
  requestNewMedication,
  requestPrescriptionRefill,
  updatePreferredPharmacy,
} from '../../shared/api/api';

export const prescriptionsApi = {
  requestPrescriptionRefill,
  requestNewMedication,
  cancelMedicationRequest,
  updatePreferredPharmacy,
  getPrintablePrescriptions,
  getMedicationLeaflet,
  checkDrugInteractions,
};
