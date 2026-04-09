import api from './api';
import { User, UpdateProfilePayload, DashboardStats } from '@/types/user';
import { ApiResponse } from '@/types/api';

const userService = {
  async getProfile(): Promise<User> {
    const res = await api.get<ApiResponse<{ user: User }>>('/users/profile');
    return res.data.data.user;
  },

  async updateProfile(payload: UpdateProfilePayload): Promise<User> {
    const res = await api.put<ApiResponse<{ user: User }>>('/users/profile', payload);
    return res.data.data.user;
  },

  async updateAvatar(file: File): Promise<User> {
    const formData = new FormData();
    formData.append('avatar', file);
    const res = await api.put<ApiResponse<{ user: User }>>('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.user;
  },

  async getDashboard(): Promise<DashboardStats> {
    const res = await api.get<ApiResponse<DashboardStats>>('/users/dashboard');
    return res.data.data;
  },
};

export default userService;
