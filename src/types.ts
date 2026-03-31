export type EmployeeStatus = 'active' | 'away';
export type AttendanceStatus = 'present' | 'absent' | 'away';

export interface Employee {
  id: string;
  name: string;
  status: EmployeeStatus;
  admissionDate: string; // YYYY-MM-DD
  photoBase64?: string;
}

export interface ConstructionSite {
  id: string;
  name: string;
  location?: string;
  contractNumber?: string;
  createdAt?: string;
}

export interface Allocation {
  employeeId: string;
  siteId: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  siteId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
}

export interface AttendanceSummary {
  employeeId: string;
  employeeName: string;
  siteName: string;
  totalAbsences: number;
}
