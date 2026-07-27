import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ReactApexChart from 'react-apexcharts';
import { Building2, BriefcaseBusiness, CirclePause, ClipboardCheck, UsersRound } from 'lucide-react';
import { setPageTitle } from '@/store/themeConfigSlice';
import { IRootState } from '@/store';
import superadminService from '@/services/superadminService';
import { SuperadminDashboard } from '@/types/company';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';

const SuperadminDashboardPage = () => {
  const dispatch = useDispatch();
  const isDark = useSelector((state: IRootState) => state.themeConfig.theme === 'dark' || state.themeConfig.isDarkMode);
  const [data, setData] = useState<SuperadminDashboard | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    dispatch(setPageTitle('Superadmin Dashboard | InterviewAI'));
    superadminService.dashboard().then(setData).catch(() => setError(true));
  }, [dispatch]);

  const chart = useMemo(() => ({
    series: data?.companyStatus.map((item) => item.count) || [],
    options: {
      chart: { type: 'donut', toolbar: { show: false } },
      labels: data?.companyStatus.map((item) => item._id.replace(/^./, (letter) => letter.toUpperCase())) || [],
      colors: ['#4361ee', '#e2a03f', '#e7515a'], dataLabels: { enabled: false }, stroke: { width: 0 },
      legend: { position: 'bottom', labels: { colors: isDark ? '#888ea8' : '#3b3f5c' } }, plotOptions: { pie: { donut: { size: '70%' } } },
    },
  }), [data, isDark]);

  if (!data && !error) return <div className="flex h-96 items-center justify-center"><LoadingSpinner size="lg" /></div>;
  if (error) return <div className="panel text-center"><p className="text-danger">Unable to load platform statistics.</p><button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Retry</button></div>;

  const cards = [
    { label: 'Total Companies', value: data!.metrics.totalCompanies, icon: Building2, iconClass: 'text-primary' },
    { label: 'Active Companies', value: data!.metrics.activeCompanies, icon: Building2, iconClass: 'text-success' },
    { label: 'Suspended Companies', value: data!.metrics.suspendedCompanies, icon: CirclePause, iconClass: 'text-warning' },
    { label: 'Total Candidates', value: data!.metrics.totalCandidates, icon: UsersRound, iconClass: 'text-info' },
    { label: 'Total Interviews', value: data!.metrics.totalInterviews, icon: ClipboardCheck, iconClass: 'text-secondary' },
    { label: 'Total Job Posts', value: data!.metrics.totalJobPosts, icon: BriefcaseBusiness, iconClass: 'text-danger' },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-black dark:text-white">Platform Overview</h1><p className="mt-1 text-sm text-white-dark">Monitor tenants and recruitment activity across the platform.</p></div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, iconClass }) => <div className="panel" key={label}><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-white-dark">{label}</p><h3 className="mt-2 text-2xl font-bold text-black dark:text-white">{value}</h3></div><span className={iconClass}><Icon className="h-6 w-6" /></span></div></div>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="panel xl:col-span-2"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold text-black dark:text-white">Recent Company Registrations</h2><p className="text-sm text-white-dark">Latest tenants added to the platform</p></div><a className="btn btn-outline-primary btn-sm" href="/superadmin/companies">Manage companies</a></div><div className="table-responsive"><table><thead><tr><th>Company</th><th>Administrator</th><th>Status</th><th>Created</th></tr></thead><tbody>{data!.recentCompanies.length ? data!.recentCompanies.map((company) => <tr key={company._id}><td><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></span><span className="font-semibold">{company.name}</span></div></td><td>{company.adminUser?.email || company.contactEmail}</td><td><span className={`badge badge-outline-${company.status === 'active' ? 'success' : company.status === 'suspended' ? 'warning' : 'danger'}`}>{company.status}</span></td><td>{formatDate(company.createdAt)}</td></tr>) : <tr><td colSpan={4} className="py-10 text-center text-white-dark">No companies registered yet.</td></tr>}</tbody></table></div></div>
        <div className="panel"><h2 className="text-lg font-bold text-black dark:text-white">Company Status</h2><p className="text-sm text-white-dark">Current tenant distribution</p>{chart.series.length ? <ReactApexChart type="donut" height={255} series={chart.series} options={chart.options as any} /> : <div className="flex h-56 items-center justify-center text-sm text-white-dark">No company data yet.</div>}</div>
      </div>
      <div className="panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-black dark:text-white">Subscription summary</h2><p className="text-sm text-white-dark">{data!.subscription.label}</p></div><div className="flex gap-5 text-sm"><span><b className="text-success">{data!.subscription.active}</b> Active</span><span><b className="text-primary">{data!.subscription.trial}</b> Trial</span><span><b className="text-warning">{data!.subscription.pastDue}</b> Past due</span></div></div>
    </div>
  );
};

export default SuperadminDashboardPage;
