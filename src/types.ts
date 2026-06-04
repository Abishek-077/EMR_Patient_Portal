export type Patient = {
  name: string;
  age: number;
  identifier: string;
  location: string;
  primaryCondition: string;
  careTeam: string;
  insurance: string;
  preferredLanguage: string;
  emergencyContact: string;
};

export type Task = {
  id: string;
  label: string;
  due: string;
  owner: string;
  priority: 'High' | 'Medium' | 'Low';
  completed: boolean;
};

export type Appointment = {
  id: string;
  service: string;
  clinician: string;
  provider?: string;
  date: string;
  time?: string;
  type: string;
  status: 'Confirmed' | 'Pending' | 'Cancelled' | 'Completed';
  statusGroup?: 'Upcoming' | 'Past' | 'Cancelled';
  department?: string;
  location?: string;
  initials?: string;
  action?: string;
  secondaryAction?: string;
  notes?: string;
};

export type AppointmentRequest = {
  id: string;
  reason: string;
  preferredDate: string;
  notes: string;
  status: 'Queued';
  createdAt: string;
};

export type Medication = {
  name: string;
  dose: string;
  schedule: string;
  refill: string;
  status: 'Active' | 'Optional';
};

export type Prescription = {
  id: string;
  name: string;
  detail: string;
  frequency: string;
  started: string;
  refillCount: string;
  refillDetail: string;
  status: 'Refill Due' | 'Active' | 'Pending Request';
};

export type RefillRequest = {
  id: string;
  prescriptionId: string;
  prescriptionName: string;
  status: 'Queued';
  createdAt: string;
};

export type MedicationRequest = {
  id: string;
  medicationName: string;
  notes: string;
  status: 'Pending';
  createdAt: string;
};

export type BillingInvoice = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'Overdue' | 'Paid' | 'Pending';
};

export type BillingData = {
  outstandingBalance: number;
  paymentStatus: 'Due' | 'Paid';
  dueDate?: string;
  breakdown?: {
    consultation: number;
    laboratory: number;
    radiology: number;
    pharmacy: number;
  };
  paymentMethods: Array<{
    id: string;
    type: string;
    label: string;
    detail: string;
    isDefault?: boolean;
  }>;
  invoices: BillingInvoice[];
  payments: Array<{
    id: string;
    amount: number;
    createdAt: string;
  }>;
  statements?: Array<{
    id: string;
    invoiceIds: string[];
    period: string;
    generatedAt: string;
    status: string;
  }>;
  resources?: Array<{
    id: string;
    title: string;
    detail: string;
  }>;
};

export type PreferredPharmacy = {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  hours: string;
  isPreferred: boolean;
  updatedAt: string;
};

export type ProfileSettings = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  language: string;
  timezone: string;
};

export type LabResult = {
  label: string;
  value: number;
  unit: string;
  range: string;
  tone: 'good' | 'warning';
};

export type Message = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  time: string;
  outbound?: boolean;
  conversationId?: string;
};

export type AccountStatus = {
  profileCompletion: number;
  twoFactorEnabled: boolean;
  lastLogin: string;
  privacyNotice: string;
};

export type InsuranceDetails = {
  primaryProvider: string;
  memberId: string;
  groupNumber: string;
  policyHolder: string;
  activeThrough: string;
  verifiedAt: string;
};

export type EmergencyContact = {
  id: string;
  name: string;
  relationship: string;
  primaryPhone: string;
  alternatePhone: string;
  access: string;
};

export type ThreadMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sentAtLabel: string;
  createdAt: string;
  read?: boolean;
  labReference?: {
    label: string;
    name: string;
    value: string;
  };
  attachment?: {
    fileName: string;
    size: string;
  };
};

export type MessageConversation = {
  id: string;
  participantName: string;
  participantRole: string;
  activeNow: boolean;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  resolved: boolean;
  messages: ThreadMessage[];
};

export type AppointmentList = {
  summary: {
    nextVisit: null | {
      label: string;
      provider: string;
      department: string;
    };
    pendingRequests: number;
    lastVisit: null | {
      label: string;
      service: string;
      department: string;
    };
    upcomingCount: number;
  };
  appointments: Appointment[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  tabs: {
    upcoming: number;
    past: number;
    cancelled: number;
  };
};

export type PortalDocument = {
  id: string;
  name: string;
  category: string;
  updated: string;
  status: string;
};

export type PortalData = {
  patient: Patient;
  preferences: {
    shareRecords: boolean;
  };
  tasks: Task[];
  appointments: Appointment[];
  appointmentRequests: AppointmentRequest[];
  medications: Medication[];
  preferredPharmacy: PreferredPharmacy;
  prescriptions: Prescription[];
  refillRequests: RefillRequest[];
  medicationRequests: MedicationRequest[];
  billing: BillingData;
  profileSettings: ProfileSettings;
  accountStatus: AccountStatus;
  insuranceDetails: InsuranceDetails;
  emergencyContacts: EmergencyContact[];
  labResults: LabResult[];
  messages: Message[];
  messageConversations: MessageConversation[];
  documents: PortalDocument[];
  dashboard?: unknown;
};

export type VisitRequestInput = {
  reason: string;
  preferredDate: string;
  notes: string;
};
