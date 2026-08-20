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

export interface DashboardRecentUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  company?: { _id: string; name: string } | null;
  accountStatus: 'active' | 'disabled';
  createdAt: string;
}

export interface SuperadminDashboard {
  metrics: { totalCompanies: number; activeCompanies: number; suspendedCompanies: number; totalCandidates: number; activeUsers: number; disabledUsers: number; totalInterviews: number; totalJobPosts: number };
  recentUsers: DashboardRecentUser[];
  userStatus: { _id: 'active' | 'disabled'; count: number }[];
  subscription: { active: number; trial: number; pastDue: number; label: string };
}
