import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

const SuperadminEntryRoute = () => {
  const user = useAuthStore((state) => state.user);
  const token = localStorage.getItem('accessToken');

  return <Navigate to={token && user?.role === 'superadmin' ? '/superadmin/dashboard' : '/superadmin/login'} replace />;
};

export default SuperadminEntryRoute;
