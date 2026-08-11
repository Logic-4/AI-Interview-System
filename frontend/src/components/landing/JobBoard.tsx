import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, Clock, ArrowRight, Building2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import publicCompanyService from '@/services/publicCompanyService';
import { Job } from '@/types/companyPortal';
import { JobApplicationFormModal } from '@/components/jobs/JobApplicationFormModal';

const TYPE_LABELS: Record<string, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

const formatDeadline = (d?: string) =>
  d ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(d)) : null;

export function JobBoard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Job | null>(null);

  useEffect(() => {
    publicCompanyService.getAllPublicJobs()
      .then(setJobs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && jobs.length === 0) return null;

  return (
    <section id="job-board" className="relative py-20 md:py-24 bg-surface/50 border-y border-border/40">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider text-primary">
            <Briefcase className="h-3.5 w-3.5" />
            <span>Open Positions</span>
          </div>
          <h2 className="mt-4 text-4xl md:text-5xl font-bold leading-tight">
            Explore <span className="text-gradient">Live Job Openings</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Apply directly and complete an AI-powered interview — no scheduling, no waiting.
          </p>
        </motion.div>

        {loading ? (
          <div className="mt-14 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job, idx) => {
              const companyObj = typeof job.company === 'object' && job.company !== null ? job.company as any : null;
              const companyName: string = companyObj?.name ?? 'Company';
              const companyLogo: string | undefined = companyObj?.logo;
              const deadline = formatDeadline(job.applicationDeadline);

              return (
                <motion.div
                  key={job._id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.45, delay: idx * 0.06 }}
                  className="flex flex-col rounded-2xl bg-card border border-border shadow-card hover:border-primary/50 transition-all p-6"
                >
                  {/* Company */}
                  <div className="flex items-center gap-3 mb-4">
                    {companyLogo ? (
                      <img src={companyLogo} alt={companyName} className="h-9 w-9 rounded-lg object-contain border border-border" />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                        <Building2 className="h-4.5 w-4.5" />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-muted-foreground truncate">{companyName}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-foreground leading-snug mb-3">{job.title}</h3>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground mb-4">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {job.location}
                      </span>
                    )}
                    {job.employmentType && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" /> {TYPE_LABELS[job.employmentType] ?? job.employmentType}
                      </span>
                    )}
                    {deadline && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Deadline: {deadline}
                      </span>
                    )}
                  </div>

                  {/* Skills */}
                  {job.requiredSkills?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {job.requiredSkills.slice(0, 4).map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                          {s}
                        </span>
                      ))}
                      {job.requiredSkills.length > 4 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-muted-foreground">
                          +{job.requiredSkills.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelected(job)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      Apply Now <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <Link
                      to={`/jobs/${job._id}`}
                      className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
                      title="View full job details"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <JobApplicationFormModal
          job={selected}
          isOpen
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
