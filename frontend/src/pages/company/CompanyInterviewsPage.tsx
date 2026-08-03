import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Eye, XCircle, RefreshCw, AlertTriangle, ShieldAlert, ExternalLink, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { NavLink } from 'react-router-dom';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { CompanyInterview } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const dateTime = (value?: string) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'N/A';

const dateTimeShort = (value?: string) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'N/A';

const statusBadge = (status: string) =>
  ({ completed: 'success', scheduled: 'warning', 'in-progress': 'primary', cancelled: 'danger' }[status] || 'secondary');

const VIOLATION_LABEL: Record<string, string> = {
  tab_switch: 'Tab switch',
  window_blur: 'Window unfocused',
  gaze_away: 'Gaze away',
  face_not_detected: 'Face not detected',
};

const CompanyInterviewsPage = () => {
  const dispatch = useDispatch();
  const [interviews, setInterviews] = useState<CompanyInterview[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [rescheduleModal, setRescheduleModal] = useState<CompanyInterview | null>(null);
  const [newDate, setNewDate] = useState('');
  const [resultsModal, setResultsModal] = useState<CompanyInterview | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await companyService.getInterviews({ page, limit: 10 });
      setInterviews(res.interviews);
      setTotal(res.pagination.total);
    } catch {
      toast.error('Failed to load interviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(setPageTitle('Interviews | RecruitAI'));
    void load();
  }, [dispatch, page]);

  const openResults = async (inv: CompanyInterview) => {
    setResultsModal(inv);
    setResultsLoading(true);
    try {
      const full = await companyService.getInterviewResults(inv._id);
      setResultsModal(full);
    } catch {
      // keep shallow data already set
    } finally {
      setResultsLoading(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModal || !newDate) return;
    try {
      await companyService.rescheduleInterview(rescheduleModal._id, newDate);
      toast.success('Interview rescheduled!');
      setRescheduleModal(null);
      setNewDate('');
      await load();
    } catch {
      toast.error('Failed to reschedule interview');
    }
  };

  const handleCancel = async (inv: CompanyInterview) => {
    try {
      await companyService.cancelInterview(inv._id);
      toast.success('Interview cancelled');
      await load();
    } catch {
      toast.error('Failed to cancel interview');
    }
  };

  const handleDelete = async (inv: CompanyInterview) => {
    if (!window.confirm(`Delete the interview for ${inv.user?.name || inv.title} permanently? This cannot be undone.`)) return;
    try {
      await companyService.deleteInterview(inv._id);
      toast.success('Interview deleted');
      if (resultsModal?._id === inv._id) setResultsModal(null);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete interview');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Interviews</h1>
        <p className="mt-1 text-sm text-white-dark">Monitor AI mock interview sessions, view results, and inspect proctoring reports.</p>
      </div>

      <div className="panel">
        {loading ? (
          <div className="flex h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
        ) : (
          <>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Job / Role</th>
                    <th>Type</th>
                    <th>Language</th>
                    <th>Scheduled</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Integrity</th>
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
                        <span className={`badge badge-outline-${statusBadge(inv.status)} capitalize`}>{inv.status}</span>
                      </td>
                      <td>
                        {inv.overallScore != null ? (
                          <span className={`font-bold ${inv.overallScore >= 70 ? 'text-success' : inv.overallScore >= 50 ? 'text-warning' : 'text-danger'}`}>
                            {inv.overallScore}%
                          </span>
                        ) : <span className="text-xs text-white-dark">—</span>}
                      </td>
                      <td>
                        {inv.proctoring?.integrityScore != null ? (
                          <span className={`text-sm font-bold ${
                            inv.proctoring.integrityScore >= 80 ? 'text-success' : inv.proctoring.integrityScore >= 50 ? 'text-warning' : 'text-danger'
                          }`}>
                            {inv.proctoring.integrityScore}%
                            {inv.proctoring.flaggedForReview && <ShieldAlert className="inline h-3.5 w-3.5 ml-1 text-danger" />}
                          </span>
                        ) : <span className="text-xs text-white-dark">—</span>}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button title="View Results" className="btn btn-sm btn-outline-primary p-2" onClick={() => void openResults(inv)}>
                            <Eye className="h-4 w-4" />
                          </button>
                          {inv.status === 'scheduled' && (
                            <>
                              <button title="Reschedule" className="btn btn-sm btn-outline-warning p-2" onClick={() => setRescheduleModal(inv)}>
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              <button title="Cancel" className="btn btn-sm btn-outline-danger p-2" onClick={() => void handleCancel(inv)}>
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {inv.status !== 'in-progress' && (
                            <button title="Delete permanently" className="btn btn-sm btn-outline-danger p-2" onClick={() => void handleDelete(inv)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {interviews.length === 0 && (
                    <tr><td colSpan={9} className="py-12 text-center text-white-dark">No interviews scheduled.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-white-dark">{total} interviews</span>
              <div className="flex items-center gap-2">
                <button className="btn btn-outline-primary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                <span>Page {page} of {totalPages}</span>
                <button className="btn btn-outline-primary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
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
            <form onSubmit={(e) => void handleRescheduleSubmit(e)} className="space-y-4">
              <div>
                <label htmlFor="newScheduledDate">New Date &amp; Time (Somalia time)</label>
                <input id="newScheduledDate" type="datetime-local" className="form-input" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setRescheduleModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-warning">Reschedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {resultsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-2xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-white-light dark:border-white-light/10 pb-3 mb-4 shrink-0">
              <h3 className="text-lg font-bold text-black dark:text-white">Interview Results</h3>
              <button type="button" className="text-white-dark hover:text-danger text-xl font-bold" onClick={() => setResultsModal(null)}>&times;</button>
            </div>

            {resultsLoading ? (
              <div className="flex flex-1 items-center justify-center py-12"><LoadingSpinner size="lg" /></div>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-5 pr-1">
                {/* Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-white-dark">Candidate</p>
                    <p className="font-semibold text-black dark:text-white">{resultsModal.user?.name || resultsModal.title}</p>
                    <p className="text-xs text-white-dark">{resultsModal.user?.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white-dark">Role</p>
                    <p className="font-semibold text-black dark:text-white">{resultsModal.jobRole || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white-dark">Type / Language</p>
                    <p className="font-semibold text-black dark:text-white capitalize">{resultsModal.type} · {resultsModal.language}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white-dark">Overall Score</p>
                    <p className={`text-2xl font-extrabold ${resultsModal.overallScore != null && resultsModal.overallScore >= 70 ? 'text-success' : 'text-danger'}`}>
                      {resultsModal.overallScore != null ? `${resultsModal.overallScore}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* AI Feedback Summary */}
                {resultsModal.feedback?.summary && (
                  <div>
                    <p className="text-xs font-bold text-white-dark uppercase mb-1">AI Summary</p>
                    <p className="rounded-lg border border-white-light dark:border-white-light/10 p-3 text-xs leading-relaxed">
                      {resultsModal.feedback.summary}
                    </p>
                  </div>
                )}

                {/* Strengths & Improvements */}
                {((resultsModal.feedback?.strengths?.length ?? 0) > 0 || (resultsModal.feedback?.improvements?.length ?? 0) > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    {(resultsModal.feedback?.strengths?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-bold text-success uppercase mb-1">Strengths</p>
                        <ul className="list-disc pl-4 text-xs text-white-dark space-y-1">
                          {resultsModal.feedback!.strengths!.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {(resultsModal.feedback?.improvements?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-bold text-warning uppercase mb-1">Areas to Improve</p>
                        <ul className="list-disc pl-4 text-xs text-white-dark space-y-1">
                          {resultsModal.feedback!.improvements!.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Proctoring Summary */}
                <div>
                  <p className="text-xs font-bold text-white-dark uppercase mb-2">Proctoring Summary</p>
                  <div className="rounded-lg border border-white-light dark:border-white-light/10 p-4 space-y-3">
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <p className="text-xs text-white-dark">Integrity Score</p>
                        <p className={`text-xl font-extrabold ${
                          (resultsModal.proctoring?.integrityScore ?? 100) >= 80 ? 'text-success'
                          : (resultsModal.proctoring?.integrityScore ?? 100) >= 50 ? 'text-warning'
                          : 'text-danger'
                        }`}>
                          {resultsModal.proctoring?.integrityScore ?? 100}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white-dark">Strikes</p>
                        <p className={`text-xl font-extrabold ${
                          (resultsModal.proctoring?.strikes ?? 0) === 0 ? 'text-success' : 'text-danger'
                        }`}>
                          {resultsModal.proctoring?.strikes ?? 0} / 3
                        </p>
                      </div>
                      {resultsModal.proctoring?.flaggedForReview && (
                        <span className="badge badge-outline-danger flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Flagged for review
                        </span>
                      )}
                    </div>

                    {/* Violations */}
                    {(resultsModal.proctoring?.violations?.length ?? 0) > 0 ? (
                      <div className="table-responsive">
                        <table className="text-xs">
                          <thead>
                            <tr>
                              <th>Event</th>
                              <th>Time</th>
                              <th>Strike</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resultsModal.proctoring!.violations!.map((v, i) => (
                              <tr key={i}>
                                <td>
                                  <span className={`badge badge-outline-${v.type === 'tab_switch' || v.type === 'window_blur' ? 'warning' : 'danger'}`}>
                                    {VIOLATION_LABEL[v.type] ?? v.type}
                                  </span>
                                </td>
                                <td className="text-white-dark">{dateTimeShort(v.timestamp)}</td>
                                <td>{v.strike != null ? <span className="font-bold text-danger">#{v.strike}</span> : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-white-dark">No proctoring violations recorded.</p>
                    )}
                  </div>
                </div>

                {/* Session Recording */}
                <div>
                  <p className="text-xs font-bold text-white-dark uppercase mb-2">Session Recording</p>
                  {resultsModal.recordingUrl ? (
                    <video controls src={resultsModal.recordingUrl} className="w-full rounded-lg border border-white-light dark:border-white-light/10 bg-black" />
                  ) : resultsModal.recordingStatus === 'processing' ? (
                    <p className="rounded-lg border border-white-light p-3 text-xs text-white-dark dark:border-white-light/10">Recording is still processing — check back shortly.</p>
                  ) : (
                    <p className="rounded-lg border border-white-light p-3 text-xs text-white-dark dark:border-white-light/10">No recording available for this session.</p>
                  )}
                </div>

                {/* Link to full assessment */}
                {resultsModal.status === 'completed' && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-primary">Full Assessment Report</p>
                      <p className="text-xs text-white-dark">Per-question Gemma notes, category scores, and identity verification are in the Assessment report.</p>
                    </div>
                    <NavLink to="/company/assessments" className="btn btn-primary btn-sm flex items-center gap-1.5 shrink-0" onClick={() => setResultsModal(null)}>
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-4 mt-4 border-t border-white-light dark:border-white-light/10 shrink-0">
              <button className="btn btn-primary" onClick={() => setResultsModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyInterviewsPage;
