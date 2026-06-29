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
const DemoReportPage = lazy(() => import('../pages/dashboard/DemoReportPage'));
const DemoReviewPage = lazy(() => import('../pages/dashboard/DemoReviewPage'));
const InterviewDetailsPage = lazy(() => import('../pages/dashboard/InterviewDetailsPage'));
const InterviewReportPage = lazy(() => import('../pages/dashboard/InterviewReportPage'));
const InterviewReviewPage = lazy(() => import('../pages/dashboard/InterviewReviewPage'));
const AnalyticsPage = lazy(() => import('../pages/dashboard/AnalyticsPage'));
const BillingPage = lazy(() => import('../pages/dashboard/BillingPage'));
const ProfilePage = lazy(() => import('../pages/dashboard/ProfilePage'));
const SettingsPage = lazy(() => import('../pages/dashboard/SettingsPage'));
const QuestionsPage = lazy(() => import('../pages/dashboard/QuestionsPage'));
const StudyPlanPage = lazy(() => import('../pages/dashboard/StudyPlanPage'));
const StudyPlanDetailPage = lazy(() => import('../pages/dashboard/StudyPlanDetailPage'));
const AchievementsPage = lazy(() => import('../pages/dashboard/AchievementsPage'));
const LeaderboardPage = lazy(() => import('../pages/dashboard/LeaderboardPage'));

const PreparationPage = lazy(() => import('../pages/mock/PreparationPage'));
const ProcessingPage = lazy(() => import('../pages/mock/ProcessingPage'));
const SessionPage = lazy(() => import('../pages/mock/SessionPage'));

const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const AdminAnalyticsPage = lazy(() => import('../pages/admin/AdminAnalyticsPage'));
const AdminQuestionsPage = lazy(() => import('../pages/admin/AdminQuestionsPage'));
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage'));

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
    {
        path: '/preparation',
        element: <PreparationPage />,
        layout: 'blank',
    },
    {
        path: '/processing',
        element: <ProcessingPage />,
        layout: 'blank',
    },
    {
        path: '/session',
        element: <SessionPage />,
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
        path: '/interviews/demo/report',
        element: <DemoReportPage />,
        layout: 'default',
    },
    {
        path: '/interviews/demo/review',
        element: <DemoReviewPage />,
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
        path: '/billing',
        element: <BillingPage />,
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
    {
        path: '/study-plan',
        element: <StudyPlanPage />,
        layout: 'default',
    },
    {
        path: '/study-plan/:id',
        element: <StudyPlanDetailPage />,
        layout: 'default',
    },
    {
        path: '/achievements',
        element: <AchievementsPage />,
        layout: 'default',
    },
    {
        path: '/leaderboard',
        element: <LeaderboardPage />,
        layout: 'default',
    },
    
    // Admin routes
    {
        path: '/admin/dashboard',
        element: <AdminDashboardPage />,
        layout: 'blank',
    },
    {
        path: '/admin/analytics',
        element: <AdminAnalyticsPage />,
        layout: 'blank',
    },
    {
        path: '/admin/questions',
        element: <AdminQuestionsPage />,
        layout: 'blank',
    },
    {
        path: '/admin/users',
        element: <AdminUsersPage />,
        layout: 'blank',
    },
];

export { routes };
