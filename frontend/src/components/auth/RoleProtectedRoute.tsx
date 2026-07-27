import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function RoleProtectedRoute({
  children,
  role,
  allowedRoles,
  loginPath,
}: {
  children: React.ReactNode;
  role?: string;
  allowedRoles?: string[];
  loginPath: string;
}) {
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const token = localStorage.getItem('accessToken');

  const checkRoles = allowedRoles || (role ? [role] : []);
  const isCompanyUser = user?.role === 'company' || (user?.role === 'admin' && Boolean((user as any)?.company)) || user?.role === 'superadmin';
  const isAllowed = user && (checkRoles.includes(user.role) || (checkRoles.includes('company') && isCompanyUser));

  if (!token || !isAuthenticated || !user || !isAllowed) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
