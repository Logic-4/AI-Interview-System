import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('accessToken');
  const { user } = useAuthStore();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Redirect company users attempting to access candidate-only routes
  const isCompany = user?.role === 'company' || (user?.role === 'admin' && (user as any)?.company);
  if (isCompany) {
    return <Navigate to="/company/dashboard" replace />;
  }

  // Redirect superadmins attempting to access candidate-only routes
  if (user?.role === 'superadmin') {
    return <Navigate to="/superadmin/dashboard" replace />;
  }

  return <>{children}</>;
}
