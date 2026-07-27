import api from './api';
import { ApiResponse } from '@/types/api';
import { Company, CompanyPayload, CompanyStatus, SuperadminDashboard } from '@/types/company';
import { User } from '@/types/user';

interface AuthData { user: User; accessToken: string; }
interface CompaniesResponse { companies: Company[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }

const superadminService = {
  async login(email: string, password: string, rememberMe = false): Promise<AuthData> {
    const response = await api.post<ApiResponse<AuthData>>('/superadmin/auth/login', { email, password, rememberMe });
    return response.data.data;
  },
  async dashboard(): Promise<SuperadminDashboard> {
    const response = await api.get<ApiResponse<SuperadminDashboard>>('/superadmin/dashboard');
    return response.data.data;
  },
  async getProfile(): Promise<User> {
    const response = await api.get<ApiResponse<{ user: User }>>('/superadmin/settings/profile');
    return response.data.data.user;
  },
  async updateProfile(payload: { name: string; email: string }): Promise<User> {
    const response = await api.put<ApiResponse<{ user: User }>>('/superadmin/settings/profile', payload);
    return response.data.data.user;
  },
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.put('/superadmin/settings/password', { currentPassword, newPassword });
  },
  async listCompanies(params: { page?: number; limit?: number; search?: string; status?: string } = {}): Promise<CompaniesResponse> {
    const response = await api.get<ApiResponse<CompaniesResponse>>('/superadmin/companies', { params });
    return response.data.data;
  },
  async getCompany(id: string): Promise<Company> {
    const response = await api.get<ApiResponse<{ company: Company }>>(`/superadmin/companies/${id}`);
    return response.data.data.company;
  },
  async createCompany(payload: CompanyPayload): Promise<Company> {
    const response = await api.post<ApiResponse<{ company: Company }>>('/superadmin/companies', payload);
    return response.data.data.company;
  },
  async updateCompany(id: string, payload: CompanyPayload): Promise<Company> {
    const response = await api.put<ApiResponse<{ company: Company }>>(`/superadmin/companies/${id}`, payload);
    return response.data.data.company;
  },
  async updateStatus(id: string, status: CompanyStatus): Promise<void> {
    await api.patch(`/superadmin/companies/${id}/status`, { status });
  },
  async resetPassword(id: string, password: string): Promise<void> {
    await api.post(`/superadmin/companies/${id}/reset-password`, { password });
  },
  async deleteCompany(id: string): Promise<void> { await api.delete(`/superadmin/companies/${id}`); },
};

export default superadminService;
