import {
  addPatientNote,
  deletePatientNote,
  downloadFile,
  getDocumentDetail,
  getLabDetail,
  getPrintableRecord,
  updatePatientNote,
  uploadFile,
} from '../../shared/api/api';

export const recordsApi = {
  addPatientNote,
  updatePatientNote,
  deletePatientNote,
  getLabDetail,
  getDocumentDetail,
  getPrintableRecord,
  uploadFile,
  downloadFile,
};
