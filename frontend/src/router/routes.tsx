import { lazy } from 'react';

const LandingPage = lazy(() => import('../pages/LandingPage'));
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage'));
const AuthCallbackPage = lazy(() => import('../pages/auth/AuthCallbackPage'));

const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const InterviewsHistoryPage = lazy(() => import('../pages/dashboard/InterviewsHistoryPage'));
const NewInterviewPage = lazy(() => import('../pages/dashboard/NewInterviewPage'));
const InterviewDetailsPage = lazy(() => import('../pages/dashboard/InterviewDetailsPage'));
const InterviewReportPage = lazy(() => import('../pages/dashboard/InterviewReportPage'));
const InterviewReviewPage = lazy(() => import('../pages/dashboard/InterviewReviewPage'));
const AnalyticsPage = lazy(() => import('../pages/dashboard/AnalyticsPage'));
const ProfilePage = lazy(() => import('../pages/dashboard/ProfilePage'));
const SettingsPage = lazy(() => import('../pages/dashboard/SettingsPage'));
const QuestionsPage = lazy(() => import('../pages/dashboard/QuestionsPage'));

const routes = [
    // Blank Layout routes (Auth, Landing, Mock interview flow)
    {
        path: '/',
        element: <LandingPage />,
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
        path: '/questions',
        element: <QuestionsPage />,
        layout: 'default',
    },
];

export { routes };
