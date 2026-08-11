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
  resumeText?: string;
  coverLetter?: string;
  selectedInterviewDate?: string;
  selectedInterviewTime?: string;
}

export interface BlobUploadResult {
  url: string;
  resumeText?: string;
}

const publicCompanyService = {
  async getPublicCompany(companyId: string): Promise<CompanyProfile> {
    const response = await api.get<ApiResponse<PublicCompanyData>>(`/public/companies/${companyId}`);
    return response.data.data.company;
  },

  async getAllPublicJobs(): Promise<Job[]> {
    const response = await api.get<ApiResponse<PublicCompanyJobsData>>('/public/companies/jobs');
    return response.data.data.jobs;
  },

  async getPublicCompanyJobs(companyId: string): Promise<Job[]> {
    const response = await api.get<ApiResponse<PublicCompanyJobsData>>(`/public/companies/${companyId}/jobs`);
    return response.data.data.jobs;
  },

  async getPublicJobDetails(jobId: string): Promise<Job> {
    const response = await api.get<ApiResponse<PublicJobDetailsData>>(`/public/companies/jobs/${jobId}`);
    return response.data.data.job;
  },

  async uploadBlobFile(file: File, folder: string = 'candidates'): Promise<BlobUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const response = await api.post<ApiResponse<BlobUploadResult>>('/public/companies/upload-blob', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data;
  },

  async submitJobApplication(jobId: string, payload: JobApplicationPayload): Promise<any> {
    const response = await api.post<ApiResponse<any>>(`/public/companies/jobs/${jobId}/apply`, payload);
    return response.data.data;
  },
};

export default publicCompanyService;
