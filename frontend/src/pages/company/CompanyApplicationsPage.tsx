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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { Application, ApplicationStatus } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

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
 * CandidateAvatar - Clean avatar with automatic image error fallback
 */
const CandidateAvatar = ({ src, name, size = 'md' }: { src?: string; name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
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
        className={`${sizeClasses} rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-md shrink-0`}
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
      className={`${sizeClasses} flex items-center justify-center rounded-full bg-gradient-to-tr from-primary via-indigo-600 to-purple-600 font-bold text-white shadow-md border-2 border-white dark:border-slate-800 shrink-0`}
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
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-dark" />
            <input
              className="form-input pl-9"
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
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Job Title</th>
                    <th>Phone Number</th>
                    <th>Applied Date</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => {
                    const jobTitle = typeof app.job === 'object' ? app.job?.title : 'Role';
                    return (
                      <tr key={app._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td>
                          <div className="flex items-center gap-3">
                            <CandidateAvatar src={app.profilePhotoUrl} name={app.candidateName} size="md" />
                            <div>
                              <div className="font-semibold text-black dark:text-white">{app.candidateName}</div>
                              <div className="text-xs text-white-dark">{app.candidateEmail}</div>
                            </div>
                          </div>
                        </td>
                        <td className="font-medium text-black dark:text-white">{jobTitle}</td>
                        <td className="text-xs">{app.candidatePhone || 'N/A'}</td>
                        <td className="text-xs">{dateTime(app.appliedDate)}</td>
                        <td>
                          <span className={`badge badge-outline-${statusBadge(app.status)} capitalize`}>
                            {app.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <button
                              title="View Candidate Details"
                              className="btn btn-sm btn-outline-primary flex items-center gap-1.5 px-3"
                              onClick={() => setDetailApp(app)}
                            >
                              <Eye className="h-4 w-4" />
                              <span>View Candidate</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {applications.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-white-dark">
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
                <CandidateAvatar src={detailApp.profilePhotoUrl} name={detailApp.candidateName} size="lg" />
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-black dark:text-white leading-tight">
                      {detailApp.candidateName}
                    </h2>
                    <span className={`badge badge-outline-${statusBadge(detailApp.status)} capitalize text-xs font-bold`}>
                      {detailApp.status.replace('_', ' ')}
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
                <button
                  type="button"
                  className="btn btn-outline-success btn-sm flex items-center gap-1.5"
                  onClick={() => void updateStatus(detailApp._id, 'shortlisted', true)}
                >
                  <Star className="h-4 w-4" />
                  <span>Move to Shortlist</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm flex items-center gap-1.5"
                  onClick={() => void updateStatus(detailApp._id, 'rejected', false)}
                >
                  <XCircle className="h-4 w-4" />
                  <span>Reject Candidate</span>
                </button>
              </div>

              <button type="button" className="btn btn-primary px-6 btn-sm" onClick={() => setDetailApp(null)}>
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
