import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function RoleProtectedRoute({ children, role, loginPath }: { children: React.ReactNode; role: string; loginPath: string }) {
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const token = localStorage.getItem('accessToken');
  if (!token || !isAuthenticated || !user || user.role !== role) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
