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
  reason?: string;
  notes?: string;
};

export type Provider = {
  id: string;
  name: string;
  department: string;
  role: string;
  location: string;
  available: boolean;
  preferred?: boolean;
};

export type AppointmentSlot = {
  id: string;
  department: string;
  date: string;
  time: string;
  status: 'Available' | 'Booked' | string;
};

export type AppointmentRequest = {
  id: string;
  reason: string;
  preferredDate: string;
  notes: string;
  status: 'Queued' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  createdAt: string;
  provider?: string;
  department?: string;
  slotId?: string | null;
  date?: string;
  time?: string;
  location?: string;
  service?: string;
  requestType?: string;
  updatedAt?: string;
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
  prescriber?: string;
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
  pharmacyName?: string;
  status: 'Pending' | 'Queued' | 'Approved' | 'Rejected' | 'Cancelled';
  createdAt: string;
};

export type MedicationRequest = {
  id: string;
  medicationName: string;
  notes: string;
  status: 'Pending' | 'Queued' | 'Approved' | 'Rejected' | 'Cancelled';
  createdAt: string;
};

export type BillingInvoice = {
  id: string;
  date: string;
  description: string;
  amount: number;
  paidAmount?: number;
  balanceDue?: number;
  status: 'Overdue' | 'Paid' | 'Pending' | 'Partially Paid';
  paidAt?: string;
  createdAt?: string;
  deletedAt?: string;
};

export type BillingInvoiceInput = {
  description: string;
  amount: number;
  date?: string;
  status?: string;
};

export type AdminUserInput = {
  fullName: string;
  email: string;
  dateOfBirth?: string;
  patientId?: string;
  roles: string[];
  status?: string;
  password?: string;
};

export type BillingPaymentMethod = {
  id: string;
  type: 'Card' | 'Bank';
  label: string;
  detail: string;
  isDefault?: boolean;
};

export type BillingPaymentMethodInput = Omit<BillingPaymentMethod, 'id'>;

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
  paymentMethods: BillingPaymentMethod[];
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

export type BillingStatement = {
  id: string;
  invoiceIds: string[];
  period: string;
  generatedAt: string;
  status: string;
  invoices: BillingInvoice[];
  balance: number;
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
  id?: string;
  label: string;
  value: number;
  unit: string;
  range: string;
  observedAt?: string;
  tone: 'good' | 'warning';
};

export type DashboardVital = {
  id: string;
  label: string;
  value: string;
  unit: string;
  status: string;
  progress: number | null;
};

export type DashboardActivity = {
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
  tone: 'info' | 'success' | 'message';
};

export type DashboardAttentionItem = {
  id: string;
  type: 'refill' | 'referral' | 'appointment' | 'billing';
  title: string;
  detail: string;
  status: string;
  tone: 'warning' | 'error' | 'pending';
  target: 'prescriptions' | 'referrals' | 'appointments' | 'billing';
  actionLabel: string;
  referenceId: string;
};

export type DashboardData = {
  patient: Patient & {
    email?: string;
  };
  summary: {
    welcomeName: string;
    healthId: string;
    overviewDate: string;
    appointmentsUpcoming: number;
    unreadMessages: number;
    refillsDue: number;
    outstandingBalance: number;
    careTeam: string;
    primaryCondition: string;
  };
  quickActions: Array<{
    id: string;
    label: string;
    detail: string;
    target: 'appointments' | 'messages' | 'prescriptions';
    enabled: boolean;
    restrictedReason?: string;
  }>;
  attentionItems: DashboardAttentionItem[];
  latestLabResults: LabResult[];
  upcomingAppointments: Appointment[];
  recentActivity: DashboardActivity[];
  vitals: DashboardVital[];
  security: {
    encrypted: boolean;
    hipaaMode: boolean;
    lastSync: string;
  };
};

export type ClinicalNote = {
  id: string;
  type: string;
  date: string;
  title: string;
  text: string;
  provenance?: 'patient-reported' | 'clinician' | 'registry' | string;
  verificationStatus?: 'unverified' | 'verified' | string;
  createdByUserId?: string;
  deletedAt?: string;
};

export type Immunization = {
  id: string;
  title: string;
  last: string;
  doses: string;
  status: string;
  tone: 'green' | 'yellow';
};

export type ImmunizationCompletedRecord = {
  id: string;
  vaccine: string;
  date: string;
  dose: string;
  provider: string;
  route: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  provenance?: 'patient-reported' | 'clinician' | 'registry' | string;
  verificationStatus?: 'Pending verification' | 'Verified' | 'Rejected' | string;
};

export type ImmunizationAlert = {
  id: string;
  tone: 'warning' | 'info' | 'neutral';
  title: string;
  detail: string;
  dismissed?: boolean;
};

export type ImmunizationRecordInput = {
  vaccine: string;
  date: string;
  dose: string;
  provider?: string;
  route?: string;
};

export type ImmunizationRecords = {
  alerts: ImmunizationAlert[];
  completed: ImmunizationCompletedRecord[];
  compliance: {
    percent: number;
    completed: number;
    recommended: number;
    detail: string;
  };
};

export type EducationalResources = {
  featured: {
    id: string;
    category: string;
    title: string;
    detail: string;
    meta: string;
    updated: string;
    actionLabel: string;
    imageUrl?: string;
    sourceUrl?: string;
    sourceLabel?: string;
  };
  video: {
    id: string;
    title: string;
    detail: string;
    duration: string;
    category: string;
    imageUrl?: string;
    sourceUrl?: string;
    sourceLabel?: string;
  };
  groups: Array<{
    id: string;
    title: string;
    items: Array<{
      id?: string;
      title: string;
      detail: string;
      action: string;
      sourceUrl?: string;
      sourceLabel?: string;
    }>;
  }>;
  library: Array<{
    id: string;
    title: string;
    detail: string;
    category: string;
    updated: string;
    format: string;
    sourceUrl?: string;
    sourceLabel?: string;
  }>;
};

export type ReferralsData = {
  summary: {
    active: number;
    pending: number;
    completedYear: number;
  };
  rows: Array<{
    id: string;
    issuedDate: string;
    provider: string;
    specialty: string;
    reason: string;
    status: 'Pending' | 'Approved' | 'Scheduled' | 'Completed' | 'Rejected' | 'Cancelled';
    actions: string[];
    appointment?: string;
  }>;
  focus: {
    caseId: string;
    title: string;
    note: string;
    attachment: string;
    lastUpdate: string;
    clinic: string;
    address: string;
    phone: string;
    email: string;
  };
};

export type FamilyAccessData = {
  proxies: Array<{
    id: string;
    name: string;
    relationship: string;
    permissions: string;
    status: string;
    email?: string;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    detail: string;
    access: string;
    relationship?: string;
  }>;
  activity: Array<{
    id: string;
    title: string;
    detail: string;
    tone: 'success' | 'info' | 'neutral';
  }>;
  reports?: Array<{
    id: string;
    summary: string;
    contactPreference: string;
    status: string;
    createdAt: string;
  }>;
};

export type TrendMetric = {
  id: string;
  label: string;
  unit?: string;
  latestValue?: string;
  status?: string;
  latest?: string;
  averageLabel?: string;
  average?: string;
  points?: number[];
  readings?: Array<{
    id: string;
    value: string;
    recordedAt: string;
    unit?: string;
    deletedAt?: string;
  }>;
};

export type TrendGoal = {
  id: string;
  label: string;
  progress: number;
  deletedAt?: string;
};

export type TrendReadingInput = {
  metricId?: string;
  label: string;
  value: string;
  unit?: string;
  recordedAt?: string;
};

export type TrendGoalInput = {
  label: string;
  progress: number;
};

export type HealthTrendsData = {
  summary?: {
    withinRange: number;
    attentionRequired: number;
    updates: string[];
  };
  metrics: TrendMetric[];
  labComparison: Array<{
    parameter: string;
    baseline: string;
    current: string;
    change: string;
    status: 'Normal' | 'Elevated' | 'Attention';
  }>;
  goals: TrendGoal[];
};

export type AccessStatus = 'Active' | 'Suspended';

export type AccessUser = {
  id: string;
  fullName: string;
  email: string;
  patientId: string;
  roles: string[];
  roleLabels: string[];
  permissions: string[];
  status: AccessStatus;
  createdAt?: string | null;
  accessUpdatedAt?: string | null;
};

export type PermissionCatalogItem = {
  id: string;
  label: string;
  description: string;
  group: string;
};

export type AccessRole = {
  id: string;
  label: string;
  description: string;
  permissions: string[];
  system: boolean;
  userCount?: number;
};

export type AccessAuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  actorUserId: string;
  actorName: string;
  createdAt: string;
};

export type AccessControlOverview = {
  permissionCatalog: PermissionCatalogItem[];
  roles: AccessRole[];
  users: AccessUser[];
  auditLog: AccessAuditEvent[];
  oneTimeCredentials?: {
    userId: string;
    email: string;
    temporaryPassword: string;
  };
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
  updatedAt?: string;
};

export type RegistrationDemographics = {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  preferredLanguage: string;
  emergencyContact: string;
  updatedAt?: string;
};

export type RegistrationConsent = {
  id: string;
  title: string;
  description: string;
  signerName?: string;
  signedAt?: string;
};

export type RegistrationForm = {
  id: string;
  title: string;
  fields: Record<string, string>;
  status: string;
  updatedAt?: string;
};

export type RegistrationIntake = {
  demographics: RegistrationDemographics;
  insurance: InsuranceDetails;
  consents: RegistrationConsent[];
  forms: RegistrationForm[];
  completion: {
    completedSteps: number;
    totalSteps: number;
    percent: number;
    status: 'Not Started' | 'In Progress' | 'Complete' | string;
  };
  updatedAt?: string;
};

export type HomeData = {
  patient: DashboardData['patient'];
  summary: {
    welcomeName: string;
    overviewDate: string;
    upcomingAppointments: number;
    unreadMessages: number;
    refillsDue: number;
    outstandingBalance: number;
    registrationStatus: string;
    registrationPercent: number;
  };
  nextSteps: Array<{
    id: string;
    label: string;
    detail: string;
    target: string;
    priority: string;
  }>;
  upcomingAppointments: Appointment[];
  recentActivity: DashboardActivity[];
  tasks: Task[];
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
    fileId?: string;
  };
};

export type UploadedFile = {
  id: string;
  fileName: string;
  category: string;
  size: string;
  source: string;
  relatedId?: string | null;
  uploadedAt: string;
  mimeType?: string;
  bytes?: number;
  deletedAt?: string;
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
  providers?: Provider[];
  appointmentSlots?: AppointmentSlot[];
};

export type PortalDocument = {
  id: string;
  name: string;
  category: string;
  updated: string;
  status: string;
};

export type PortalData = {
  currentUser: AccessUser;
  subjectUser?: Pick<AccessUser, 'id' | 'fullName' | 'email' | 'patientId'>;
  patientContexts?: Array<{
    id: string;
    label: string;
    medicalRecordNumber?: string;
    type?: string;
    relationship?: string;
  }>;
  currentPatientContext?: {
    id: string;
    label: string;
    medicalRecordNumber?: string;
    type?: string;
    relationship?: string;
  } | null;
  access: {
    roles: string[];
    roleLabels: string[];
    permissions: string[];
    status: AccessStatus;
  };
  featureErrors?: Record<string, string>;
  patient: Patient;
  preferences: {
    shareRecords: boolean;
    mentalHealthNotes?: boolean;
  };
  tasks: Task[];
  providers: Provider[];
  appointmentSlots: AppointmentSlot[];
  appointments: Appointment[];
  appointmentRequests: AppointmentRequest[];
  medications: Medication[];
  preferredPharmacy: PreferredPharmacy;
  prescriptions: Prescription[];
  refillRequests: RefillRequest[];
  medicationRequests: MedicationRequest[];
  billing: BillingData;
  registration?: RegistrationIntake;
  profileSettings: ProfileSettings;
  accountStatus: AccountStatus;
  insuranceDetails: InsuranceDetails;
  emergencyContacts: EmergencyContact[];
  labResults: LabResult[];
  clinicalNotes: ClinicalNote[];
  immunizations: Immunization[];
  immunizationRecords: ImmunizationRecords;
  educationalResources: EducationalResources;
  referrals: ReferralsData;
  familyAccess: FamilyAccessData;
  healthTrends: HealthTrendsData;
  messages: Message[];
  messageConversations: MessageConversation[];
  documents: PortalDocument[];
  uploadedFiles: UploadedFile[];
  activityLog: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    createdAt: string;
  }>;
  resourceInteractions: Array<{
    id: string;
    resourceId: string;
    resourceTitle: string;
    action: string;
    createdAt: string;
  }>;
  dashboard: DashboardData;
};

export type VisitRequestInput = {
  service?: string;
  provider?: string;
  department?: string;
  date?: string;
  time?: string;
  location?: string;
  reason: string;
  preferredDate: string;
  notes: string;
};
