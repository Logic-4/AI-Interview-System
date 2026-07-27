import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Award, Eye, CheckCircle2, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { CompanyAssessment } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const dateTime = (value?: string) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'N/A';

const CompanyAssessmentsPage = () => {
  const dispatch = useDispatch();
  const [assessments, setAssessments] = useState<CompanyAssessment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CompanyAssessment | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await companyService.getAssessments({ page, limit: 10 });
      setAssessments(res.assessments);
      setTotal(res.pagination.total);
    } catch (err: any) {
      toast.error('Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(setPageTitle('Assessments | RecruitAI'));
    void load();
  }, [dispatch, page]);

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">Assessments</h1>
        <p className="mt-1 text-sm text-white-dark">Review AI score metrics, pass/fail evaluation statuses, and detailed skill breakdowns.</p>
      </div>

      <div className="panel">
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
                    <th>Assessment Type</th>
                    <th>Score</th>
                    <th>Pass / Fail Status</th>
                    <th>Completion Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((ass) => (
                    <tr key={ass._id}>
                      <td>
                        <div className="font-semibold text-black dark:text-white">{ass.candidateName || ass.candidate?.name}</div>
                        <div className="text-xs text-white-dark">{ass.candidate?.email}</div>
                      </td>
                      <td>{ass.job?.title || 'General Role'}</td>
                      <td>{ass.assessmentType}</td>
                      <td>
                        <span className="font-bold text-primary">{ass.score}%</span>
                      </td>
                      <td>
                        <span
                          className={`badge badge-outline-${
                            ass.passFailStatus === 'passed' ? 'success' : ass.passFailStatus === 'failed' ? 'danger' : 'warning'
                          } capitalize`}
                        >
                          {ass.passFailStatus}
                        </span>
                      </td>
                      <td className="text-xs">{dateTime(ass.completionDate)}</td>
                      <td>
                        <div className="flex justify-end">
                          <button
                            title="View Full Report"
                            className="btn btn-sm btn-outline-primary p-2"
                            onClick={() => setDetail(ass)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {assessments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-white-dark">
                        No completed candidate assessments yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-white-dark">{total} assessments</span>
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

      {/* Detail Report Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="panel w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white-light dark:border-white-light/10 pb-3">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-black dark:text-white">Assessment Detailed Report</h3>
              </div>
              <button
                type="button"
                className="text-white-dark hover:text-danger text-lg font-bold"
                onClick={() => setDetail(null)}
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-white-dark">Candidate</p>
                <p className="font-semibold text-black dark:text-white">{detail.candidateName || detail.candidate?.name}</p>
              </div>
              <div>
                <p className="text-xs text-white-dark">Evaluation Score</p>
                <p className="font-extrabold text-2xl text-primary">{detail.score}%</p>
              </div>
              <div>
                <p className="text-xs text-white-dark">Result</p>
                <span
                  className={`badge badge-outline-${
                    detail.passFailStatus === 'passed' ? 'success' : detail.passFailStatus === 'failed' ? 'danger' : 'warning'
                  } capitalize font-bold`}
                >
                  {detail.passFailStatus}
                </span>
              </div>
              <div>
                <p className="text-xs text-white-dark">Completed On</p>
                <p className="font-semibold">{dateTime(detail.completionDate)}</p>
              </div>
            </div>

            {detail.summaryNotes && (
              <div>
                <p className="text-xs font-bold text-white-dark mb-1">Executive Summary</p>
                <p className="rounded-lg border border-white-light p-3 text-xs dark:border-white-light/10">
                  {detail.summaryNotes}
                </p>
              </div>
            )}

            {detail.strengths && detail.strengths.length > 0 && (
              <div>
                <p className="text-xs font-bold text-success mb-1">Key Strengths</p>
                <ul className="list-disc pl-5 text-xs text-white-dark space-y-1">
                  {detail.strengths.map((str, i) => (
                    <li key={i}>{str}</li>
                  ))}
                </ul>
              </div>
            )}

            {detail.improvements && detail.improvements.length > 0 && (
              <div>
                <p className="text-xs font-bold text-warning mb-1">Recommended Areas for Improvement</p>
                <ul className="list-disc pl-5 text-xs text-white-dark space-y-1">
                  {detail.improvements.map((imp, i) => (
                    <li key={i}>{imp}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-3">
              <button className="btn btn-primary" onClick={() => setDetail(null)}>
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyAssessmentsPage;
