import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IRootState } from '../../store';
import ReactApexChart from 'react-apexcharts';
import { setPageTitle } from '../../store/themeConfigSlice';
import feedbackService from '../../services/feedbackService';
import { UserProgress, ProgressPeriod } from '../../types/feedback';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Info, TrendingUp, Star, CheckCheck, Users } from 'lucide-react';

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
        if (!progress?.timeline?.length) return { dates: [], scores: [], technical: [], communication: [] };
        const timeline = progress.timeline;
        return {
            dates: timeline.map((item) => new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            scores: timeline.map((item) => item.overallScore),
            technical: timeline.map((item) => item.categories?.technicalAccuracy?.score || 0),
            communication: timeline.map((item) => item.categories?.communication?.score || 0),
        };
    }, [progress]);

    const timelineChart: any = {
        series: [
            {
                name: 'Overall Score',
                data: timelineData.scores,
            },
            {
                name: 'Technical Accuracy',
                data: timelineData.technical,
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
            colors: ['#EE4264', '#e2a03f'],
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

    // Skills Radar/Polar Chart
    const radarChart: any = {
        series: [
            {
                name: 'Level',
                data: progress
                    ? [
                          progress.averages.overall,
                          progress.averages.technicalAccuracy,
                          progress.averages.communication,
                          progress.averages.confidence,
                          progress.averages.problemSolving,
                      ]
                    : [0, 0, 0, 0, 0],
            },
        ],
        options: {
            chart: {
                height: 320,
                type: 'radar',
                fontFamily: 'Nunito, sans-serif',
                toolbar: { show: false },
            },
            colors: ['#009688'],
            labels: ['Overall', 'Technical', 'Communication', 'Confidence', 'Problem Solving'],
            plotOptions: {
                radar: {
                    polygons: {
                        strokeColors: isDark ? '#191E3A' : '#E0E6ED',
                        connectorColors: isDark ? '#191E3A' : '#E0E6ED',
                    },
                },
            },
            yaxis: {
                max: 100,
                tickAmount: 5,
            },
        },
    };

    // Construct insight items from recent feedback improvements
    const insightsList = useMemo(() => {
        if (!progress?.recentInsights?.length) return [];
        return progress.recentInsights.flatMap((insight) =>
            (insight.improvements || []).map((imp) => ({
                category: insight.interview?.title || 'Session feedback',
                description: imp,
            }))
        ).slice(0, 5);
    }, [progress]);

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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
                        <span className="text-xs font-bold text-white-dark uppercase tracking-widest">Technical Skill</span>
                        <div className="text-2xl font-extrabold dark:text-white-light mt-1">{progress?.averages.technicalAccuracy ?? 0}%</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-warning/10 text-warning flex items-center justify-center">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                </div>

                <div className="panel flex items-center justify-between p-6">
                    <div>
                        <span className="text-xs font-bold text-white-dark uppercase tracking-widest">Communication</span>
                        <div className="text-2xl font-extrabold dark:text-white-light mt-1">{progress?.averages.communication ?? 0}%</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-success/10 text-success flex items-center justify-center">
                        <CheckCheck className="w-5 h-5" />
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
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                <div className="panel xl:col-span-2">
                    <h5 className="font-semibold text-lg dark:text-white-light mb-4">Score Trends Over Time</h5>
                    {timelineData.scores.length === 0 ? (
                        <div className="h-[360px] flex items-center justify-center text-white-dark">
                            No sessions found in the selected period.
                        </div>
                    ) : (
                        <ReactApexChart options={timelineChart.options} series={timelineChart.series} type="area" height={360} />
                    )}
                </div>

                <div className="panel">
                    <h5 className="font-semibold text-lg dark:text-white-light mb-4">Competency Breakdown</h5>
                    <div className="flex justify-center">
                        <ReactApexChart options={radarChart.options} series={radarChart.series} type="radar" height={320} className="w-full" />
                    </div>
                </div>
            </div>

            {/* Focus areas and weak spots */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="panel">
                    <h5 className="font-semibold text-lg dark:text-white-light mb-4">Key Improvement Areas</h5>
                    {insightsList.length === 0 ? (
                        <div className="py-8 text-center text-white-dark">
                            Awesome! No weakness alerts identified. Keep practicing!
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {insightsList.map((w, idx) => (
                                <div key={idx} className="flex gap-4 p-4 rounded-lg bg-gray-50 dark:bg-black/20 border border-white-light dark:border-white-light/10">
                                    <div className="w-8 h-8 rounded-full bg-danger/10 text-danger font-bold flex items-center justify-center shrink-0">
                                        !
                                    </div>
                                    <div>
                                        <h6 className="font-bold text-sm dark:text-white-light capitalize mb-1">{w.category}</h6>
                                        <p className="text-xs text-white-dark leading-relaxed">{w.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="panel">
                    <h5 className="font-semibold text-lg dark:text-white-light mb-4">Domain Activity</h5>
                    {!progress?.domainActivity?.length ? (
                        <div className="py-8 text-center text-white-dark">
                            No domain-specific records. Create interview sessions to view domain score mappings.
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table-hover">
                                <thead>
                                    <tr>
                                        <th>Domain / Job Role</th>
                                        <th>Interviews Session Count</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {progress.domainActivity.map((item) => (
                                        <tr key={item.domain}>
                                            <td className="font-bold capitalize">{item.domain.replace(/_/g, ' ')}</td>
                                            <td className="text-primary font-bold">{item.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
