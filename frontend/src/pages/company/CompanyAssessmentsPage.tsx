import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Award, Eye, ShieldCheck, ShieldX, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { CompanyAssessment, QuestionEvaluation, ProctoringViolation } from '@/types/companyPortal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const dateTime = (value?: string) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : 'N/A';

const dateTimeShort = (value?: string) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'N/A';

const VIOLATION_LABEL: Record<string, string> = {
  tab_switch: 'Tab switch',
  window_blur: 'Window unfocused',
  gaze_away: 'Gaze away',
  face_not_detected: 'Face not detected',
};


function ScoreBar({ score, passingScore }: { score: number; passingScore: number }) {
  const clampedScore = Math.min(100, Math.max(0, score));
  const clampedThreshold = Math.min(100, Math.max(0, passingScore));
  const passed = score >= passingScore;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-white-dark">
        <span>0</span>
        <span className="font-semibold text-danger" style={{ marginLeft: `${clampedThreshold}%`, transform: 'translateX(-50%)' }}>
          Threshold {passingScore}%
        </span>
        <span>100</span>
      </div>
      <div className="relative h-4 rounded-full bg-gray-200 dark:bg-dark overflow-visible">
        {/* score fill */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${passed ? 'bg-success' : 'bg-danger'}`}
          style={{ width: `${clampedScore}%` }}
        />
        {/* threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-danger z-10"
          style={{ left: `${clampedThreshold}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-6 w-0.5 bg-danger opacity-60" />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className={`font-bold ${passed ? 'text-success' : 'text-danger'}`}>
          Score: {score}%
        </span>
        <span className="text-white-dark">Threshold: {passingScore}%</span>
      </div>
    </div>
  );
}


function IdentityVerificationCard({ iv }: { iv: CompanyAssessment['identityVerification'] }) {
  if (!iv || iv.status === 'not_required') return null;

  const statusConfig: Record<string, { icon: typeof ShieldCheck; color: string; label: string }> = {
    passed: { icon: ShieldCheck, color: 'text-success', label: 'Identity verified' },
    failed: { icon: ShieldX, color: 'text-danger', label: 'Identity check failed' },
    blocked: { icon: ShieldX, color: 'text-danger', label: 'Blocked — identity mismatch' },
    pending: { icon: AlertTriangle, color: 'text-warning', label: 'Verification pending' },
  };
  const cfg = statusConfig[iv.status] ?? { icon: AlertTriangle, color: 'text-warning', label: iv.status };
  const Icon = cfg.icon;

  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${
      iv.status === 'passed'
        ? 'border-success/30 bg-success/5'
        : iv.status === 'pending'
        ? 'border-warning/30 bg-warning/5'
        : 'border-danger/30 bg-danger/5'
    }`}>
      <Icon className={`h-5 w-5 shrink-0 ${cfg.color}`} />
      <div className="flex-1 text-sm">
        <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
        {iv.similarity != null && (
          <span className="ml-2 text-xs text-white-dark">
            Similarity {iv.similarity.toFixed(1)}%
            {iv.threshold != null && ` (threshold ${iv.threshold}%)`}
          </span>
        )}
        {iv.attempts != null && iv.attempts > 0 && (
          <span className="ml-2 text-xs text-white-dark">· {iv.attempts} attempt{iv.attempts !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
}

function QuestionCard({ q, index }: { q: QuestionEvaluation; index: number }) {
  const [open, setOpen] = useState(false);
  const hasContent = q.userAnswer || q.aiFeedback;

  return (
    <div className="rounded-lg border border-white-light dark:border-white-light/10 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-dark/50 transition-colors"
        onClick={() => hasContent && setOpen(!open)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-black dark:text-white truncate">{q.text}</p>
            <p className="text-xs text-white-dark capitalize">{q.category}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {q.score !== null && q.score !== undefined ? (
            <span className={`text-sm font-bold ${q.score >= 70 ? 'text-success' : q.score >= 50 ? 'text-warning' : 'text-danger'}`}>
              {q.score}%
            </span>
          ) : (
            <span className="text-xs text-white-dark">N/A</span>
          )}
          {hasContent && (
            open ? <ChevronUp className="h-4 w-4 text-white-dark" /> : <ChevronDown className="h-4 w-4 text-white-dark" />
          )}
        </div>
      </button>

      {open && hasContent && (
        <div className="border-t border-white-light dark:border-white-light/10 px-4 py-3 space-y-3 bg-gray-50/50 dark:bg-dark/30">
          {q.userAnswer && (
            <div>
              <p className="text-xs font-bold text-white-dark mb-1">Candidate Answer</p>
              <p className="text-xs text-black dark:text-white leading-relaxed whitespace-pre-wrap">{q.userAnswer}</p>
            </div>
          )}
          {q.aiFeedback && (
            <div>
              <p className="text-xs font-bold text-primary mb-1">AI Evaluation (Gemma)</p>
              <p className="text-xs text-black dark:text-white leading-relaxed whitespace-pre-wrap">{q.aiFeedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProctoringLog({ violations, strikes, integrityScore, flaggedForReview }: {
  violations: ProctoringViolation[];
  strikes: number;
  integrityScore: number;
  flaggedForReview: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-xs text-white-dark">Integrity Score</span>
          <p className={`font-bold text-lg ${integrityScore >= 80 ? 'text-success' : integrityScore >= 50 ? 'text-warning' : 'text-danger'}`}>
            {integrityScore}%
          </p>
        </div>
        <div>
          <span className="text-xs text-white-dark">Strikes</span>
          <p className={`font-bold text-lg ${strikes === 0 ? 'text-success' : strikes === 1 ? 'text-warning' : 'text-danger'}`}>
            {strikes} / 3
          </p>
        </div>
        {flaggedForReview && (
          <span className="badge badge-outline-danger flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Flagged for review
          </span>
        )}
      </div>

      {violations.length > 0 ? (
        <div className="table-responsive">
          <table className="text-xs">
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Time</th>
                <th>Strike</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v, i) => (
                <tr key={i}>
                  <td>
                    <span className={`badge badge-outline-${
                      v.type === 'tab_switch' || v.type === 'window_blur' ? 'warning' : 'danger'
                    } capitalize`}>
                      {VIOLATION_LABEL[v.type] ?? v.type}
                    </span>
                  </td>
                  <td className="text-white-dark">{dateTimeShort(v.timestamp)}</td>
                  <td>{v.strike != null ? <span className="font-bold text-danger">#{v.strike}</span> : '—'}</td>
                  <td className="text-white-dark max-w-xs truncate">{v.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-white-dark">No proctoring events recorded.</p>
      )}
    </div>
  );
}

const CompanyAssessmentsPage = () => {
  const dispatch = useDispatch();
  const [assessments, setAssessments] = useState<CompanyAssessment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [passFilter, setPassFilter] = useState('');
  const [detail, setDetail] = useState<CompanyAssessment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await companyService.getAssessments({ page, limit: 10, passFailStatus: passFilter || undefined });
      setAssessments(res.assessments);
      setTotal(res.pagination.total);
    } catch {
      toast.error('Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (ass: CompanyAssessment) => {
    setDetail(ass);
    setDetailLoading(true);
    try {
      const full = await companyService.getAssessment(ass._id);
      setDetail(full);
    } catch {
      // keep shallow data already set
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    dispatch(setPageTitle('Assessments | RecruitAI'));
    void load();
  }, [dispatch, page, passFilter]);

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">Assessments</h1>
          <p className="mt-1 text-sm text-white-dark">Review AI scores, pass/fail results, Gemma evaluation notes, and proctoring reports.</p>
        </div>
        <select
          className="form-select w-full sm:w-48"
          value={passFilter}
          onChange={(e) => { setPage(1); setPassFilter(e.target.value); }}
        >
          <option value="">All Results</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
        </select>
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
                    <th>Score vs. Threshold</th>
                    <th>Result</th>
                    <th>Integrity</th>
                    <th>Date</th>
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
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <span className="font-bold text-primary w-8 shrink-0">{ass.score}%</span>
                          <div className="relative flex-1 h-2 rounded-full bg-gray-200 dark:bg-dark">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full ${ass.passFailStatus === 'passed' ? 'bg-success' : 'bg-danger'}`}
                              style={{ width: `${Math.min(100, ass.score)}%` }}
                            />
                            <div
                              className="absolute top-0 bottom-0 w-px bg-danger/70"
                              style={{ left: `${Math.min(100, ass.passingScore)}%` }}
                            />
                          </div>
                          <span className="text-xs text-white-dark w-8 shrink-0">{ass.passingScore}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-outline-${
                          ass.passFailStatus === 'passed' ? 'success' : ass.passFailStatus === 'failed' ? 'danger' : 'warning'
                        } capitalize`}>
                          {ass.passFailStatus}
                        </span>
                      </td>
                      <td>
                        {ass.integrityScore != null ? (
                          <span className={`text-sm font-bold ${
                            ass.integrityScore >= 80 ? 'text-success' : ass.integrityScore >= 50 ? 'text-warning' : 'text-danger'
                          }`}>
                            {ass.integrityScore}%
                            {ass.flaggedForReview && <span className="ml-1 text-danger" title="Flagged for review">⚑</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-white-dark">—</span>
                        )}
                      </td>
                      <td className="text-xs">{dateTime(ass.completionDate)}</td>
                      <td>
                        <div className="flex justify-end">
                          <button
                            title="View Full Report"
                            className="btn btn-sm btn-outline-primary p-2"
                            onClick={() => void openDetail(ass)}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {assessments.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white-dark">
                        No completed candidate assessments yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-white-dark">{total} assessments</span>
              <div className="flex items-center gap-2">
                <button className="btn btn-outline-primary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span>Page {page} of {totalPages}</span>
                <button className="btn btn-outline-primary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
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
          <div className="panel w-full max-w-3xl max-h-[92vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-white-light dark:border-white-light/10 pb-3 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-black dark:text-white">Assessment Report</h3>
              </div>
              <button
                type="button"
                className="text-white-dark hover:text-danger text-lg font-bold"
                onClick={() => setDetail(null)}
              >
                &times;
              </button>
            </div>

            {detailLoading ? (
              <div className="flex flex-1 items-center justify-center py-16">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-5 pr-1">

                {/* Top summary row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div className="sm:col-span-1">
                    <p className="text-xs text-white-dark">Candidate</p>
                    <p className="font-semibold text-black dark:text-white">{detail.candidateName || detail.candidate?.name}</p>
                    <p className="text-xs text-white-dark">{detail.candidate?.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white-dark">Job Role</p>
                    <p className="font-semibold text-black dark:text-white">{detail.job?.title || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white-dark">Completed</p>
                    <p className="font-semibold">{dateTime(detail.completionDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white-dark">Result</p>
                    <span className={`badge badge-outline-${
                      detail.passFailStatus === 'passed' ? 'success' : detail.passFailStatus === 'failed' ? 'danger' : 'warning'
                    } capitalize font-bold text-sm`}>
                      {detail.passFailStatus}
                    </span>
                  </div>
                </div>

                {/* Score vs. Threshold */}
                <div className="rounded-lg border border-white-light dark:border-white-light/10 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <p className={`text-4xl font-extrabold ${detail.passFailStatus === 'passed' ? 'text-success' : 'text-danger'}`}>
                      {detail.score}%
                    </p>
                    <div className="text-xs text-white-dark">
                      <p>Overall Score</p>
                      <p>Threshold: {detail.passingScore}%</p>
                    </div>
                  </div>
                  <ScoreBar score={detail.score} passingScore={detail.passingScore} />
                </div>

                {/* Identity Verification */}
                {detail.identityVerification && detail.identityVerification.status !== 'not_required' && (
                  <div>
                    <p className="text-xs font-bold text-white-dark uppercase mb-2">Identity Verification</p>
                    <IdentityVerificationCard iv={detail.identityVerification} />
                  </div>
                )}


                {/* Executive Summary */}
                {(detail.summaryNotes || detail.detailedFeedback) && (
                  <div>
                    <p className="text-xs font-bold text-white-dark uppercase mb-2">Executive Summary</p>
                    <p className="rounded-lg border border-white-light dark:border-white-light/10 p-3 text-xs leading-relaxed dark:border-white-light/10">
                      {detail.detailedFeedback || detail.summaryNotes}
                    </p>
                  </div>
                )}

                {/* Strengths & Improvements */}
                {((detail.strengths && detail.strengths.length > 0) || (detail.improvements && detail.improvements.length > 0)) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {detail.strengths && detail.strengths.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-success uppercase mb-2">Strengths</p>
                        <ul className="list-disc pl-5 text-xs text-white-dark space-y-1">
                          {detail.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {detail.improvements && detail.improvements.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-warning uppercase mb-2">Areas to Improve</p>
                        <ul className="list-disc pl-5 text-xs text-white-dark space-y-1">
                          {detail.improvements.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Per-Question Evaluation */}
                {detail.questionEvaluations && detail.questionEvaluations.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-white-dark uppercase mb-2">
                      Per-Question Evaluation ({detail.questionEvaluations.length} questions)
                    </p>
                    <div className="space-y-2">
                      {detail.questionEvaluations.map((q, i) => (
                        <QuestionCard key={i} q={q} index={i} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Proctoring Log */}
                <div>
                  <p className="text-xs font-bold text-white-dark uppercase mb-2">Proctoring Log</p>
                  <div className="rounded-lg border border-white-light dark:border-white-light/10 p-4">
                    <ProctoringLog
                      violations={detail.proctoringViolations || []}
                      strikes={detail.proctoringStrikes ?? 0}
                      integrityScore={detail.integrityScore ?? 100}
                      flaggedForReview={detail.flaggedForReview ?? false}
                    />
                  </div>
                </div>

              </div>
            )}

            <div className="flex justify-end pt-4 mt-4 border-t border-white-light dark:border-white-light/10 shrink-0">
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
