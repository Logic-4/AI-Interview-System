import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Star, Eye, Calendar, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { CandidateSummary } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const CompanyShortlistPage = () => {
  const dispatch = useDispatch();
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileModal, setProfileModal] = useState<CandidateSummary | null>(null);
  const [scheduleModal, setScheduleModal] = useState<CandidateSummary | null>(null);
  const [scheduledAtDate, setScheduledAtDate] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await companyService.getApplications({ shortlisted: true, limit: 100 });
      const mapped: CandidateSummary[] = res.applications.map((app) => ({
        _id: app._id,
        candidateId: app.candidate?._id || app._id,
        name: app.candidateName,
        email: app.candidateEmail,
        appliedPosition: typeof app.job === 'object' ? app.job?.title : 'Role',
        experienceLevel: app.candidate?.experienceLevel || 'Mid',
        interviewScore: app.overallScore ?? null,
        status: app.status,
        isShortlisted: true,
        appliedDate: app.appliedDate,
      }));
      setCandidates(mapped);
    } catch (err: any) {
      toast.error('Failed to load shortlisted candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(setPageTitle('Candidate Shortlist | RecruitAI'));
    void load();
  }, [dispatch]);

  const handleRemoveShortlist = async (cand: CandidateSummary) => {
    try {
      await companyService.toggleShortlist(cand._id);
      toast.success('Removed from shortlist');
      await load();
    } catch (err: any) {
      toast.error('Failed to remove from shortlist');
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
      toast.success('Interview scheduled successfully');
      setScheduleModal(null);
      await load();
    } catch (err: any) {
      toast.error('Failed to schedule interview');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Shortlisted Candidates</h1>
        <p className="mt-1 text-sm text-white-dark">Manage your top-tier candidates selected for final interview rounds.</p>
      </div>

      <div className="panel">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Email</th>
                  <th>Applied Position</th>
                  <th>Experience</th>
                  <th>Score</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((cand) => (
                  <tr key={cand._id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-warning fill-warning" />
                        <span className="font-semibold text-black dark:text-white">{cand.name}</span>
                      </div>
                    </td>
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
                      <div className="flex justify-end gap-2">
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
                          title="Remove from Shortlist"
                          className="btn btn-sm btn-outline-danger p-2"
                          onClick={() => void handleRemoveShortlist(cand)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {candidates.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-white-dark">
                      No candidates shortlisted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Profile Modal */}
      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-black dark:text-white">Shortlisted Profile</h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-white-dark">Name: </span>
                <span className="font-semibold">{profileModal.name}</span>
              </p>
              <p>
                <span className="text-white-dark">Email: </span>
                <span className="font-semibold">{profileModal.email}</span>
              </p>
              <p>
                <span className="text-white-dark">Position: </span>
                <span className="font-semibold">{profileModal.appliedPosition}</span>
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
                <label htmlFor="scheduledAtShortlist">Date & Time</label>
                <input
                  id="scheduledAtShortlist"
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

export default CompanyShortlistPage;
