import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';
import { User } from '@/types/user';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  login: (user: User, accessToken: string, rememberMe?: boolean) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      login: (user, accessToken, rememberMe = false) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
          // Sync with cookie for middleware (expires in 7 days if rememberMe is true, else session only)
          const cookieOptions: any = { secure: true, sameSite: 'strict' };
          if (rememberMe) {
            cookieOptions.expires = 7;
          }
          Cookies.set('accessToken', accessToken, cookieOptions);
        }
        set({ user, isAuthenticated: true });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          Cookies.remove('accessToken');
        }
        set({ user: null, isAuthenticated: false });
      },
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
