import api from './api';
import { User } from '@/types/user';
import { ApiResponse } from '@/types/api';

interface AuthData {
  user: User;
  accessToken: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

const authService = {
  async register(payload: RegisterPayload): Promise<AuthData> {
    const res = await api.post<ApiResponse<AuthData>>('/auth/register', payload);
    return res.data.data;
  },

  async login(payload: LoginPayload): Promise<AuthData> {
    const res = await api.post<ApiResponse<AuthData>>('/auth/login', payload);
    return res.data.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },

  async getMe(): Promise<User> {
    const res = await api.get<ApiResponse<{ user: User }>>('/auth/me');
    return res.data.data.user;
  },

  async validateSession(): Promise<boolean> {
    const res = await api.get<ApiResponse<{ authenticated: boolean }>>('/auth/session');
    return Boolean(res.data.data.authenticated);
  },
};

export default authService;
