import { createBrowserRouter } from 'react-router-dom';
import BlankLayout from '../components/Layouts/BlankLayout';
import DefaultLayout from '../components/Layouts/DefaultLayout';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import GuestRoute from '../components/auth/GuestRoute';
import { routes } from './routes';

const PROTECTED_PATHS = [
  '/dashboard',
  '/interviews',
  '/analytics',
  '/profile',
  '/settings',
  '/questions'
];

const GUEST_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

const finalRoutes = routes.map((route) => {
    let element = route.element;
    
    const isProtected = PROTECTED_PATHS.some((p) => route.path === p || route.path.startsWith(p + '/'));
    const isGuest = GUEST_PATHS.some((p) => route.path === p || route.path.startsWith(p + '/'));
    
    if (isProtected) {
        element = <ProtectedRoute>{element}</ProtectedRoute>;
    } else if (isGuest) {
        element = <GuestRoute>{element}</GuestRoute>;
    }

    return {
        ...route,
        element: route.layout === 'blank' ? <BlankLayout>{element}</BlankLayout> : <DefaultLayout>{element}</DefaultLayout>,
    };
});

const router = createBrowserRouter(finalRoutes);

export default router;
