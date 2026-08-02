import api from './api';
import { ApiResponse } from '@/types/api';
import {
  Job,
  JobPayload,
  Application,
  CandidateSummary,
  CompanyInterview,
  CompanyAssessment,
  CompanyProfile,
  CompanyDashboardMetrics,
  ApplicationStatus,
  SecurityEvent,
} from '@/types/companyPortal';

interface PaginatedResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  [key: string]: any;
}

interface CompanyDashboardData {
  metrics: CompanyDashboardMetrics;
  recentApplications: Application[];
  upcomingInterviews: CompanyInterview[];
  recentSecurityEvents: SecurityEvent[];
  latestActivity: Array<{
    id: string;
    type: string;
    title: string;
    subtitle: string;
    timestamp: string;
  }>;
}

const companyService = {
  // Dashboard
  async getDashboard(): Promise<CompanyDashboardData> {
    const response = await api.get<ApiResponse<CompanyDashboardData>>('/company/dashboard');
    return response.data.data;
  },

  // Jobs
  async getJobs(params: { page?: number; limit?: number; search?: string; status?: string; department?: string } = {}) {
    const response = await api.get<ApiResponse<{ jobs: Job[]; pagination: any }>>('/company/jobs', { params });
    return response.data.data;
  },

  async getJob(id: string): Promise<Job> {
    const response = await api.get<ApiResponse<{ job: Job }>>(`/company/jobs/${id}`);
    return response.data.data.job;
  },

  async getJobById(id: string): Promise<{ job: Job }> {
    const job = await this.getJob(id);
    return { job };
  },

  async createJob(payload: Partial<JobPayload>): Promise<Job> {
    const response = await api.post<ApiResponse<{ job: Job }>>('/company/jobs', payload);
    return response.data.data.job;
  },

  async updateJob(id: string, payload: Partial<JobPayload>): Promise<Job> {
    const response = await api.put<ApiResponse<{ job: Job }>>(`/company/jobs/${id}`, payload);
    return response.data.data.job;
  },

  async deleteJob(id: string): Promise<void> {
    await api.delete(`/company/jobs/${id}`);
  },

  // Applications
  async getApplications(params: { page?: number; limit?: number; search?: string; status?: string; jobId?: string; shortlisted?: boolean } = {}) {
    const response = await api.get<ApiResponse<{ applications: Application[]; pagination: any }>>('/company/applications', { params });
    return response.data.data;
  },

  async getApplication(id: string): Promise<Application> {
    const response = await api.get<ApiResponse<{ application: Application }>>(`/company/applications/${id}`);
    return response.data.data.application;
  },

  async deleteApplication(id: string): Promise<void> {
    await api.delete(`/company/applications/${id}`);
  },

  async updateApplicationStatus(id: string, payload: { status?: ApplicationStatus; isShortlisted?: boolean; reason?: string }): Promise<Application> {
    const response = await api.patch<ApiResponse<{ application: Application }>>(`/company/applications/${id}/status`, payload);
    return response.data.data.application;
  },

  async approveApplication(id: string): Promise<Application> {
    const response = await api.patch<ApiResponse<{ application: Application }>>(`/company/applications/${id}/approve`);
    return response.data.data.application;
  },

  // Candidates & Shortlist
  async getCandidates(params: { page?: number; limit?: number; search?: string; status?: string; experienceLevel?: string } = {}) {
    const response = await api.get<ApiResponse<{ candidates: CandidateSummary[]; pagination: any }>>('/company/candidates', { params });
    return response.data.data;
  },

  async toggleShortlist(id: string): Promise<Application> {
    const response = await api.patch<ApiResponse<{ application: Application }>>(`/company/candidates/${id}/shortlist`);
    return response.data.data.application;
  },

  async rejectCandidate(id: string, reason?: string): Promise<Application> {
    const response = await api.patch<ApiResponse<{ application: Application }>>(`/company/candidates/${id}/reject`, { reason });
    return response.data.data.application;
  },

  // Interviews
  async getInterviews(params: { page?: number; limit?: number; search?: string; status?: string; type?: string; language?: string } = {}) {
    const response = await api.get<ApiResponse<{ interviews: CompanyInterview[]; pagination: any }>>('/company/interviews', { params });
    return response.data.data;
  },

  async scheduleInterview(payload: {
    applicationId?: string;
    candidateId?: string;
    jobRole?: string;
    type?: string;
    difficulty?: string;
    language?: string;
    duration?: number;
    scheduledAt?: string;
  }): Promise<CompanyInterview> {
    const response = await api.post<ApiResponse<{ interview: CompanyInterview }>>('/company/interviews/schedule', payload);
    return response.data.data.interview;
  },

  async rescheduleInterview(id: string, scheduledAt: string): Promise<CompanyInterview> {
    const response = await api.patch<ApiResponse<{ interview: CompanyInterview }>>(`/company/interviews/${id}/reschedule`, { scheduledAt });
    return response.data.data.interview;
  },

  async cancelInterview(id: string): Promise<CompanyInterview> {
    const response = await api.patch<ApiResponse<{ interview: CompanyInterview }>>(`/company/interviews/${id}/cancel`);
    return response.data.data.interview;
  },

  async deleteInterview(id: string): Promise<void> {
    await api.delete(`/company/interviews/${id}`);
  },

  async getInterviewResults(id: string): Promise<CompanyInterview> {
    const response = await api.get<ApiResponse<{ interview: CompanyInterview }>>(`/company/interviews/${id}/results`);
    return response.data.data.interview;
  },

  // Assessments
  async getAssessments(params: { page?: number; limit?: number; passFailStatus?: string } = {}) {
    const response = await api.get<ApiResponse<{ assessments: CompanyAssessment[]; pagination: any }>>('/company/assessments', { params });
    return response.data.data;
  },

  async getAssessment(id: string): Promise<CompanyAssessment> {
    const response = await api.get<ApiResponse<{ assessment: CompanyAssessment }>>(`/company/assessments/${id}`);
    return response.data.data.assessment;
  },

  // Settings
  async getCompanySettings(): Promise<CompanyProfile> {
    const response = await api.get<ApiResponse<{ company: CompanyProfile }>>('/company/settings');
    return response.data.data.company;
  },

  async updateCompanyProfile(payload: Partial<CompanyProfile>): Promise<CompanyProfile> {
    const response = await api.put<ApiResponse<{ company: CompanyProfile }>>('/company/settings/profile', payload);
    return response.data.data.company;
  },

  async updateAccountSettings(currentPassword?: string, newPassword?: string): Promise<void> {
    await api.put('/company/settings/account', { currentPassword, newPassword });
  },

  // Security Events (Identity Verification)
  async getSecurityEvents(params: { page?: number; limit?: number; outcome?: string; reviewed?: boolean } = {}) {
    const response = await api.get<ApiResponse<{ events: SecurityEvent[] }> & PaginatedResponse<SecurityEvent>>(
      '/company/security-events',
      { params }
    );
    return { events: response.data.data.events, pagination: response.data.pagination };
  },

  async reviewSecurityEvent(id: string): Promise<SecurityEvent> {
    const response = await api.patch<ApiResponse<{ event: SecurityEvent }>>(`/company/security-events/${id}/review`);
    return response.data.data.event;
  },
};

export default companyService;
