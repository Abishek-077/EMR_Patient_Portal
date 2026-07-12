import type {
  BillingInvoiceInput,
  BillingPaymentMethodInput,
  EmergencyContact,
  PreferredPharmacy,
} from '../../../shared/types';

export const initialVisitForm = {
  service: 'General consultation',
  department: '',
  provider: '',
  date: '',
  time: '',
  location: '',
  reason: '',
  preferredDate: '',
  notes: '',
};

export const initialMessageForm = {
  recipientId: '',
  subject: 'Question for Dr. Wilson',
  body: '',
};

export const initialPaymentMethodForm: BillingPaymentMethodInput = {
  type: 'Card',
  label: '',
  detail: '',
  isDefault: false,
};

export const emptyInvoiceForm: BillingInvoiceInput = {
  description: '',
  amount: 0,
  date: '',
  status: 'Pending',
};

export const emptyEmergencyContact: Omit<EmergencyContact, 'id'> = {
  name: '',
  relationship: '',
  primaryPhone: '',
  alternatePhone: '',
  access: 'Emergency Only',
};

export function defaultPharmacyForm(pharmacy: PreferredPharmacy) {
  return {
    name: pharmacy.name,
    addressLine1: pharmacy.addressLine1,
    addressLine2: pharmacy.addressLine2,
    phone: pharmacy.phone,
    hours: pharmacy.hours,
  };
}
