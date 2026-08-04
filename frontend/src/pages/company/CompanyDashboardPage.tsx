import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { NavLink } from 'react-router-dom';
import {
  Briefcase,
  CheckCircle2,
  FileText,
  Clock,
  Users,
  UserCheck,
  Calendar,
  Plus,
  ArrowRight,
  TrendingUp,
  Award,
  ShieldAlert,
} from 'lucide-react';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const dateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'N/A';

const CompanyDashboardPage = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    dispatch(setPageTitle('Company Dashboard | RecruitAI'));
    const load = async () => {
      try {
        const res = await companyService.getDashboard();
        setData(res);
      } catch (err) {
        console.error('Failed to load company dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [dispatch]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const metrics = data?.metrics || {
    totalJobs: 0,
    activeJobs: 0,
    draftJobs: 0,
    totalApplications: 0,
    candidatesInterviewed: 0,
    candidatesShortlisted: 0,
    pendingInterviews: 0,
    unreviewedSecurityEvents: 0,
  };

  const statCards = [
    { title: 'Total Jobs', count: metrics.totalJobs, icon: Briefcase, color: 'text-primary bg-primary/10' },
    { title: 'Active Jobs', count: metrics.activeJobs, icon: CheckCircle2, color: 'text-success bg-success/10' },
    { title: 'Draft Jobs', count: metrics.draftJobs, icon: Clock, color: 'text-warning bg-warning/10' },
    { title: 'Total Applications', count: metrics.totalApplications, icon: FileText, color: 'text-info bg-info/10' },
    { title: 'Candidates Interviewed', count: metrics.candidatesInterviewed, icon: Users, color: 'text-secondary bg-secondary/10' },
    { title: 'Shortlisted Candidates', count: metrics.candidatesShortlisted, icon: UserCheck, color: 'text-success bg-success/10' },
    { title: 'Pending Interviews', count: metrics.pendingInterviews, icon: Calendar, color: 'text-danger bg-danger/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Company Dashboard</h1>
          <p className="mt-1 text-sm text-white-dark">Overview of your hiring pipeline, active postings, and candidates.</p>
        </div>
        <NavLink to="/company/jobs/new" className="btn btn-primary">
          <Plus className="mr-2 h-4 w-4" /> Post a Job
        </NavLink>
      </div>

      {/* Security Alert Banner */}
      {metrics.unreviewedSecurityEvents > 0 && (
        <NavLink
          to="/company/security-events"
          className="panel flex items-center justify-between border border-danger/30 bg-danger/5 p-4 transition hover:bg-danger/10"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-black dark:text-white">
                {metrics.unreviewedSecurityEvents} identity verification {metrics.unreviewedSecurityEvents === 1 ? 'alert needs' : 'alerts need'} review
              </p>
              <p className="text-xs text-white-dark">Face-match failures and blocked candidates flagged in the interview lobby.</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-danger" />
        </NavLink>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="panel flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-semibold uppercase text-white-dark">{card.title}</p>
                <h3 className="mt-2 text-3xl font-extrabold text-black dark:text-white">{card.count}</h3>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.color}`}>
                <Icon className="h-6 w-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid Section: Recent Candidates & Upcoming Interviews */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Candidates */}
        <div className="panel">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-black dark:text-white">Recent Candidates</h2>
            <NavLink to="/company/candidates" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </NavLink>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Job Title</th>
                  <th>Applied Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentApplications?.map((app: any) => (
                  <tr key={app._id}>
                    <td>
                      <div className="font-semibold text-black dark:text-white">{app.candidateName}</div>
                      <div className="text-xs text-white-dark">{app.candidateEmail}</div>
                    </td>
                    <td>{app.job?.title || 'Job Role'}</td>
                    <td className="text-xs">{dateTime(app.createdAt)}</td>
                    <td>
                      <span className={`badge badge-outline-${app.isShortlisted ? 'success' : app.status === 'rejected' ? 'danger' : 'primary'}`}>
                        {app.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data?.recentApplications || data.recentApplications.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-white-dark">
                      No candidates received yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming Interviews */}
        <div className="panel">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-black dark:text-white">Upcoming Interviews</h2>
            <NavLink to="/company/interviews" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </NavLink>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Type</th>
                  <th>Scheduled Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.upcomingInterviews?.map((inv: any) => (
                  <tr key={inv._id}>
                    <td>
                      <div className="font-semibold text-black dark:text-white">{inv.user?.name || inv.title}</div>
                      <div className="text-xs text-white-dark">{inv.jobRole}</div>
                    </td>
                    <td className="capitalize">{inv.type}</td>
                    <td className="text-xs">{dateTime(inv.scheduledAt)}</td>
                    <td>
                      <span className="badge badge-outline-warning">{inv.status}</span>
                    </td>
                  </tr>
                ))}
                {(!data?.upcomingInterviews || data.upcomingInterviews.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-white-dark">
                      No upcoming interviews scheduled.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Latest Activity */}
      <div className="panel">
        <h2 className="mb-4 text-lg font-bold text-black dark:text-white">Latest Activity</h2>
        <div className="space-y-3">
          {data?.latestActivity?.map((act: any) => (
            <div key={act.id} className="flex items-center justify-between rounded-lg border border-white-light p-3 dark:border-white-light/10">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {act.type === 'job' ? <Briefcase className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <div>
                  <p className="font-semibold text-black dark:text-white">{act.title}</p>
                  <p className="text-xs text-white-dark">{act.subtitle}</p>
                </div>
              </div>
              <span className="text-xs text-white-dark">{dateTime(act.timestamp)}</span>
            </div>
          ))}
          {(!data?.latestActivity || data.latestActivity.length === 0) && (
            <p className="py-4 text-center text-sm text-white-dark">No recent company activity logged.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyDashboardPage;
