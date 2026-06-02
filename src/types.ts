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
  date: string;
  type: string;
  status: 'Confirmed' | 'Pending';
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
  labResults: LabResult[];
  messages: Message[];
  documents: PortalDocument[];
};

export type VisitRequestInput = {
  reason: string;
  preferredDate: string;
  notes: string;
};
