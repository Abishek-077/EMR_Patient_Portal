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
  paidAt?: string;
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
    target: 'messages' | 'prescriptions' | 'records';
    priority: 'primary' | 'secondary' | 'neutral';
  }>;
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
};

export type Immunization = {
  id: string;
  title: string;
  last: string;
  doses: string;
  status: string;
  tone: 'green' | 'yellow';
};

export type ImmunizationRecords = {
  alerts: Array<{
    id: string;
    tone: 'warning' | 'info' | 'neutral';
    title: string;
    detail: string;
  }>;
  completed: Array<{
    id: string;
    vaccine: string;
    date: string;
    dose: string;
    provider: string;
    route: string;
  }>;
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
  };
  video: {
    id: string;
    title: string;
    detail: string;
    duration: string;
    category: string;
    imageUrl?: string;
  };
  groups: Array<{
    id: string;
    title: string;
    items: Array<{
      title: string;
      detail: string;
      action: string;
    }>;
  }>;
  library: Array<{
    id: string;
    title: string;
    detail: string;
    category: string;
    updated: string;
    format: string;
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
    status: 'Pending' | 'Scheduled' | 'Completed';
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
  }>;
  accounts: Array<{
    id: string;
    name: string;
    detail: string;
    access: string;
  }>;
  activity: Array<{
    id: string;
    title: string;
    detail: string;
    tone: 'success' | 'info' | 'neutral';
  }>;
};

export type HealthTrendsData = {
  summary: {
    withinRange: number;
    attentionRequired: number;
    updates: string[];
  };
  metrics: Array<{
    id: string;
    label: string;
    status: string;
    latest: string;
    unit: string;
    averageLabel: string;
    average: string;
    points: number[];
  }>;
  labComparison: Array<{
    parameter: string;
    baseline: string;
    current: string;
    change: string;
    status: 'Normal' | 'Elevated' | 'Attention';
  }>;
  goals: Array<{
    id: string;
    label: string;
    progress: number;
  }>;
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
  currentUser: AccessUser;
  access: {
    roles: string[];
    roleLabels: string[];
    permissions: string[];
    status: AccessStatus;
  };
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
  dashboard: DashboardData;
};

export type VisitRequestInput = {
  reason: string;
  preferredDate: string;
  notes: string;
};
