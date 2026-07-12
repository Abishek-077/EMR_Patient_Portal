import {
  getRegistrationIntake,
  signRegistrationConsent,
  updateRegistrationDemographics,
  updateRegistrationForm,
  updateRegistrationInsurance,
} from '../../shared/api/api';

export const registrationApi = {
  getIntake: getRegistrationIntake,
  updateDemographics: updateRegistrationDemographics,
  updateInsurance: updateRegistrationInsurance,
  signConsent: signRegistrationConsent,
  updateForm: updateRegistrationForm,
};
