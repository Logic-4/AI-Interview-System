import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Search, Eye, Star, Calendar, XCircle, CheckCircle2, UserCheck,
  Mail, Phone, Briefcase, Award, X, AlertTriangle, MoreHorizontal, Download, FileText, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { CandidateSummary, ApplicationStatus } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Dropdown from '@/components/Dropdown';
import { getErrorMessage } from '@/lib/utils';

const approvalBadge = (status: CandidateSummary['approvalStatus']) =>
  ({ approved: 'success', rejected: 'danger', pending: 'warning' })[status] || 'secondary';

const statusBadge = (status: ApplicationStatus) =>
  ({ applied: 'info', hired: 'success', shortlisted: 'success', rejected: 'danger', interviewed: 'primary', interview_scheduled: 'primary', under_review: 'warning' })[status] || 'secondary';

const dateShort = (v?: string) =>
  v ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(v)) : 'N/A';

const getMinDateTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

function Avatar({ src, name, size = 'md' }: { src?: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const [err, setErr] = useState(false);
  const sz = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' }[size];
  const valid = src && (src.startsWith('http') || src.startsWith('data:image/'));
  if (valid && !err) {
    return <img src={src} alt={name} onError={() => setErr(true)} className={`${sz} rounded-full object-cover shrink-0`} />;
  }
  const initials = name?.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'C';
  return (
    <div className={`${sz} flex items-center justify-center rounded-full bg-gradient-to-tr from-primary via-indigo-600 to-purple-600 font-bold text-white shrink-0`}>
      {initials}
    </div>
  );
}

function ProfileModal({
  cand,
  onClose,
  onApprove,
  onSchedule,
  onShortlist,
  onReject,
  onHire,
  onDelete,
  approvingId,
}: {
  cand: CandidateSummary;
  onClose: () => void;
  onApprove: (c: CandidateSummary) => void;
  onSchedule: (c: CandidateSummary) => void;
  onShortlist: (c: CandidateSummary) => void;
  onReject: (c: CandidateSummary) => void;
  onHire: (c: CandidateSummary) => void;
  onDelete: (c: CandidateSummary) => void;
  approvingId: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-white-light dark:border-white-light/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-white-light dark:border-white-light/10 bg-slate-50/50 dark:bg-slate-800/40">
          <Avatar src={cand.avatar || cand.profilePhotoUrl} name={cand.name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-black dark:text-white">{cand.name}</h3>
              <span className={`badge badge-outline-${statusBadge(cand.status)} capitalize text-xs`}>
                {cand.status.replace(/_/g, ' ')}
              </span>
              <span className={`badge badge-outline-${approvalBadge(cand.approvalStatus)} capitalize text-xs`}>
                {cand.approvalStatus}
              </span>
            </div>
            <p className="text-sm text-primary mt-0.5 flex items-center gap-1 font-semibold">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              {cand.appliedPosition}
            </p>
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-full bg-slate-200/60 dark:bg-slate-700 flex items-center justify-center text-white-dark hover:text-black dark:hover:text-white transition shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 rounded-lg border border-white-light dark:border-white-light/10 px-3 py-2">
              <Mail className="h-4 w-4 text-primary shrink-0" />
              <a href={`mailto:${cand.email}`} className="text-primary hover:underline truncate text-xs font-medium">{cand.email}</a>
            </div>
            {cand.phone ? (
              <div className="flex items-center gap-2 rounded-lg border border-white-light dark:border-white-light/10 px-3 py-2">
                <Phone className="h-4 w-4 text-success shrink-0" />
                <a href={`tel:${cand.phone}`} className="text-black dark:text-white hover:underline truncate text-xs font-medium">{cand.phone}</a>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-white-light dark:border-white-light/10 px-3 py-2">
                <Briefcase className="h-4 w-4 text-white-dark shrink-0" />
                <span className="capitalize text-xs text-black dark:text-white font-medium">{cand.experienceLevel} level</span>
              </div>
            )}
          </div>

          {/* Resume / CV Section */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-black dark:text-white">Candidate Resume / CV</h4>
                  <p className="text-[11px] text-white-dark">Attached during job application</p>
                </div>
              </div>
              {cand.resumeUrl ? (
                <a
                  href={cand.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
                  title="Download or view candidate resume"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download / View CV</span>
                </a>
              ) : (
                <span className="badge badge-outline-secondary text-[10px]">No CV File Attached</span>
              )}
            </div>

            {cand.resumeText && (
              <details className="mt-2 text-xs bg-white dark:bg-slate-800 rounded-lg border border-white-light dark:border-white-light/10 p-3">
                <summary className="cursor-pointer font-semibold text-primary hover:underline select-none">
                  Preview Extracted Resume Text ({cand.resumeText.length} characters)
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] text-black dark:text-white-light bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded border border-white-light/50 dark:border-white-light/5">
                  {cand.resumeText}
                </div>
              </details>
            )}
          </div>

          {/* Skills */}
          {cand.skills && cand.skills.length > 0 && (
            <div>
              <p className="text-xs font-bold text-white-dark uppercase mb-2">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {cand.skills.map((sk, i) => (
                  <span key={i} className="badge badge-outline-primary text-xs">{sk}</span>
                ))}
              </div>
            </div>
          )}

          {/* Interview Score */}
          {cand.interviewScore != null && (
            <div className="rounded-lg border border-white-light dark:border-white-light/10 p-4">
              <div className="flex items-center gap-3">
                <Award className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-white-dark mb-1">AI Interview Score</p>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-extrabold text-primary">{cand.interviewScore}%</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-dark">
                      <div
                        className={`h-2 rounded-full ${cand.interviewScore >= 70 ? 'bg-success' : cand.interviewScore >= 50 ? 'bg-warning' : 'bg-danger'}`}
                        style={{ width: `${Math.min(100, cand.interviewScore)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              {cand.interviewId && (
                <button
                  type="button"
                  className="mt-3 text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                  onClick={async () => {
                    onClose();
                    window.location.href = '/company/assessments';
                  }}
                >
                  <Eye className="h-3.5 w-3.5" /> View full assessment report
                </button>
              )}
            </div>
          )}

          {/* Rejection Reason */}
          {cand.rejectionReason && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
              <p className="text-xs font-bold text-danger mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Rejection Reason
              </p>
              <p className="text-xs text-black dark:text-white">{cand.rejectionReason}</p>
            </div>
          )}

          {/* Applied date */}
          <p className="text-xs text-white-dark">Applied: {dateShort(cand.appliedDate)}</p>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-white-light dark:border-white-light/10">
          {cand.approvalStatus !== 'approved' && cand.approvalStatus !== 'rejected' && (
            <button
              type="button"
              className="btn btn-success btn-sm flex items-center gap-1.5"
              disabled={approvingId === cand._id}
              onClick={() => onApprove(cand)}
            >
              <CheckCircle2 className="h-4 w-4" />
              {approvingId === cand._id ? 'Approving…' : 'Approve'}
            </button>
          )}
          {cand.approvalStatus === 'approved' && cand.status !== 'hired' && cand.status !== 'rejected' && (
            <button
              type="button"
              className="btn btn-outline-info btn-sm flex items-center gap-1.5"
              onClick={() => onSchedule(cand)}
            >
              <Calendar className="h-4 w-4" /> Schedule Interview
            </button>
          )}
          {!cand.isShortlisted && cand.status !== 'hired' && cand.status !== 'rejected' && (
            <button
              type="button"
              className="btn btn-outline-warning btn-sm flex items-center gap-1.5"
              onClick={() => onShortlist(cand)}
            >
              <Star className="h-4 w-4" /> Shortlist
            </button>
          )}
          {cand.approvalStatus === 'approved' && cand.status !== 'hired' && cand.status !== 'rejected' && (
            <button
              type="button"
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              onClick={() => onHire(cand)}
            >
              <UserCheck className="h-4 w-4" /> Mark as Hired
            </button>
          )}
          {cand.approvalStatus !== 'rejected' && cand.status !== 'hired' && (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm flex items-center gap-1.5"
              onClick={() => onReject(cand)}
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
          )}
          <button
            type="button"
            className="btn btn-danger btn-sm flex items-center gap-1.5 ml-auto"
            onClick={() => onDelete(cand)}
            title="Permanently delete candidate application"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}


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
  const [rejectModal, setRejectModal] = useState<CandidateSummary | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await companyService.getCandidates({ page, limit: 10, search });
      setCandidates(res.candidates);
      setTotal(res.pagination.total);
    } catch {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(setPageTitle('Candidates | RecruitAI'));
  }, [dispatch]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [page, search]);

  const handleApprove = async (cand: CandidateSummary) => {
    setApprovingId(cand._id);
    try {
      await companyService.approveApplication(cand._id);
      toast.success(`${cand.name} approved`);
      await load();
      if (profileModal?._id === cand._id) setProfileModal(prev => prev ? { ...prev, approvalStatus: 'approved' } : null);
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to approve candidate'));
    } finally {
      setApprovingId(null);
    }
  };

  const handleShortlist = async (cand: CandidateSummary) => {
    try {
      await companyService.toggleShortlist(cand._id);
      toast.success(cand.isShortlisted ? 'Removed from shortlist' : 'Added to shortlist');
      setProfileModal(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update shortlist'));
    }
  };

  const handleHire = async (cand: CandidateSummary) => {
    try {
      await companyService.updateApplicationStatus(cand._id, { status: 'hired' });
      toast.success(`${cand.name} marked as hired!`);
      setProfileModal(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to mark as hired'));
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModal) return;
    try {
      await companyService.rejectCandidate(rejectModal._id, rejectReason.trim() || undefined);
      toast.success('Candidate rejected and notified by email');
      setRejectModal(null);
      setRejectReason('');
      setProfileModal(null);
      await load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to reject candidate'));
    }
  };

  const handleDelete = async (cand: CandidateSummary) => {
    if (!window.confirm(`Are you sure you want to permanently delete the application for ${cand.name}?`)) {
      return;
    }
    try {
      await companyService.deleteApplication(cand._id);
      toast.success(`Application for ${cand.name} deleted`);
      if (profileModal?._id === cand._id) setProfileModal(null);
      await load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to delete application'));
    }
  };


  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleModal || !scheduledAtDate) return;
    if (new Date(scheduledAtDate).getTime() < Date.now() - 60000) {
      toast.error('Interview date cannot be in the past');
      return;
    }
    try {
      await companyService.scheduleInterview({
        applicationId: scheduleModal._id,
        candidateId: scheduleModal.candidateId,
        jobRole: scheduleModal.appliedPosition,
        scheduledAt: scheduledAtDate,
      });
      toast.success('Interview scheduled!');
      setScheduleModal(null);
      setScheduledAtDate('');
      setProfileModal(null);
      await load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to schedule interview'));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Candidates</h1>
        <p className="mt-1 text-sm text-white-dark">View profiles, shortlist talent, schedule interviews, and hire top candidates.</p>
      </div>

      <div className="panel">
        <div className="mb-5 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white-dark pointer-events-none z-10" />
            <input
              className="form-input pl-10"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>
        ) : (
          <>
            <div className="table-responsive overflow-x-auto w-full">
              <table className="w-full text-left align-middle min-w-[850px]">
                <thead>
                  <tr className="border-b border-white-light dark:border-[#1b2e4b]">
                    <th className="min-w-[240px]">Candidate</th>
                    <th className="min-w-[170px]">Applied Position</th>
                    <th className="min-w-[110px]">Experience</th>
                    <th className="min-w-[130px]">Interview Score</th>
                    <th className="min-w-[150px]">Status</th>
                    <th className="min-w-[120px]">Approval</th>
                    <th className="min-w-[90px] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white-light dark:divide-[#1b2e4b]">
                  {candidates.map((cand) => (
                    <tr key={cand._id} className="hover:bg-slate-50/60 dark:hover:bg-[#1b2e4b]/20 transition-colors">
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <Avatar src={cand.avatar} name={cand.name} size="sm" />
                          <div>
                            <div className="font-semibold text-black dark:text-white">{cand.name}</div>
                            <div className="text-xs text-white-dark">{cand.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap font-medium">{cand.appliedPosition}</td>
                      <td className="whitespace-nowrap capitalize">{cand.experienceLevel}</td>
                      <td className="whitespace-nowrap">
                        {cand.interviewScore != null ? (
                          <span className={`font-bold ${cand.interviewScore >= 70 ? 'text-success' : cand.interviewScore >= 50 ? 'text-warning' : 'text-danger'}`}>
                            {cand.interviewScore}%
                          </span>
                        ) : (
                          <span className="text-xs text-white-dark">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={`badge badge-outline-${statusBadge(cand.status)} capitalize`}>
                          {cand.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className={`badge badge-outline-${approvalBadge(cand.approvalStatus)} capitalize`}>
                          {cand.approvalStatus}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-center">
                        <div className="dropdown flex justify-center">
                          <Dropdown
                            offset={[0, 5]}
                            placement="bottom-end"
                            btnClassName="btn btn-sm btn-outline-secondary p-1 hover:bg-slate-100 dark:hover:bg-[#1b2e4b] rounded-lg"
                            button={<MoreHorizontal className="h-5 w-5" />}
                          >
                            <ul className="w-48 text-xs font-semibold bg-white dark:bg-[#0e1726] border border-white-light dark:border-[#1b2e4b] shadow-lg rounded-xl p-1.5 space-y-1 z-50 text-left">
                              <li>
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-white-light/80 dark:hover:bg-dark/40 text-primary transition-colors"
                                  onClick={() => setProfileModal(cand)}
                                >
                                  <Eye className="h-4 w-4 shrink-0" />
                                  <span>View Profile</span>
                                </button>
                              </li>

                              {cand.approvalStatus !== 'approved' && cand.approvalStatus !== 'rejected' && (
                                <li>
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-success/10 text-success transition-colors"
                                    disabled={approvingId === cand._id}
                                    onClick={() => void handleApprove(cand)}
                                  >
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    <span>Approve Candidate</span>
                                  </button>
                                </li>
                              )}

                              <li>
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-info/10 text-info transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  disabled={cand.approvalStatus !== 'approved'}
                                  title={cand.approvalStatus === 'approved' ? 'Schedule Interview' : 'Approve candidate first'}
                                  onClick={() => setScheduleModal(cand)}
                                >
                                  <Calendar className="h-4 w-4 shrink-0" />
                                  <span>Schedule Interview</span>
                                </button>
                              </li>

                              <li>
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-warning/10 text-warning transition-colors"
                                  onClick={() => void handleShortlist(cand)}
                                >
                                  <Star className="h-4 w-4 shrink-0" />
                                  <span>Add to Shortlist</span>
                                </button>
                              </li>

                              {cand.approvalStatus === 'approved' && cand.status !== 'hired' && cand.status !== 'rejected' && (
                                <li>
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-success/10 text-success transition-colors"
                                    onClick={() => void handleHire(cand)}
                                  >
                                    <UserCheck className="h-4 w-4 shrink-0" />
                                    <span>Mark as Hired</span>
                                  </button>
                                </li>
                              )}

                              {cand.approvalStatus !== 'rejected' && cand.status !== 'hired' && (
                                <li className="border-t border-white-light dark:border-[#1b2e4b] pt-1">
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-danger/10 text-danger transition-colors"
                                    onClick={() => setRejectModal(cand)}
                                  >
                                    <XCircle className="h-4 w-4 shrink-0" />
                                    <span>Reject Candidate</span>
                                  </button>
                                </li>
                              )}

                              <li className="border-t border-white-light dark:border-[#1b2e4b] pt-1">
                                <button
                                  type="button"
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-danger/10 text-danger transition-colors"
                                  onClick={() => void handleDelete(cand)}
                                >
                                  <Trash2 className="h-4 w-4 shrink-0" />
                                  <span>Delete Application</span>
                                </button>
                              </li>
                            </ul>
                          </Dropdown>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {candidates.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-white-dark">No candidates found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-white-dark">{total} candidates</span>
              <div className="flex items-center gap-2">
                <button className="btn btn-outline-primary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                <span className="font-semibold text-black dark:text-white">Page {page} of {totalPages}</span>
                <button className="btn btn-outline-primary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {profileModal && (
        <ProfileModal
          cand={profileModal}
          onClose={() => setProfileModal(null)}
          onApprove={(c) => void handleApprove(c)}
          onSchedule={(c) => { setScheduleModal(c); setProfileModal(null); }}
          onShortlist={(c) => void handleShortlist(c)}
          onReject={(c) => { setRejectModal(c); setProfileModal(null); }}
          onHire={(c) => void handleHire(c)}
          onDelete={handleDelete}
          approvingId={approvingId}
        />
      )}

      {scheduleModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-black dark:text-white">Schedule Interview</h3>
            <p className="text-sm text-white-dark">Candidate: <span className="font-bold text-black dark:text-white">{scheduleModal.name}</span></p>
            <form onSubmit={(e) => void handleScheduleSubmit(e)} className="space-y-4">
              <div>
                <label htmlFor="scheduledAt">Date &amp; Time (Somalia time)</label>
                <input id="scheduledAt" type="datetime-local" min={getMinDateTime()} className="form-input" value={scheduledAtDate} onChange={(e) => setScheduledAtDate(e.target.value)} required />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setScheduleModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-black dark:text-white">Reject {rejectModal.name}</h3>
            <form onSubmit={(e) => void handleRejectSubmit(e)} className="space-y-4">
              <div>
                <label htmlFor="rejectReason">Reason (optional, sent in notification email)</label>
                <textarea id="rejectReason" className="form-textarea" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn btn-outline-secondary" onClick={() => { setRejectModal(null); setRejectReason(''); }}>Cancel</button>
                <button type="submit" className="btn btn-danger">Reject &amp; Notify</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyCandidatesPage;
