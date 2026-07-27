import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Search, Eye, FileText, CheckCircle2, XCircle, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { Application, ApplicationStatus } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const dateTime = (value?: string) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'N/A';

const statusBadge = (status: ApplicationStatus) => {
  switch (status) {
    case 'shortlisted':
    case 'hired':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'interviewed':
    case 'interview_scheduled':
      return 'primary';
    case 'under_review':
      return 'warning';
    default:
      return 'secondary';
  }
};

const CompanyApplicationsPage = () => {
  const dispatch = useDispatch();
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailApp, setDetailApp] = useState<Application | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await companyService.getApplications({ page, limit: 10, search, status });
      setApplications(res.applications);
      setTotal(res.pagination.total);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(setPageTitle('Applications | RecruitAI'));
  }, [dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timer);
  }, [page, search, status]);

  const updateStatus = async (appId: string, nextStatus: ApplicationStatus, isShortlisted?: boolean) => {
    try {
      await companyService.updateApplicationStatus(appId, { status: nextStatus, isShortlisted });
      toast.success(`Application updated to ${nextStatus}`);
      await load();
      if (detailApp?._id === appId) setDetailApp(null);
    } catch (err: any) {
      toast.error('Failed to update application');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Job Applications</h1>
        <p className="mt-1 text-sm text-white-dark">Review candidate submissions across all your posted roles.</p>
      </div>

      <div className="panel">
        <div className="mb-5 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-dark" />
            <input
              className="form-input pl-9"
              placeholder="Search candidate name or email..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          <select
            className="form-select max-w-full md:w-48"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All Statuses</option>
            <option value="applied">Applied</option>
            <option value="under_review">Under Review</option>
            <option value="interview_scheduled">Interview Scheduled</option>
            <option value="interviewed">Interviewed</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Job Title</th>
                    <th>Applied Date</th>
                    <th>Resume</th>
                    <th>Interview</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => {
                    const jobTitle = typeof app.job === 'object' ? app.job?.title : 'Role';
                    return (
                      <tr key={app._id}>
                        <td>
                          <div className="font-semibold text-black dark:text-white">{app.candidateName}</div>
                          <div className="text-xs text-white-dark">{app.candidateEmail}</div>
                        </td>
                        <td>{jobTitle}</td>
                        <td className="text-xs">{dateTime(app.appliedDate)}</td>
                        <td>
                          <span className="badge badge-outline-secondary capitalize">{app.resumeStatus}</span>
                        </td>
                        <td className="capitalize text-xs">{app.interviewStatus.replace('_', ' ')}</td>
                        <td>
                          <span className={`badge badge-outline-${statusBadge(app.status)} capitalize`}>
                            {app.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          {app.overallScore !== null && app.overallScore !== undefined ? (
                            <span className="font-bold text-primary">{app.overallScore}%</span>
                          ) : (
                            <span className="text-xs text-white-dark">N/A</span>
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <button
                              title="View Application Details"
                              className="btn btn-sm btn-outline-primary p-2"
                              onClick={() => setDetailApp(app)}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {applications.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white-dark">
                        No applications found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-white-dark">{total} applications</span>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-outline-primary btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-outline-primary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Application Detail Modal */}
      {detailApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white-light dark:border-white-light/10 pb-3">
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white">{detailApp.candidateName}</h3>
                <p className="text-xs text-white-dark">{detailApp.candidateEmail}</p>
              </div>
              <button
                type="button"
                className="text-white-dark hover:text-danger text-lg font-bold"
                onClick={() => setDetailApp(null)}
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-white-dark">Job Applied</p>
                <p className="font-semibold text-black dark:text-white">
                  {typeof detailApp.job === 'object' ? detailApp.job?.title : 'Role'}
                </p>
              </div>

              <div>
                <p className="text-xs text-white-dark">Applied On</p>
                <p className="font-semibold">{dateTime(detailApp.appliedDate)}</p>
              </div>

              <div>
                <p className="text-xs text-white-dark">Interview Score</p>
                <p className="font-bold text-primary">
                  {detailApp.overallScore !== null && detailApp.overallScore !== undefined
                    ? `${detailApp.overallScore}%`
                    : 'Not Evaluated'}
                </p>
              </div>

              <div>
                <p className="text-xs text-white-dark">Current Status</p>
                <span className={`badge badge-outline-${statusBadge(detailApp.status)} capitalize`}>
                  {detailApp.status.replace('_', ' ')}
                </span>
              </div>
            </div>

            {detailApp.coverLetter && (
              <div>
                <p className="text-xs font-bold text-white-dark mb-1">Cover Letter</p>
                <p className="rounded-lg border border-white-light p-3 text-xs dark:border-white-light/10">
                  {detailApp.coverLetter}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-white-light dark:border-white-light/10">
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={() => void updateStatus(detailApp._id, 'shortlisted', true)}
              >
                <Star className="mr-1 h-4 w-4" /> Move to Shortlist
              </button>
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => void updateStatus(detailApp._id, 'rejected', false)}
              >
                <XCircle className="mr-1 h-4 w-4" /> Reject
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setDetailApp(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyApplicationsPage;
