import api from './api';
import { ApiResponse } from '@/types/api';
import { SuperadminDashboard } from '@/types/company';
import { User } from '@/types/user';

interface AuthData { user: User; accessToken: string; }

export type SystemUserRole = 'user' | 'company' | 'admin';
export interface SystemUser { _id: string; name: string; email: string; role: SystemUserRole; accountStatus: 'active' | 'disabled'; lastLogin?: string; createdAt?: string; }
export interface SystemUserPayload { name: string; email: string; password: string; role?: 'user' | 'company'; status?: 'active' | 'disabled'; }
interface UsersResponse { users: SystemUser[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }

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

  async listUsers(params: { page?: number; limit?: number; search?: string; role?: string; status?: string } = {}): Promise<UsersResponse> {
    const response = await api.get<ApiResponse<UsersResponse>>('/superadmin/users', { params });
    return response.data.data;
  },
  async createUser(payload: SystemUserPayload): Promise<SystemUser> {
    const response = await api.post<ApiResponse<{ user: SystemUser }>>('/superadmin/users', payload);
    return response.data.data.user;
  },
  async updateUser(id: string, payload: Pick<SystemUserPayload, 'name' | 'email' | 'role'>): Promise<SystemUser> {
    const response = await api.put<ApiResponse<{ user: SystemUser }>>(`/superadmin/users/${id}`, payload);
    return response.data.data.user;
  },
  async updateUserStatus(id: string, status: 'active' | 'disabled'): Promise<void> {
    await api.patch(`/superadmin/users/${id}/status`, { status });
  },
  async resetUserPassword(id: string, password: string): Promise<void> {
    await api.post(`/superadmin/users/${id}/reset-password`, { password });
  },
  async deleteUser(id: string): Promise<void> { await api.delete(`/superadmin/users/${id}`); },
};

export default superadminService;
