import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState } from '../../store';
import ReactApexChart from 'react-apexcharts';
import { setPageTitle } from '../../store/themeConfigSlice';
import feedbackService from '../../services/feedbackService';
import { UserProgress, ProgressPeriod } from '../../types/feedback';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Info, Star, Users } from 'lucide-react';

const PERIOD_MAP: Record<string, ProgressPeriod> = { '1W': '7d', '1M': '30d', '1Y': '365d' };

const AnalyticsPage = () => {
    const dispatch = useDispatch();
    const [periodKey, setPeriodKey] = useState<'1W' | '1M' | '1Y'>('1M');
    const [progress, setProgress] = useState<UserProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isDark = useSelector((state: IRootState) => state.themeConfig.theme === 'dark' || state.themeConfig.isDarkMode);

    useEffect(() => {
        dispatch(setPageTitle('Progress Analytics | InterviewAI'));
    }, [dispatch]);

    useEffect(() => {
        setLoading(true);
        feedbackService
            .getUserProgress(PERIOD_MAP[periodKey])
            .then(setProgress)
            .catch(() => setError('Failed to load performance analytics.'))
            .finally(() => setLoading(false));
    }, [periodKey]);

    // Timeline Area Chart
    const timelineData = useMemo(() => {
        if (!progress?.timeline?.length) return { dates: [], scores: [] };
        const timeline = progress.timeline;
        return {
            dates: timeline.map((item) => new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            scores: timeline.map((item) => item.overallScore),
        };
    }, [progress]);

    const timelineChart: any = {
        series: [
            {
                name: 'Overall Score',
                data: timelineData.scores,
            },
        ],
        options: {
            chart: {
                height: 360,
                type: 'area',
                fontFamily: 'Nunito, sans-serif',
                toolbar: { show: false },
            },
            stroke: { show: true, curve: 'smooth', width: 2.5 },
            colors: ['#EE4264'],
            dataLabels: { enabled: false },
            xaxis: {
                categories: timelineData.dates,
                axisBorder: { show: false },
                axisTicks: { show: false },
            },
            yaxis: {
                min: 0,
                max: 100,
            },
            grid: {
                borderColor: isDark ? '#191E3A' : '#E0E6ED',
                strokeDashArray: 5,
            },
            legend: {
                position: 'top',
                horizontalAlign: 'right',
            },
        },
    };

    if (loading && !progress) {
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
        <div>
            {/* Header / Period switcher */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold dark:text-white-light">Progress Analytics</h2>
                    <p className="text-white-dark mt-1">Detailed view of your interview skill progression.</p>
                </div>
                <div className="inline-flex rounded-md shadow-sm">
                    {(['1W', '1M', '1Y'] as const).map((range) => (
                        <button
                            key={range}
                            type="button"
                            className={`px-4 py-2 text-sm font-semibold border ${
                                periodKey === range
                                    ? 'bg-primary text-white border-primary'
                                    : 'bg-white dark:bg-black text-gray-700 dark:text-white-dark border-gray-300 dark:border-white-light/10 hover:bg-gray-100 dark:hover:bg-dark'
                            } ${range === '1W' ? 'rounded-l-md' : ''} ${range === '1Y' ? 'rounded-r-md' : ''}`}
                            onClick={() => setPeriodKey(range)}
                        >
                            {range === '1W' ? '1 Week' : range === '1M' ? '1 Month' : '1 Year'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Performance Averages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <div className="panel flex items-center justify-between p-6">
                    <div>
                        <span className="text-xs font-bold text-white-dark uppercase tracking-widest">Average Score</span>
                        <div className="text-2xl font-extrabold dark:text-white-light mt-1">{progress?.averages.overall ?? 0}%</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Star className="w-5 h-5" />
                    </div>
                </div>

                <div className="panel flex items-center justify-between p-6">
                    <div>
                        <span className="text-xs font-bold text-white-dark uppercase tracking-widest">Sessions Reviewed</span>
                        <div className="text-2xl font-extrabold dark:text-white-light mt-1">{progress?.totalInterviewsReviewed ?? 0}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-info/10 text-info flex items-center justify-center">
                        <Users className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Performance charts */}
            <div className="panel mb-6">
                <h5 className="font-semibold text-lg dark:text-white-light mb-4">Score Trends Over Time</h5>
                {timelineData.scores.length === 0 ? (
                    <div className="h-[360px] flex items-center justify-center text-white-dark">
                        No sessions found in the selected period.
                    </div>
                ) : (
                    <ReactApexChart options={timelineChart.options} series={timelineChart.series} type="area" height={360} />
                )}
            </div>
        </div>
    );
};

export default AnalyticsPage;
