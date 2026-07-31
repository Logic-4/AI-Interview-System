import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Building2,
  MapPin,
  Calendar,
  Briefcase,
  Sparkles,
  ArrowRight,
  Share2,
  CheckCircle2,
  GraduationCap,
  Award,
  Clock,
  HelpCircle,
  ShieldCheck,
  DollarSign,
  Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import publicCompanyService from '@/services/publicCompanyService';
import { Job } from '@/types/companyPortal';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { JobApplicationFormModal } from '@/components/jobs/JobApplicationFormModal';
import ReactMarkdown from 'react-markdown';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'Recently';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(dateStr));
};

const PublicJobDetailsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { jobId } = useParams<{ jobId: string }>();
  const { isAuthenticated, user } = useAuthStore();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!jobId) return;
      setLoading(true);
      setError('');
      try {
        const j = await publicCompanyService.getPublicJobDetails(jobId);
        setJob(j);
        dispatch(setPageTitle(`${j.title} | ${(j.company as any)?.name || 'RecruitAI'}`));
      } catch (err: any) {
        setError(err.response?.data?.message || 'Job posting not found or no longer available.');
        dispatch(setPageTitle('Job Not Found | RecruitAI'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [jobId, dispatch]);

  const copyShareLink = () => {
    void navigator.clipboard.writeText(window.location.href);
    toast.success('Job link copied to clipboard!');
  };

  const handleApply = () => {
    setIsApplyModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-4xl py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger mb-4">
          <Briefcase className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-black dark:text-white mb-2">Job Requisition Unavailable</h2>
        <p className="text-sm text-white-dark mb-6">
          {error || 'This job requisition does not exist or has been unpublished by the employer.'}
        </p>
        <Link to="/" className="btn btn-primary inline-flex items-center gap-2">
          Browse Active Jobs
        </Link>
      </div>
    );
  }

  const company =
    job && typeof job.company === 'object' && job.company !== null
      ? (job.company as { _id?: string; name?: string; logo?: string; contactEmail?: string; phone?: string; website?: string; address?: string })
      : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black/40 pb-12">

      <main className="mx-auto max-w-5xl space-y-6 px-4 pt-6 sm:px-6">
        {/* ─── Hero Header Banner ─── */}
        <div className="panel overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Company Logo Avatar */}
            {company?.logo ? (
              <img
                src={company.logo}
                alt={company.name}
                className="h-20 w-20 shrink-0 rounded-2xl object-cover border border-white-light dark:border-white-light/10 shadow-sm"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white shadow-sm">
                {company?.name ? company.name.charAt(0).toUpperCase() : 'C'}
              </div>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-outline-info text-xs capitalize">{job.employmentType}</span>
                <span className="badge badge-outline-secondary text-xs capitalize">{job.workplaceType}</span>
              </div>

              <h1 className="mt-1 text-2xl font-bold text-black dark:text-white sm:text-3xl">{job.title}</h1>

              {/* Company & Location Info */}
              <div className="mt-2 flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-white-dark">
                {company && (
                  <Link
                    to={`/companies/${company._id}`}
                    className="flex items-center gap-1 font-semibold text-black dark:text-white hover:text-primary transition-colors"
                  >
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    {company.name}
                  </Link>
                )}

                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  {job.location}
                </span>

                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  Posted {formatDate(job.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 md:pt-0">
            <button
              type="button"
              className="btn btn-outline-secondary flex items-center gap-2"
              onClick={copyShareLink}
              title="Share Job"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </button>

            <button type="button" className="btn btn-primary flex items-center gap-2 px-6" onClick={handleApply}>
              <span>Apply Now</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="panel space-y-4">
          <h2 className="text-lg font-bold text-black dark:text-white border-b border-white-light dark:border-white-light/10 pb-3">
            Job Description
          </h2>
          <div className="prose dark:prose-invert max-w-none text-sm text-white-dark prose-headings:text-black dark:prose-headings:text-white prose-strong:text-black dark:prose-strong:text-white prose-p:text-white-dark prose-li:text-white-dark">
            <ReactMarkdown>{job.description}</ReactMarkdown>
          </div>
        </div>


        {/* Education & Experience Requirements */}
        {(job.requiredEducation || job.experienceLevel) && (
          <div className="panel space-y-4">
            <h2 className="text-lg font-bold text-black dark:text-white border-b border-white-light dark:border-white-light/10 pb-3 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Requirements & Qualifications
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-white-dark block">Experience Level</span>
                <span className="font-semibold text-black dark:text-white capitalize">{job.experienceLevel} Level</span>
              </div>
              {job.requiredEducation && (
                <div className="sm:col-span-2">
                  <span className="text-xs text-white-dark block mb-1">Education Requirements</span>
                  <p className="text-sm text-black dark:text-white">{job.requiredEducation}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Required Skills */}
        {job.requiredSkills && job.requiredSkills.length > 0 && (
          <div className="panel space-y-5">
            <h2 className="text-lg font-bold text-black dark:text-white border-b border-white-light dark:border-white-light/10 pb-3 flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Required Skills
            </h2>

            <div className="flex flex-wrap gap-2">
              {job.requiredSkills.map((skill, idx) => (
                <span key={idx} className="badge badge-outline-primary text-xs">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      </main>

      {/* Dynamic Job Application Form Modal */}
      {job && (
        <JobApplicationFormModal
          job={job}
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
        />
      )}
    </div>
  );
};

export default PublicJobDetailsPage;
