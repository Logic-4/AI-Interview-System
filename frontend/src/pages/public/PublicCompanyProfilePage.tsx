import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Building2,
  MapPin,
  Globe,
  Mail,
  Phone,
  Briefcase,
  Search,
  Calendar,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { setPageTitle } from '@/store/themeConfigSlice';
import publicCompanyService from '@/services/publicCompanyService';
import { CompanyProfile, Job } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

import { useAuthStore } from '@/stores/authStore';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'Recently';
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(dateStr));
};

const PublicCompanyProfilePage = () => {
  const dispatch = useDispatch();
  const { companyId } = useParams<{ companyId: string }>();
  const { isAuthenticated, user } = useAuthStore();

  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!companyId) return;
      setLoading(true);
      setError('');
      try {
        const [compData, jobsData] = await Promise.all([
          publicCompanyService.getPublicCompany(companyId),
          publicCompanyService.getPublicCompanyJobs(companyId),
        ]);
        setCompany(compData);
        setJobs(jobsData);
        dispatch(setPageTitle(`${compData.name} | Company Profile`));
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load company profile');
        dispatch(setPageTitle('Company Not Found'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [companyId, dispatch]);

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      (job.location && job.location.toLowerCase().includes(search.toLowerCase()));
    const matchesType = !employmentTypeFilter || job.employmentType === employmentTypeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="mx-auto max-w-4xl py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger mb-4">
          <Building2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-black dark:text-white mb-2">Company Not Found</h2>
        <p className="text-sm text-white-dark mb-6">
          {error || 'The company profile you are looking for does not exist or is currently inactive.'}
        </p>
        <Link to="/" className="btn btn-primary inline-flex items-center gap-2">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black/40 pb-12">
      {/* Public Top Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-white-light dark:border-white-light/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
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
                <Link to="/login" className="btn btn-outline-primary btn-sm">
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

      <main className="mx-auto max-w-6xl space-y-6 px-4 pt-6 sm:px-6">
        {/* ─── 1. Company Banner & Basic Info Card ─── */}
        <div className="panel overflow-hidden border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Logo Avatar */}
            {company.logo ? (
              <img
                src={company.logo}
                alt={company.name}
                className="h-20 w-20 shrink-0 rounded-2xl object-cover border border-white-light dark:border-white-light/10 shadow-sm"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white shadow-sm">
                {company.name.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Company Info Header */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-black dark:text-white sm:text-3xl">{company.name}</h1>
                <span className="badge badge-outline-primary text-xs">Verified Company</span>
              </div>

              {/* Location & Website */}
              <div className="mt-2 flex flex-wrap items-center gap-y-2 gap-x-4 text-sm text-white-dark">
                {company.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    {company.address}
                  </span>
                )}

                {company.website && (
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4 shrink-0" />
                    {company.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Contact Details Pills */}
          <div className="flex flex-wrap gap-2 pt-2 md:pt-0">
            {company.contactEmail && (
              <a
                href={`mailto:${company.contactEmail}`}
                className="btn btn-outline-secondary btn-sm flex items-center gap-2"
              >
                <Mail className="h-4 w-4 text-primary" />
                <span>{company.contactEmail}</span>
              </a>
            )}
            {company.phone && (
              <span className="btn btn-outline-secondary btn-sm flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span>{company.phone}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. About Company Description ─── */}
      {company.description && (
        <div className="panel space-y-3">
          <h2 className="text-lg font-bold text-black dark:text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            About {company.name}
          </h2>
          <p className="text-sm leading-relaxed text-white-dark whitespace-pre-line">{company.description}</p>
        </div>
      )}

      {/* ─── 3. Open Job Postings Section ─── */}
      <div className="panel space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white-light dark:border-white-light/10 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-black dark:text-white">Open Positions</h2>
              <span className="badge badge-outline-primary">{jobs.length} Available</span>
            </div>
            <p className="mt-1 text-xs text-white-dark">Explore active career opportunities and apply directly.</p>
          </div>

          {/* Search & Filter Controls */}
          {jobs.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-dark" />
                <input
                  type="text"
                  placeholder="Search job title, category..."
                  className="form-input pl-9 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="form-select text-sm sm:w-40"
                value={employmentTypeFilter}
                onChange={(e) => setEmploymentTypeFilter(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
          )}
        </div>

        {/* Job Cards Grid */}
        {filteredJobs.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredJobs.map((job) => (
              <div
                key={job._id}
                className="group relative flex flex-col justify-between rounded-xl border border-white-light dark:border-white-light/10 bg-white dark:bg-black/20 p-5 transition-all duration-200 hover:border-primary/50 hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-black dark:text-white transition-colors group-hover:text-primary">
                        <Link to={`/jobs/${job._id}`}>{job.title}</Link>
                      </h3>
                    </div>
                    <span className="badge badge-outline-info text-xs capitalize shrink-0">{job.employmentType}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-white-dark">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      {formatDate(job.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white-light dark:border-white-light/10 pt-3">
                  <span className="text-xs font-medium text-white-dark flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Interview Enabled
                  </span>
                  <Link to={`/jobs/${job._id}`} className="btn btn-primary btn-sm flex items-center gap-1.5">
                    <span>Apply</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              <Briefcase className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-black dark:text-white mb-1">
              {jobs.length === 0 ? 'No Open Positions Currently Available' : 'No Jobs Match Your Filters'}
            </h3>
            <p className="text-xs text-white-dark max-w-md">
              {jobs.length === 0
                ? `${company.name} has not posted any active job requisitions at this time. Check back later for new openings.`
                : 'Try clearing your search query or changing the employment type filter to view available jobs.'}
            </p>
          </div>
        )}
      </div>
      </main>
    </div>
  );
};

export default PublicCompanyProfilePage;
