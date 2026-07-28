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
      {/* Public Top Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-white-light dark:border-white-light/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-black dark:text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>Recruit<span className="text-primary">AI</span></span>
          </Link>

          <div className="flex items-center gap-3">
            {isAuthenticated && user?.role !== 'company' && !(user as any)?.company ? (
              <Link to="/dashboard" className="btn btn-outline-primary btn-sm">
                Dashboard
              </Link>
            ) : !isAuthenticated ? (
              <>
                <Link to={`/login?redirect=/jobs/${jobId}`} className="btn btn-outline-primary btn-sm">
                  Log in
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Sign up
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 pt-6 sm:px-6">
        {/* ─── Hero Header Banner ─── */}
        <div className="panel overflow-hidden border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
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
                <span className="badge badge-outline-primary text-xs font-semibold uppercase">
                  {job.department || 'General'}
                </span>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content (2 Columns) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Job Description */}
          <div className="panel space-y-4">
            <h2 className="text-lg font-bold text-black dark:text-white border-b border-white-light dark:border-white-light/10 pb-3">
              Job Description
            </h2>
            <p className="text-sm leading-relaxed text-white-dark whitespace-pre-line">{job.description}</p>
          </div>

          {/* Responsibilities */}
          {job.responsibilities && (
            <div className="panel space-y-4">
              <h2 className="text-lg font-bold text-black dark:text-white border-b border-white-light dark:border-white-light/10 pb-3">
                Key Responsibilities
              </h2>
              <p className="text-sm leading-relaxed text-white-dark whitespace-pre-line">{job.responsibilities}</p>
            </div>
          )}

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

          {/* Required & Preferred Skills */}
          {((job.requiredSkills && job.requiredSkills.length > 0) ||
            (job.preferredSkills && job.preferredSkills.length > 0)) && (
            <div className="panel space-y-5">
              <h2 className="text-lg font-bold text-black dark:text-white border-b border-white-light dark:border-white-light/10 pb-3 flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Skills & Tech Stack
              </h2>

              {job.requiredSkills && job.requiredSkills.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white-dark mb-2">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.requiredSkills.map((skill, idx) => (
                      <span key={idx} className="badge badge-outline-primary text-xs">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {job.preferredSkills && job.preferredSkills.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white-dark mb-2">Preferred / Nice to Have</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.preferredSkills.map((skill, idx) => (
                      <span key={idx} className="badge badge-outline-secondary text-xs">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Benefits Notes */}
          {job.benefitsNotes && (
            <div className="panel space-y-3">
              <h2 className="text-lg font-bold text-black dark:text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" /> Benefits & Compensation
              </h2>
              <p className="text-sm text-white-dark whitespace-pre-line">{job.benefitsNotes}</p>
            </div>
          )}
        </div>

        {/* Sidebar Summary & AI Interview Specs */}
        <div className="space-y-6">
          {/* AI Interview Breakdown Card */}
          <div className="panel space-y-4 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent border-primary/20">
            <div className="flex items-center gap-2 border-b border-primary/20 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-bold text-black dark:text-white text-sm">Automated AI Interview</h3>
                <p className="text-xs text-white-dark">Required evaluation stage</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-white-light dark:border-white-light/10">
                <span className="text-white-dark flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-primary" /> Language
                </span>
                <span className="font-semibold text-black dark:text-white">{job.interviewLanguage || 'English'}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white-light dark:border-white-light/10">
                <span className="text-white-dark flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-primary" /> Interview Type
                </span>
                <span className="font-semibold text-black dark:text-white capitalize">{job.interviewType || 'mixed'}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white-light dark:border-white-light/10">
                <span className="text-white-dark flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-primary" /> Difficulty Level
                </span>
                <span className="font-semibold text-black dark:text-white capitalize">{job.difficulty || 'mid'}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white-light dark:border-white-light/10">
                <span className="text-white-dark flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Duration
                </span>
                <span className="font-semibold text-black dark:text-white">{job.durationMinutes || 30} minutes</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white-light dark:border-white-light/10">
                <span className="text-white-dark flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-primary" /> Questions
                </span>
                <span className="font-semibold text-black dark:text-white">{job.numberOfQuestions || 5} questions</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-white-dark flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Passing Threshold
                </span>
                <span className="font-semibold text-success">{job.passingScoreThreshold || 70}%</span>
              </div>
            </div>

            <button type="button" className="btn btn-primary w-full mt-3 flex items-center justify-center gap-2" onClick={handleApply}>
              <span>Apply & Start Interview</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
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
