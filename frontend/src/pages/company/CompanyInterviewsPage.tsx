import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Video, Calendar, Eye, XCircle, RefreshCw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { CompanyInterview } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const dateTime = (value?: string) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'N/A';

const statusBadge = (status: string) =>
  ({ completed: 'success', scheduled: 'warning', 'in-progress': 'primary', cancelled: 'danger' }[status] || 'secondary');

const CompanyInterviewsPage = () => {
  const dispatch = useDispatch();
  const [interviews, setInterviews] = useState<CompanyInterview[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [rescheduleModal, setRescheduleModal] = useState<CompanyInterview | null>(null);
  const [newDate, setNewDate] = useState('');
  const [resultsModal, setResultsModal] = useState<CompanyInterview | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await companyService.getInterviews({ page, limit: 10 });
      setInterviews(res.interviews);
      setTotal(res.pagination.total);
    } catch (err: any) {
      toast.error('Failed to load interviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(setPageTitle('Interviews | RecruitAI'));
    void load();
  }, [dispatch, page]);

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModal || !newDate) return;
    try {
      await companyService.rescheduleInterview(rescheduleModal._id, newDate);
      toast.success('Interview rescheduled!');
      setRescheduleModal(null);
      await load();
    } catch (err: any) {
      toast.error('Failed to reschedule interview');
    }
  };

  const handleCancel = async (inv: CompanyInterview) => {
    try {
      await companyService.cancelInterview(inv._id);
      toast.success('Interview cancelled');
      await load();
    } catch (err: any) {
      toast.error('Failed to cancel interview');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Interviews</h1>
        <p className="mt-1 text-sm text-white-dark">Monitor scheduled AI mock interview sessions and inspect evaluation reports.</p>
      </div>

      <div className="panel">
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
                    <th>Job / Role</th>
                    <th>Interview Type</th>
                    <th>Language</th>
                    <th>Scheduled Time</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.map((inv) => (
                    <tr key={inv._id}>
                      <td>
                        <div className="font-semibold text-black dark:text-white">{inv.user?.name || inv.title}</div>
                        <div className="text-xs text-white-dark">{inv.user?.email}</div>
                      </td>
                      <td>{inv.jobRole || 'Standard Role'}</td>
                      <td className="capitalize">{inv.type}</td>
                      <td className="capitalize">{inv.language}</td>
                      <td className="text-xs">{dateTime(inv.scheduledAt)}</td>
                      <td>
                        <span className={`badge badge-outline-${statusBadge(inv.status)} capitalize`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        {inv.overallScore !== null && inv.overallScore !== undefined ? (
                          <span className="font-bold text-primary">{inv.overallScore}%</span>
                        ) : (
                          <span className="text-xs text-white-dark">N/A</span>
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            title="View Results"
                            className="btn btn-sm btn-outline-primary p-2"
                            onClick={() => setResultsModal(inv)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {inv.status === 'scheduled' && (
                            <>
                              <button
                                title="Reschedule"
                                className="btn btn-sm btn-outline-warning p-2"
                                onClick={() => setRescheduleModal(inv)}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              <button
                                title="Cancel Interview"
                                className="btn btn-sm btn-outline-danger p-2"
                                onClick={() => void handleCancel(inv)}
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {interviews.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white-dark">
                        No interviews scheduled.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-white-dark">{total} interviews</span>
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

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-black dark:text-white">Reschedule Interview</h3>
            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label htmlFor="newScheduledDate">New Date & Time</label>
                <input
                  id="newScheduledDate"
                  type="datetime-local"
                  className="form-input"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setRescheduleModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-warning">
                  Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Results Modal */}
      {resultsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white-light dark:border-white-light/10 pb-3">
              <h3 className="text-lg font-bold text-black dark:text-white">Interview Evaluation Results</h3>
              <button
                type="button"
                className="text-white-dark hover:text-danger text-lg font-bold"
                onClick={() => setResultsModal(null)}
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <p>
                <span className="text-white-dark">Candidate: </span>
                <span className="font-semibold">{resultsModal.user?.name || resultsModal.title}</span>
              </p>
              <p>
                <span className="text-white-dark">Role: </span>
                <span className="font-semibold">{resultsModal.jobRole}</span>
              </p>
              <p>
                <span className="text-white-dark">Overall Score: </span>
                <span className="font-bold text-primary">{resultsModal.overallScore ?? 'N/A'}%</span>
              </p>
              {resultsModal.feedback?.summary && (
                <div>
                  <p className="text-xs font-bold text-white-dark">Summary Feedback</p>
                  <p className="rounded-lg border border-white-light p-3 text-xs dark:border-white-light/10 mt-1">
                    {resultsModal.feedback.summary}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <button className="btn btn-primary" onClick={() => setResultsModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyInterviewsPage;
