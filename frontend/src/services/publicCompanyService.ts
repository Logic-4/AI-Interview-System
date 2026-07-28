import api from './api';
import { ApiResponse } from '@/types/api';
import { CompanyProfile, Job } from '@/types/companyPortal';

export interface PublicCompanyData {
  company: CompanyProfile;
}

export interface PublicCompanyJobsData {
  jobs: Job[];
  total: number;
}

export interface PublicJobDetailsData {
  job: Job;
}

export interface JobApplicationPayload {
  fullName: string;
  email: string;
  phone: string;
  profilePhotoUrl?: string;
  resumeUrl?: string;
  coverLetter?: string;
  selectedInterviewDate?: string;
  selectedInterviewTime?: string;
}

const publicCompanyService = {
  async getPublicCompany(companyId: string): Promise<CompanyProfile> {
    const response = await api.get<ApiResponse<PublicCompanyData>>(`/public/companies/${companyId}`);
    return response.data.data.company;
  },

  async getPublicCompanyJobs(companyId: string): Promise<Job[]> {
    const response = await api.get<ApiResponse<PublicCompanyJobsData>>(`/public/companies/${companyId}/jobs`);
    return response.data.data.jobs;
  },

  async getPublicJobDetails(jobId: string): Promise<Job> {
    const response = await api.get<ApiResponse<PublicJobDetailsData>>(`/public/companies/jobs/${jobId}`);
    return response.data.data.job;
  },

  async submitJobApplication(jobId: string, payload: JobApplicationPayload): Promise<any> {
    const response = await api.post<ApiResponse<any>>(`/public/companies/jobs/${jobId}/apply`, payload);
    return response.data.data;
  },
};

export default publicCompanyService;
