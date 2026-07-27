import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Search, Eye, Star, Calendar, XCircle, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { CandidateSummary } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const CompanyCandidatesPage = () => {
  const dispatch = useDispatch();
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [profileModal, setProfileModal] = useState<CandidateSummary | null>(null);
  const [scheduleModal, setScheduleModal] = useState<CandidateSummary | null>(null);
  const [scheduledAtDate, setScheduledAtDate] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await companyService.getCandidates({ page, limit: 10, search });
      setCandidates(res.candidates);
      setTotal(res.pagination.total);
    } catch (err: any) {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(setPageTitle('Candidates | RecruitAI'));
  }, [dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timer);
  }, [page, search]);

  const handleShortlist = async (cand: CandidateSummary) => {
    try {
      await companyService.toggleShortlist(cand._id);
      toast.success(cand.isShortlisted ? 'Removed from shortlist' : 'Added to shortlist');
      await load();
    } catch (err: any) {
      toast.error('Failed to update shortlist');
    }
  };

  const handleReject = async (cand: CandidateSummary) => {
    try {
      await companyService.rejectCandidate(cand._id);
      toast.success('Candidate rejected');
      await load();
    } catch (err: any) {
      toast.error('Failed to reject candidate');
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleModal || !scheduledAtDate) return;
    try {
      await companyService.scheduleInterview({
        applicationId: scheduleModal._id,
        candidateId: scheduleModal.candidateId,
        jobRole: scheduleModal.appliedPosition,
        scheduledAt: scheduledAtDate,
      });
      toast.success('Interview scheduled!');
      setScheduleModal(null);
      await load();
    } catch (err: any) {
      toast.error('Failed to schedule interview');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Candidates</h1>
        <p className="mt-1 text-sm text-white-dark">View profiles, shortlist talent, and manage interview schedules.</p>
      </div>

      <div className="panel">
        <div className="mb-5 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-dark" />
            <input
              className="form-input pl-9"
              placeholder="Search by candidate name or email..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
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
                    <th>Candidate Name</th>
                    <th>Email</th>
                    <th>Applied Position</th>
                    <th>Experience</th>
                    <th>Interview Score</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((cand) => (
                    <tr key={cand._id}>
                      <td className="font-semibold text-black dark:text-white">{cand.name}</td>
                      <td>{cand.email}</td>
                      <td>{cand.appliedPosition}</td>
                      <td className="capitalize">{cand.experienceLevel}</td>
                      <td>
                        {cand.interviewScore !== null && cand.interviewScore !== undefined ? (
                          <span className="font-bold text-primary">{cand.interviewScore}%</span>
                        ) : (
                          <span className="text-xs text-white-dark">N/A</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-outline-${cand.isShortlisted ? 'success' : 'secondary'} capitalize`}>
                          {cand.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            title="View Profile"
                            className="btn btn-sm btn-outline-primary p-2"
                            onClick={() => setProfileModal(cand)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            title="Schedule Interview"
                            className="btn btn-sm btn-outline-info p-2"
                            onClick={() => setScheduleModal(cand)}
                          >
                            <Calendar className="h-4 w-4" />
                          </button>
                          <button
                            title={cand.isShortlisted ? 'Remove Shortlist' : 'Move To Shortlist'}
                            className={`btn btn-sm ${cand.isShortlisted ? 'btn-success' : 'btn-outline-success'} p-2`}
                            onClick={() => void handleShortlist(cand)}
                          >
                            <Star className="h-4 w-4" />
                          </button>
                          <button
                            title="Reject Candidate"
                            className="btn btn-sm btn-outline-danger p-2"
                            onClick={() => void handleReject(cand)}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-white-dark">
                        No candidates found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-white-dark">{total} candidates</span>
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

      {/* Profile Modal */}
      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-lg space-y-4">
            <h3 className="text-lg font-bold text-black dark:text-white">Candidate Profile</h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-white-dark">Name: </span>
                <span className="font-semibold text-black dark:text-white">{profileModal.name}</span>
              </p>
              <p>
                <span className="text-white-dark">Email: </span>
                <span className="font-semibold">{profileModal.email}</span>
              </p>
              <p>
                <span className="text-white-dark">Applied Position: </span>
                <span className="font-semibold">{profileModal.appliedPosition}</span>
              </p>
              <p>
                <span className="text-white-dark">Experience Level: </span>
                <span className="font-semibold capitalize">{profileModal.experienceLevel}</span>
              </p>
              <p>
                <span className="text-white-dark">Interview Score: </span>
                <span className="font-bold text-primary">
                  {profileModal.interviewScore !== null && profileModal.interviewScore !== undefined
                    ? `${profileModal.interviewScore}%`
                    : 'N/A'}
                </span>
              </p>
            </div>
            <div className="flex justify-end pt-3">
              <button className="btn btn-primary" onClick={() => setProfileModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-black dark:text-white">Schedule Interview</h3>
            <p className="text-sm text-white-dark">
              Candidate: <span className="font-bold text-black dark:text-white">{scheduleModal.name}</span>
            </p>
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label htmlFor="scheduledAt">Date & Time</label>
                <input
                  id="scheduledAt"
                  type="datetime-local"
                  className="form-input"
                  value={scheduledAtDate}
                  onChange={(e) => setScheduledAtDate(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setScheduleModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyCandidatesPage;
