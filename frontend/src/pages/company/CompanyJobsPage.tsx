import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { NavLink, useNavigate } from 'react-router-dom';
import { Briefcase, Plus, Search, Trash2, Play, Pause, Pencil, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { Job, JobStatus } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const dateTime = (value?: string) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'N/A';

const statusBadge = (status: JobStatus) => {
  switch (status) {
    case 'published':
      return { label: 'Open', color: 'success' };
    case 'draft':
      return { label: 'Draft', color: 'info' };
    case 'paused':
      return { label: 'Paused', color: 'warning' };
    case 'closed':
      return { label: 'Closed', color: 'danger' };
    default:
      return { label: status, color: 'secondary' };
  }
};

const CompanyJobsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await companyService.getJobs({ page, limit: 10, search, status });
      setJobs(res.jobs);
      setTotal(res.pagination.total);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const copyJobLink = (jobId: string) => {
    const publicUrl = `${window.location.origin}/jobs/${jobId}`;
    void navigator.clipboard.writeText(publicUrl);
    toast.success('Job link copied');
  };

  useEffect(() => {
    dispatch(setPageTitle('Jobs | RecruitAI'));
  }, [dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timer);
  }, [page, search, status]);

  const toggleStatus = async (job: Job) => {
    const nextStatus: JobStatus = job.status === 'published' ? 'paused' : 'published';
    try {
      await companyService.updateJob(job._id, { status: nextStatus });
      toast.success(`Job status changed to ${nextStatus}`);
      await load();
    } catch (err: any) {
      toast.error('Failed to update job status');
    }
  };

  const removeJob = async () => {
    if (!deleteTarget) return;
    try {
      await companyService.deleteJob(deleteTarget._id);
      toast.success('Job deleted successfully');
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      toast.error('Failed to delete job');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Jobs</h1>
          <p className="mt-1 text-sm text-white-dark">View and manage all your company's active and posted job requisitions.</p>
        </div>
        <NavLink to="/company/jobs/new" className="btn btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Post Job
        </NavLink>
      </div>

      <div className="panel">
        {/* Search & Filter Bar */}
        <div className="mb-5 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white-dark" />
            <input
              className="form-input pl-9"
              placeholder="Search job title, category, or location..."
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
            <option value="published">Open</option>
            <option value="draft">Draft</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : jobs.length === 0 && !search && !status ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <Briefcase className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-black dark:text-white mb-2">You haven't posted any jobs yet.</h3>
            <p className="text-sm text-white-dark max-w-md mb-6">
              Create your first job requisition to start receiving applicant resumes and configuring automated AI interviews.
            </p>
            <NavLink to="/company/jobs/new" className="btn btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Post Job
            </NavLink>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Job Title</th>
                    <th>Employment Type</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Created Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const badge = statusBadge(job.status);
                    return (
                      <tr key={job._id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Briefcase className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="font-semibold text-black dark:text-white">{job.title}</p>
                              {job.applicationCount !== undefined && (
                                <p className="text-xs text-white-dark">{job.applicationCount} Applicants</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="capitalize">{job.employmentType}</td>
                        <td>{job.location}</td>
                        <td>
                          <span className={`badge badge-outline-${badge.color}`}>{badge.label}</span>
                        </td>
                        <td className="text-xs">{dateTime(job.createdAt)}</td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <button
                              title="Copy Link"
                              className="btn btn-sm btn-outline-secondary p-2"
                              onClick={() => copyJobLink(job._id)}
                            >
                              <LinkIcon className="h-4 w-4" />
                            </button>
                            <button
                              title="Edit Job"
                              className="btn btn-sm btn-outline-info p-2"
                              onClick={() => navigate(`/company/jobs/new?edit=${job._id}`)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              title={job.status === 'published' ? 'Pause Job' : 'Publish Job'}
                              className="btn btn-sm btn-outline-warning p-2"
                              onClick={() => void toggleStatus(job)}
                            >
                              {job.status === 'published' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </button>
                            <button
                              title="Delete Job"
                              className="btn btn-sm btn-outline-danger p-2"
                              onClick={() => setDeleteTarget(job)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-white-dark">
                        No jobs match your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-white-dark">{total} jobs total</span>
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-black dark:text-white">Delete Job</h3>
            <p className="text-sm text-white-dark">
              Are you sure you want to delete <span className="font-bold text-black dark:text-white">{deleteTarget.title}</span>?
            </p>
            <div className="flex justify-end gap-3 pt-3">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void removeJob()}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyJobsPage;
