import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ReactApexChart from 'react-apexcharts';
import { Building2, CirclePause, Users } from 'lucide-react';
import { setPageTitle } from '@/store/themeConfigSlice';
import { IRootState } from '@/store';
import superadminService from '@/services/superadminService';
import { SuperadminDashboard } from '@/types/company';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';
const STATUS_COLORS: Record<string, string> = { active: '#00ab55', suspended: '#e2a03f', disabled: '#e7515a' };
const roleLabel = (role: string) => (role === 'admin' || role === 'company' ? 'Company' : 'User');

const SuperadminDashboardPage = () => {
  const dispatch = useDispatch();
  const isDark = useSelector((state: IRootState) => state.themeConfig.theme === 'dark' || state.themeConfig.isDarkMode);
  const [data, setData] = useState<SuperadminDashboard | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    dispatch(setPageTitle('Superadmin Dashboard | InterviewAI'));
    superadminService.dashboard().then(setData).catch(() => setError(true));
  }, [dispatch]);

  const chart = useMemo(() => {
    const sorted = [...(data?.userStatus ?? [])].sort((a, b) => a._id.localeCompare(b._id));
    return {
      series: sorted.map((item) => item.count),
      options: {
        chart: { type: 'donut', toolbar: { show: false } },
        labels: sorted.map((item) => item._id.replace(/^./, (l) => l.toUpperCase())),
        colors: sorted.map((item) => STATUS_COLORS[item._id] ?? '#4361ee'),
        dataLabels: { enabled: false }, stroke: { width: 0 },
        legend: { position: 'bottom', labels: { colors: isDark ? '#888ea8' : '#3b3f5c' } }, plotOptions: { pie: { donut: { size: '70%' } } },
      },
    };
  }, [data, isDark]);

  if (!data && !error) return <div className="flex h-96 items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (error) return <div className="panel text-center"><p className="text-danger">Unable to load platform statistics.</p><button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Retry</button></div>;

  const cards = [
    { label: 'Total Users', value: data!.metrics.totalCandidates, icon: Users, iconClass: 'text-primary' },
    { label: 'Active Users', value: data!.metrics.activeUsers, icon: Users, iconClass: 'text-success' },
    { label: 'Disabled Users', value: data!.metrics.disabledUsers, icon: CirclePause, iconClass: 'text-warning' },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-black dark:text-white">Platform Overview</h1><p className="mt-1 text-sm text-white-dark">Monitor companies and users across the platform.</p></div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, iconClass }) => <div className="panel" key={label}><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-white-dark">{label}</p><h3 className="mt-2 text-2xl font-bold text-black dark:text-white">{value}</h3></div><span className={iconClass}><Icon className="h-6 w-6" /></span></div></div>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="panel xl:col-span-2"><div className="mb-5"><h2 className="text-lg font-bold text-black dark:text-white">Recent User Registrations</h2><p className="text-sm text-white-dark">Latest accounts added to the platform</p></div><div className="table-responsive"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>{data!.recentUsers.length ? data!.recentUsers.map((user) => <tr key={user._id}><td><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center bg-primary/10 text-primary"><Users className="h-4 w-4" /></span><span className="font-semibold">{user.name}</span></div></td><td>{user.email}</td><td>{roleLabel(user.role)}</td><td><span className={`badge badge-outline-${user.accountStatus === 'active' ? 'success' : 'danger'}`}>{user.accountStatus}</span></td><td>{formatDate(user.createdAt)}</td></tr>) : <tr><td colSpan={5} className="py-10 text-center text-white-dark">No users registered yet.</td></tr>}</tbody></table></div></div>
        <div className="panel"><h2 className="text-lg font-bold text-black dark:text-white">User Status</h2><p className="text-sm text-white-dark">Current account distribution</p>{chart.series.length ? <ReactApexChart type="donut" height={255} series={chart.series} options={chart.options as any} /> : <div className="flex h-56 items-center justify-center text-sm text-white-dark">No user data yet.</div>}</div>
      </div>
    </div>
  );
};

export default SuperadminDashboardPage;
