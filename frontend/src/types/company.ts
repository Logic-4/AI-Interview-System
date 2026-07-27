export type CompanyStatus = 'active' | 'suspended' | 'disabled';

export interface CompanyAdmin {
  _id: string;
  name: string;
  email: string;
  username?: string;
  lastLogin?: string;
}

export interface Company {
  _id: string;
  name: string;
  contactEmail: string;
  status: CompanyStatus;
  adminUser?: CompanyAdmin;
  createdAt: string;
  updatedAt: string;
  metrics?: { userCount: number; interviewCount: number; jobPostCount: number };
}

export interface CompanyPayload {
  name: string;
  contactEmail: string;
  password?: string;
  status?: CompanyStatus;
}

export interface SuperadminDashboard {
  metrics: { totalCompanies: number; activeCompanies: number; suspendedCompanies: number; totalCandidates: number; totalInterviews: number; totalJobPosts: number };
  recentCompanies: Company[];
  companyStatus: { _id: CompanyStatus; count: number }[];
  subscription: { active: number; trial: number; pastDue: number; label: string };
}
