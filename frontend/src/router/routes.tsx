import { lazy, ComponentType } from 'react';
import SuperadminEntryRoute from '../components/auth/SuperadminEntryRoute';

/**
 * Resilient lazy loader that retries dynamic chunk imports.
 * Automatically handles transient network drops, CDN timeouts, or new deployments.
 */
const lazyWithRetry = <T extends ComponentType<any>>(
    componentImport: () => Promise<{ default: T }>
) =>
    lazy(async () => {
        const pageRefreshed = JSON.parse(
            window.sessionStorage.getItem('lazy_retry_refreshed') || 'false'
        );
        try {
            const component = await componentImport();
            window.sessionStorage.setItem('lazy_retry_refreshed', 'false');
            return component;
        } catch (error) {
            if (!pageRefreshed) {
                window.sessionStorage.setItem('lazy_retry_refreshed', 'true');
                window.location.reload();
                return new Promise<{ default: T }>(() => {});
            }
            window.sessionStorage.setItem('lazy_retry_refreshed', 'false');
            throw error;
        }
    });

const LandingPage = lazyWithRetry(() => import('../pages/LandingPage'));
const LoginPage = lazyWithRetry(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazyWithRetry(() => import('../pages/auth/RegisterPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('../pages/auth/ResetPasswordPage'));
const AuthCallbackPage = lazyWithRetry(() => import('../pages/auth/AuthCallbackPage'));
const MaintenancePage = lazyWithRetry(() => import('../pages/MaintenancePage'));
const SuperadminLoginPage = lazyWithRetry(() => import('../pages/superadmin/SuperadminLoginPage'));
const SuperadminDashboardPage = lazyWithRetry(() => import('../pages/superadmin/SuperadminDashboardPage'));
const CompaniesPage = lazyWithRetry(() => import('../pages/superadmin/CompaniesPage'));
const SuperadminSettingsPage = lazyWithRetry(() => import('../pages/superadmin/SuperadminSettingsPage'));

const DashboardPage = lazyWithRetry(() => import('../pages/dashboard/DashboardPage'));
const InterviewsHistoryPage = lazyWithRetry(() => import('../pages/dashboard/InterviewsHistoryPage'));
const NewInterviewPage = lazyWithRetry(() => import('../pages/dashboard/NewInterviewPage'));
const InterviewDetailsPage = lazyWithRetry(() => import('../pages/dashboard/InterviewDetailsPage'));
const InterviewReportPage = lazyWithRetry(() => import('../pages/dashboard/InterviewReportPage'));
const InterviewReviewPage = lazyWithRetry(() => import('../pages/dashboard/InterviewReviewPage'));
const AnalyticsPage = lazyWithRetry(() => import('../pages/dashboard/AnalyticsPage'));
const ProfilePage = lazyWithRetry(() => import('../pages/dashboard/ProfilePage'));
const SettingsPage = lazyWithRetry(() => import('../pages/dashboard/SettingsPage'));

const routes = [
    // Blank Layout routes (Auth, Landing, Mock interview flow)
    {
        path: '/',
        element: <LandingPage />,
        layout: 'blank',
    },
    {
        path: '/maintenance',
        element: <MaintenancePage />,
        layout: 'blank',
    },
    {
        path: '/login',
        element: <LoginPage />,
        layout: 'blank',
    },
    {
        path: '/register',
        element: <RegisterPage />,
        layout: 'blank',
    },
    {
        path: '/forgot-password',
        element: <ForgotPasswordPage />,
        layout: 'blank',
    },
    {
        path: '/reset-password/:token',
        element: <ResetPasswordPage />,
        layout: 'blank',
    },
    {
        path: '/auth/callback',
        element: <AuthCallbackPage />,
        layout: 'blank',
    },
    {
        path: '/superadmin/login',
        element: <SuperadminLoginPage />,
        layout: 'blank',
    },
    {
        path: '/superadmin',
        element: <SuperadminEntryRoute />,
        layout: 'blank',
    },
    
    // Default Layout routes (Dashboard pages)
    {
        path: '/dashboard',
        element: <DashboardPage />,
        layout: 'default',
    },
    {
        path: '/interviews',
        element: <InterviewsHistoryPage />,
        layout: 'default',
    },
    {
        path: '/interviews/new',
        element: <NewInterviewPage />,
        layout: 'default',
    },
    {
        path: '/interviews/:id',
        element: <InterviewDetailsPage />,
        layout: 'default',
    },
    {
        path: '/interviews/:id/report',
        element: <InterviewReportPage />,
        layout: 'default',
    },
    {
        path: '/interviews/:id/review',
        element: <InterviewReviewPage />,
        layout: 'default',
    },
    {
        path: '/analytics',
        element: <AnalyticsPage />,
        layout: 'default',
    },
    {
        path: '/profile',
        element: <ProfilePage />,
        layout: 'default',
    },
    {
        path: '/settings',
        element: <SettingsPage />,
        layout: 'default',
    },
    {
        path: '/superadmin/dashboard',
        element: <SuperadminDashboardPage />,
        layout: 'default',
    },
    {
        path: '/superadmin/companies',
        element: <CompaniesPage />,
        layout: 'default',
    },
    {
        path: '/superadmin/settings',
        element: <SuperadminSettingsPage />,
        layout: 'default',
    },
];

export { routes };
