import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  Search,
  Eye,
  FileText,
  CheckCircle2,
  XCircle,
  Star,
  Download,
  ExternalLink,
  Calendar,
  Clock,
  Phone,
  Mail,
  User,
  X,
  Briefcase,
  Copy,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { Application, ApplicationStatus, ApprovalStatus } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Dropdown from '@/components/Dropdown';

const approvalBadge = (status: ApprovalStatus) =>
  ({ approved: 'success', rejected: 'danger', pending: 'warning' })[status] || 'secondary';

const dateTime = (value?: string) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'N/A';

const formatDateOnly = (value?: string) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date(value)) : 'N/A';

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

/**
 * CandidateAvatar - Clean avatar with automatic image error fallback and click handler
 */
const CandidateAvatar = ({
  src,
  name,
  size = 'md',
  onClick,
}: {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-xl',
    xl: 'h-20 w-20 text-2xl',
  }[size];

  const isValidUrl = src && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:image/'));

  if (isValidUrl && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        onClick={onClick}
        className={`${sizeClasses} rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-md shrink-0 ${
          onClick ? 'cursor-pointer hover:scale-105 transition hover:ring-2 hover:ring-primary' : ''
        }`}
        title={onClick ? 'Click to view full photo' : undefined}
      />
    );
  }

  const initials =
    name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase() || 'C';

  return (
    <div
      onClick={onClick}
      className={`${sizeClasses} flex items-center justify-center rounded-full bg-gradient-to-tr from-primary via-indigo-600 to-purple-600 font-bold text-white shadow-md border-2 border-white dark:border-slate-800 shrink-0 ${
        onClick ? 'cursor-pointer hover:scale-105 transition' : ''
      }`}
      title={onClick ? 'Click to view avatar' : undefined}
    >
      {initials}
    </div>
  );
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
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; name: string } | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejectReasonOpen, setRejectReasonOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

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
    dispatch(setPageTitle('Job Applications | RecruitAI'));
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
      toast.success(`Application status updated to ${nextStatus.replace('_', ' ')}`);
      await load();
      if (detailApp?._id === appId) {
        setDetailApp((prev) => (prev ? { ...prev, status: nextStatus, isShortlisted: !!isShortlisted } : null));
      }
    } catch (err: any) {
      toast.error('Failed to update application status');
    }
  };

  const handleApprove = async (appId: string) => {
    setApproving(true);
    try {
      const updated = await companyService.approveApplication(appId);
      toast.success('Application approved — candidate notified by email');
      await load();
      if (detailApp?._id === appId) setDetailApp(updated);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve application');
    } finally {
      setApproving(false);
    }
  };

  const handleRejectSubmit = async (appId: string) => {
    try {
      const updated = await companyService.rejectCandidate(appId, rejectReason.trim() || undefined);
      toast.success('Application rejected — candidate notified by email');
      setRejectReasonOpen(false);
      setRejectReason('');
      await load();
      if (detailApp?._id === appId) setDetailApp(updated);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject application');
    }
  };

  const handleDelete = async (app: Application) => {
    if (!window.confirm(`Delete ${app.candidateName}'s application permanently? This also deletes its linked interview and cannot be undone.`)) return;
    try {
      await companyService.deleteApplication(app._id);
      toast.success('Application deleted');
      if (detailApp?._id === app._id) setDetailApp(null);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete application');
    }
  };

  const copyText = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Job Applications</h1>
        <p className="mt-1 text-sm text-white-dark">Review candidate submissions across all your posted job roles.</p>
      </div>

      <div className="panel">
        <div className="mb-5 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white-dark pointer-events-none z-10" />
            <input
              className="form-input pl-10"
              placeholder="Search by candidate name, email, or phone..."
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
            <option value="hired">Hired</option>
          </select>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div className="table-responsive overflow-x-auto w-full">
              <table className="w-full text-left align-middle min-w-[850px]">
                <thead>
                  <tr className="border-b border-white-light dark:border-[#1b2e4b]">
                    <th className="min-w-[220px]">Candidate</th>
                    <th className="min-w-[170px]">Job Title</th>
                    <th className="min-w-[130px]">Phone Number</th>
                    <th className="min-w-[150px]">Applied Date</th>
                    <th className="min-w-[130px]">Status</th>
                    <th className="min-w-[120px]">Approval</th>
                    <th className="min-w-[90px] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white-light dark:divide-[#1b2e4b]">
                  {applications.map((app) => {
                    const jobTitle = typeof app.job === 'object' ? app.job?.title : 'Role';
                    return (
                      <tr key={app._id} className="hover:bg-slate-50/60 dark:hover:bg-[#1b2e4b]/20 transition-colors">
                        <td className="whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <CandidateAvatar
                              src={app.profilePhotoUrl}
                              name={app.candidateName}
                              size="md"
                              onClick={app.profilePhotoUrl ? () => setPreviewPhoto({ url: app.profilePhotoUrl || '', name: app.candidateName }) : undefined}
                            />
                            <div>
                              <div className="font-semibold text-black dark:text-white">{app.candidateName}</div>
                              <div className="text-xs text-white-dark">{app.candidateEmail}</div>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap font-medium text-black dark:text-white">{jobTitle}</td>
                        <td className="whitespace-nowrap text-xs">{app.candidatePhone || 'N/A'}</td>
                        <td className="whitespace-nowrap text-xs">{dateTime(app.appliedDate)}</td>
                        <td className="whitespace-nowrap">
                          <span className={`badge badge-outline-${statusBadge(app.status)} capitalize`}>
                            {app.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className={`badge badge-outline-${approvalBadge(app.approvalStatus)} capitalize`}>
                            {app.approvalStatus}
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
                                    onClick={() => setDetailApp(app)}
                                  >
                                    <Eye className="h-4 w-4 shrink-0" />
                                    <span>View Candidate</span>
                                  </button>
                                </li>

                                {app.approvalStatus !== 'approved' && app.approvalStatus !== 'rejected' && (
                                  <li>
                                    <button
                                      type="button"
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-success/10 text-success transition-colors"
                                      onClick={() => void handleApprove(app._id)}
                                    >
                                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                                      <span>Approve Application</span>
                                    </button>
                                  </li>
                                )}

                                <li>
                                  <button
                                    type="button"
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-warning/10 text-warning transition-colors"
                                    onClick={() => void updateStatus(app._id, 'shortlisted', true)}
                                  >
                                    <Star className="h-4 w-4 shrink-0" />
                                    <span>Move to Shortlist</span>
                                  </button>
                                </li>

                                {app.approvalStatus !== 'rejected' && (
                                  <li>
                                    <button
                                      type="button"
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-danger/10 text-danger transition-colors"
                                      onClick={() => {
                                        setDetailApp(app);
                                        setRejectReasonOpen(true);
                                      }}
                                    >
                                      <XCircle className="h-4 w-4 shrink-0" />
                                      <span>Reject Candidate</span>
                                    </button>
                                  </li>
                                )}
                                <li className="border-t border-white-light dark:border-[#1b2e4b] pt-1">
                                  <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-danger/10 text-danger transition-colors" onClick={() => void handleDelete(app)}>
                                    <Trash2 className="h-4 w-4 shrink-0" />
                                    <span>Delete Application</span>
                                  </button>
                                </li>
                              </ul>
                            </Dropdown>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {applications.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-white-dark">
                        No candidate applications found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-5 flex items-center justify-between text-sm border-t border-white-light dark:border-white-light/10 pt-4">
              <span className="text-white-dark">{total} total applications</span>
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

      {/* ─── Premium Candidate Profile Modal ─── */}
      {detailApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-white-light dark:border-white-light/10 my-8">
            {/* Modal Header */}
            <div className="p-6 border-b border-white-light dark:border-white-light/10 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CandidateAvatar
                  src={detailApp.profilePhotoUrl}
                  name={detailApp.candidateName}
                  size="lg"
                  onClick={detailApp.profilePhotoUrl ? () => setPreviewPhoto({ url: detailApp.profilePhotoUrl || '', name: detailApp.candidateName }) : undefined}
                />
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-black dark:text-white leading-tight">
                      {detailApp.candidateName}
                    </h2>
                    <span className={`badge badge-outline-${statusBadge(detailApp.status)} capitalize text-xs font-bold`}>
                      {detailApp.status.replace('_', ' ')}
                    </span>
                    <span className={`badge badge-outline-${approvalBadge(detailApp.approvalStatus)} capitalize text-xs font-bold`}>
                      {detailApp.approvalStatus}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-primary flex items-center gap-1 mt-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    {typeof detailApp.job === 'object' ? detailApp.job?.title : 'Applicant'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="h-8 w-8 rounded-full bg-slate-200/60 dark:bg-slate-700 text-white-dark hover:text-black dark:hover:text-white flex items-center justify-center transition"
                onClick={() => setDetailApp(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[65vh] overflow-y-auto">
              {/* Left Column (1/3): Personal & Resume */}
              <div className="space-y-6">
                {/* Personal Information */}
                <div className="panel space-y-4 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <User className="h-4 w-4" /> Personal Information
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-white-dark block text-[11px] mb-0.5">Full Name</span>
                      <span className="font-semibold text-black dark:text-white text-sm">{detailApp.candidateName}</span>
                    </div>

                    <div>
                      <span className="text-white-dark block text-[11px] mb-0.5">Email Address</span>
                      <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                        <a
                          href={`mailto:${detailApp.candidateEmail}`}
                          className="font-medium text-primary hover:underline truncate text-xs flex items-center gap-1"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{detailApp.candidateEmail}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => copyText(detailApp.candidateEmail, 'Email')}
                          className="text-white-dark hover:text-black dark:hover:text-white"
                          title="Copy Email"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-white-dark block text-[11px] mb-0.5">Phone Number</span>
                      <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                        <span className="font-medium text-black dark:text-white text-xs flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                          {detailApp.candidatePhone || 'Not provided'}
                        </span>
                        {detailApp.candidatePhone && (
                          <button
                            type="button"
                            onClick={() => copyText(detailApp.candidatePhone || '', 'Phone number')}
                            className="text-white-dark hover:text-black dark:hover:text-white"
                            title="Copy Phone"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resume / CV Card */}
                <div className="panel space-y-3 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <FileText className="h-4 w-4" /> Resume Document
                  </h3>

                  {detailApp.resumeUrl ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="overflow-hidden">
                          <span className="font-semibold text-black dark:text-white text-xs block truncate">Candidate Resume</span>
                          <span className="text-[10px] text-white-dark block">Vercel Blob Storage</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <a
                          href={detailApp.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-sm w-full flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span>View Resume (PDF / DOCX)</span>
                        </a>
                        <a
                          href={detailApp.resumeUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline-secondary btn-sm w-full flex items-center justify-center gap-1.5"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download File</span>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-white-dark italic">No resume file was required or uploaded for this candidate.</p>
                  )}
                </div>
              </div>

              {/* Right Column (2/3): Application Details & Interactive Settings */}
              <div className="md:col-span-2 space-y-6">
                {/* Application Overview & Status Controls */}
                <div className="panel space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 border-b border-white-light dark:border-white-light/10 pb-2">
                    <Briefcase className="h-4 w-4" /> Application Overview & Status
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-white-dark block mb-1">Target Job Requisition</span>
                      <span className="font-bold text-black dark:text-white text-sm block">
                        {typeof detailApp.job === 'object' ? detailApp.job?.title : 'Role'}
                      </span>
                    </div>

                    <div>
                      <span className="text-white-dark block mb-1">Applied Date & Time</span>
                      <span className="font-medium text-black dark:text-white text-xs block">
                        {dateTime(detailApp.appliedDate)}
                      </span>
                    </div>

                    <div className="sm:col-span-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-white-light dark:border-white-light/10 space-y-2">
                      <label className="text-xs font-bold text-black dark:text-white block">
                        Update Candidate Application Status
                      </label>
                      <select
                        className="form-select text-sm"
                        value={detailApp.status}
                        onChange={(e) => void updateStatus(detailApp._id, e.target.value as ApplicationStatus)}
                      >
                        <option value="applied">Applied (Initial Submission)</option>
                        <option value="under_review">Under Review</option>
                        <option value="interview_scheduled">Interview Scheduled</option>
                        <option value="interviewed">Interview Completed</option>
                        <option value="shortlisted">Shortlisted Candidate</option>
                        <option value="rejected">Rejected</option>
                        <option value="hired">Hired</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Candidate Selected Interview Slot */}
                {(detailApp.selectedInterviewDate || detailApp.selectedInterviewTime) && (
                  <div className="panel bg-primary/5 border border-primary/20 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" /> Selected AI Interview Slot
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-primary/20">
                        <Calendar className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <span className="text-[10px] text-white-dark block">Booked Date</span>
                          <span className="font-bold text-black dark:text-white text-xs">
                            {formatDateOnly(detailApp.selectedInterviewDate as any)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-primary/20">
                        <Clock className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <span className="text-[10px] text-white-dark block">Time Slot</span>
                          <span className="font-bold text-primary text-xs">{detailApp.selectedInterviewTime || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cover Letter Section */}
                {detailApp.coverLetter && (
                  <div className="panel space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Cover Letter Statement</h3>
                    <div className="text-xs text-black dark:text-white leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-white-light dark:border-white-light/10 italic">
                      "{detailApp.coverLetter}"
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-white-light dark:border-white-light/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {detailApp.approvalStatus !== 'approved' && (
                  <button
                    type="button"
                    className="btn btn-success btn-sm flex items-center gap-1.5"
                    disabled={approving}
                    onClick={() => void handleApprove(detailApp._id)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Approve Application</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm flex items-center gap-1.5"
                  onClick={() => void updateStatus(detailApp._id, 'shortlisted', true)}
                >
                  <Star className="h-4 w-4" />
                  <span>Move to Shortlist</span>
                </button>
                {detailApp.approvalStatus !== 'rejected' && (
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm flex items-center gap-1.5"
                    onClick={() => setRejectReasonOpen(true)}
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Reject Candidate</span>
                  </button>
                )}
                <button type="button" className="btn btn-outline-danger btn-sm flex items-center gap-1.5" onClick={() => void handleDelete(detailApp)}>
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </button>
              </div>

              <button type="button" className="btn btn-primary px-6 btn-sm" onClick={() => setDetailApp(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Photo Lightbox Preview Modal ─── */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-2xl max-h-[85vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10 space-y-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10 text-white bg-slate-800/60">
              <div>
                <h3 className="font-bold text-sm text-white">{previewPhoto.name}</h3>
                <p className="text-[11px] text-slate-400">Candidate Profile Photo (Vercel Blob)</p>
              </div>
              <button
                type="button"
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
                onClick={() => setPreviewPhoto(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 flex items-center justify-center bg-black/50">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.name}
                className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/10"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Reject with Reason Modal ─── */}
      {rejectReasonOpen && detailApp && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="panel w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-black dark:text-white">Reject {detailApp.candidateName}</h3>
            <div>
              <label htmlFor="appRejectReason">Reason (optional, included in the candidate&apos;s email)</label>
              <textarea
                id="appRejectReason"
                className="form-textarea"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setRejectReasonOpen(false);
                  setRejectReason('');
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void handleRejectSubmit(detailApp._id)}>
                Reject &amp; Notify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyApplicationsPage;
