import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState } from '../../store';
import ReactApexChart from 'react-apexcharts';
import PerfectScrollbar from 'react-perfect-scrollbar';
import { setPageTitle } from '../../store/themeConfigSlice';
import { useAuthStore } from '../../stores/authStore';
import userService from '../../services/userService';
import { DashboardStats } from '../../types/user';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

import { Plus, Folder, Star, CheckCheck, Info, TrendingUp, Trophy } from 'lucide-react';

const DAILY_TIPS = [
    { title: 'STAR Method', body: 'Structure answers using STAR: Situation, Task, Action, and Result.' },
    { title: 'Think Out Loud', body: 'Narrate your thought process so the interviewer understands your problem-solving.' },
    { title: 'Ask Questions', body: 'Always prepare thoughtful questions for the end of the interview.' },
    { title: 'Prepare Stories', body: 'Keep 5-7 adaptable professional stories ready for behavioral questions.' },
    { title: 'Research Culture', body: 'Align your answers with the company\'s core principles and culture.' },
];

function getDailyTip() {
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % DAILY_TIPS.length;
    return DAILY_TIPS[dayIndex];
}

const DashboardPage = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [dashData, setDashData] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        dispatch(setPageTitle('Dashboard | InterviewAI'));
        userService
            .getDashboard()
            .then(setDashData)
            .catch(() => setError('Failed to load dashboard statistics.'))
            .finally(() => setLoading(false));
    }, [dispatch]);

    const isDark = useSelector((state: IRootState) => state.themeConfig.theme === 'dark' || state.themeConfig.isDarkMode);

    const tip = getDailyTip();
    const firstName = user?.name?.split(' ')[0] ?? 'Professional';

    // Chart Series
    const scoreTrendData = useMemo(() => {
        if (!dashData?.scoreTrend?.length) return { labels: [], scores: [] };
        const trends = dashData.scoreTrend.slice(-10);
        return {
            labels: trends.map((_, idx) => `Session #${idx + 1}`),
            scores: trends.map((t) => t.overallScore),
        };
    }, [dashData]);

    const chartOptions: any = {
        series: [
            {
                name: 'Overall Score',
                data: scoreTrendData.scores,
            },
        ],
        options: {
            chart: {
                height: 325,
                type: 'area',
                fontFamily: 'Inter, sans-serif',
                zoom: { enabled: false },
                toolbar: { show: false },
            },
            dataLabels: { enabled: false },
            stroke: { show: true, curve: 'smooth', width: 3 },
            colors: ['#EE4264'],
            grid: {
                borderColor: isDark ? '#191E3A' : '#E8ECF2',
                strokeDashArray: 5,
                xaxis: { lines: { show: true } },
                yaxis: { lines: { show: false } },
            },
            xaxis: {
                categories: scoreTrendData.labels,
                axisBorder: { show: false },
                axisTicks: { show: false },
                labels: {
                    style: {
                        colors: isDark ? '#888ea8' : '#697386',
                        fontFamily: 'Inter, sans-serif',
                    }
                }
            },
            yaxis: {
                min: 0,
                max: 100,
                tickAmount: 5,
                labels: {
                    style: {
                        colors: isDark ? '#888ea8' : '#697386',
                        fontFamily: 'Inter, sans-serif',
                    }
                }
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.4,
                    opacityTo: 0.05,
                    stops: [0, 100],
                },
            },
            tooltip: {
                theme: isDark ? 'dark' : 'light',
                style: {
                    fontSize: '12px',
                    fontFamily: 'Inter, sans-serif',
                },
            },
        },
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="text-danger flex items-center gap-2">
                    <Info className="w-6 h-6" />
                    <span>{error}</span>
                </div>
                <button className="btn btn-primary" onClick={() => window.location.reload()}>
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header banner */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-[#1E2433] dark:text-white leading-tight">Welcome back, {firstName}!</h1>
                    <p className="text-[#697386] dark:text-white-dark mt-1 font-medium text-sm">
                        {(dashData?.overview.completedInterviews ?? 0) > 0
                            ? `You've completed ${dashData!.overview.completedInterviews} interviews. Let's keep leveling up your skills!`
                            : 'Set up your first interview session to start tracking performance.'}
                    </p>
                </div>
                <Link to="/interviews/new" className="btn btn-primary flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Start New Interview
                </Link>
            </div>

            {/* Stats widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* Total Interviews */}
                <div className="panel bg-white border border-[#E8ECF2] shadow-card rounded-2xl p-6 flex flex-col justify-between dark:bg-[#0e1726] dark:border-white-light/10">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold text-[#697386] dark:text-white-dark uppercase tracking-wider leading-none whitespace-nowrap">Total Sessions</p>
                            <div className="text-3xl font-extrabold text-[#1E2433] dark:text-white-light mt-2">{dashData?.overview.totalInterviews ?? 0}</div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <Folder className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-[11px] text-[#697386] dark:text-white-dark mt-4 font-semibold">
                        Active sessions: <span className="text-[#1E2433] dark:text-white-light">{dashData?.overview.inProgressInterviews ?? 0}</span>
                    </div>
                </div>

                {/* Average Score */}
                <div className="panel bg-white border border-[#E8ECF2] shadow-card rounded-2xl p-6 flex flex-col justify-between dark:bg-[#0e1726] dark:border-white-light/10">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold text-[#697386] dark:text-white-dark uppercase tracking-wider leading-none whitespace-nowrap">Average Score</p>
                            <div className="text-3xl font-extrabold text-[#1E2433] dark:text-white-light mt-2">
                                {dashData?.scores.average ?? 0} <span className="text-base font-medium text-[#697386]">/ 100</span>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <Star className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-[11px] text-[#697386] dark:text-white-dark mt-4 font-semibold">
                        Total reviewed: <span className="text-[#1E2433] dark:text-white-light">{dashData?.scores.totalReviewed ?? 0}</span>
                    </div>
                </div>

                {/* Completed */}
                <div className="panel bg-white border border-[#E8ECF2] shadow-card rounded-2xl p-6 flex flex-col justify-between dark:bg-[#0e1726] dark:border-white-light/10">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold text-[#697386] dark:text-white-dark uppercase tracking-wider leading-none whitespace-nowrap">Completed</p>
                            <div className="text-3xl font-extrabold text-[#1E2433] dark:text-white-light mt-2">{dashData?.overview.completedInterviews ?? 0}</div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-success/10 text-success flex items-center justify-center">
                            <CheckCheck className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-[11px] text-[#697386] dark:text-white-dark mt-4 font-semibold">
                        Practice runs: <span className="text-[#1E2433] dark:text-white-light">{dashData?.recentInterviews?.length ?? 0}</span>
                    </div>
                </div>

                {/* Highest Score */}
                <div className="panel bg-white border border-[#E8ECF2] shadow-card rounded-2xl p-6 flex flex-col justify-between dark:bg-[#0e1726] dark:border-white-light/10">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-bold text-[#697386] dark:text-white-dark uppercase tracking-wider leading-none whitespace-nowrap">Highest Score</p>
                            <div className="text-3xl font-extrabold text-[#1E2433] dark:text-white-light mt-2">
                                {dashData?.scores.highest ?? 0} <span className="text-base font-medium text-[#697386]">/ 100</span>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-warning/10 text-warning flex items-center justify-center">
                            <Trophy className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="text-[11px] text-[#697386] dark:text-white-dark mt-4 font-semibold">
                        Lowest score: <span className="text-[#1E2433] dark:text-white-light">{dashData?.scores.lowest ?? 0}</span>
                    </div>
                </div>
            </div>

            {/* Visual Analytics / Scores Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="panel xl:col-span-2 bg-white border border-[#E8ECF2] shadow-card rounded-2xl p-6 dark:bg-[#0e1726] dark:border-white-light/10">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-lg text-[#1E2433] dark:text-white">Performance History</h3>
                        <span className="badge badge-outline-primary flex items-center gap-1.5 px-3 py-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Trend
                        </span>
                    </div>
                    {scoreTrendData.scores.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-[#697386] dark:text-white-dark italic text-sm">
                            No performance scores recorded yet. Complete an interview to generate a trend.
                        </div>
                    ) : (
                        <ReactApexChart options={chartOptions.options} series={chartOptions.series} type="area" height={325} />
                    )}
                </div>

                <div className="panel flex flex-col justify-between bg-white border border-[#E8ECF2] shadow-card rounded-2xl p-6 dark:bg-[#0e1726] dark:border-white-light/10">
                    <div>
                        <h3 className="font-bold text-lg text-[#1E2433] dark:text-white mb-4">Daily Interview Tip</h3>
                        <div className="bg-primary-light dark:bg-primary-dark-light border border-primary/10 p-5 rounded-xl text-primary">
                            <h4 className="font-bold text-base mb-1.5 text-[#EE4264]">{tip.title}</h4>
                            <p className="text-sm text-[#697386] dark:text-white-light leading-relaxed font-medium">{tip.body}</p>
                        </div>
                    </div>
                    <div className="border-t border-[#E8ECF2] dark:border-white-light/10 pt-5 mt-5">
                        <h5 className="font-bold text-sm text-[#1E2433] dark:text-white mb-2 uppercase tracking-wider">Practice Plan</h5>
                        <p className="text-xs text-[#697386] dark:text-white-dark leading-relaxed font-medium">
                            Structured AI evaluations pinpoint weaknesses across Communication, Problem Solving, and Technical accuracy.
                        </p>
                        <Link to="/study-plan" className="btn btn-outline-secondary btn-sm mt-4 w-full h-10 flex items-center justify-center">
                            View Study Plan
                        </Link>
                    </div>
                </div>
            </div>

            {/* Recent Interviews Table */}
            <div className="panel bg-white border border-[#E8ECF2] shadow-card rounded-2xl p-6 dark:bg-[#0e1726] dark:border-white-light/10">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-lg text-[#1E2433] dark:text-white">Recent Sessions</h3>
                    <Link to="/interviews" className="text-primary hover:text-primary-hover font-bold text-sm transition-colors">
                        View All
                    </Link>
                </div>
                {!dashData?.recentInterviews?.length ? (
                    <div className="py-8 text-center text-[#697386] dark:text-white-dark italic text-sm">
                        No recent interviews. Click "Start New Interview" to begin.
                    </div>
                ) : (
                    <div className="table-responsive rounded-xl overflow-hidden border border-[#E8ECF2] dark:border-white-light/10">
                        <table className="w-full text-left border-collapse bg-white dark:bg-black">
                            <thead>
                                <tr className="bg-[#F8F9FC] dark:bg-[#1a2236] border-b border-[#E8ECF2] dark:border-white-light/10">
                                    <th className="px-6 py-4 text-xs font-bold text-[#1E2433] dark:text-white-light uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-xs font-bold text-[#1E2433] dark:text-white-light uppercase tracking-wider">Title</th>
                                    <th className="px-6 py-4 text-xs font-bold text-[#1E2433] dark:text-white-light uppercase tracking-wider">Role / Type</th>
                                    <th className="px-6 py-4 text-xs font-bold text-[#1E2433] dark:text-white-light uppercase tracking-wider">Score</th>
                                    <th className="px-6 py-4 text-xs font-bold text-[#1E2433] dark:text-white-light uppercase tracking-wider text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dashData.recentInterviews.map((iv) => (
                                    <tr key={iv._id} className="border-b border-[#E8ECF2] dark:border-white-light/10 hover:bg-[#FFF6F8] dark:hover:bg-primary-light/5 transition-colors duration-150">
                                        <td className="px-6 py-4 font-semibold text-[#697386] dark:text-white-dark text-sm">
                                            {new Date(iv.createdAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-primary text-sm">{iv.title}</td>
                                        <td className="px-6 py-4 capitalize text-[#697386] dark:text-white-dark text-sm">{iv.type}</td>
                                        <td className="px-6 py-4">
                                            <span className={`badge ${iv.overallScore && iv.overallScore >= 75 ? 'badge-outline-success' : 'badge-outline-warning'}`}>
                                                {iv.overallScore ? `${iv.overallScore} / 100` : 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button className="btn btn-sm btn-outline-primary" onClick={() => navigate(`/interviews/${iv._id}`)}>
                                                View Session
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;
