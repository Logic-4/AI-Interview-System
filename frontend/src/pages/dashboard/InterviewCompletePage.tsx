import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import interviewService from "../../services/interviewService";
import type { PopulatedInterview } from "../../types/interview";

/**
 * Secure completion screen for company-scheduled live interviews. Unlike the
 * training report page, this deliberately does NOT show scores, feedback, or
 * per-question breakdowns — the hiring team is the only audience for that
 * data. Candidates see confirmation that the interview was received and
 * linked to their application, nothing more.
 */
export default function InterviewCompletePage() {
  const { id } = useParams();
  const [interview, setInterview] = useState<PopulatedInterview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    interviewService
      .getInterview(id)
      .then(setInterview)
      .catch(() => {
        // Never leak backend details; the confirmation copy below still stands.
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isCompanyInterview = Boolean(interview?.company);
  const companyName =
    typeof interview?.company === "object" && interview?.company
      ? (interview.company as { name?: string }).name || ""
      : "";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <Card
        hoverEffect={false}
        className="max-w-lg w-full p-10 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black text-center"
      >
        <div className="w-16 h-16 mx-auto rounded-full bg-success/10 border border-success/20 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-9 h-9 text-success" />
        </div>

        <h1 className="text-2xl font-bold text-text-primary dark:text-white mb-3">
          Interview Submitted
        </h1>

        <p className="text-sm font-semibold text-text-muted leading-relaxed mb-6">
          Thank you for completing your interview{companyName ? ` with ${companyName}` : ""}.
          Your answers, recording, and evaluation have been securely delivered
          to the hiring team.
        </p>

        <div className="rounded-md bg-primary/5 border border-primary/10 p-4 mb-6 text-left">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-xs font-semibold text-text-muted leading-relaxed space-y-1">
              <p>
                <strong className="text-text-primary dark:text-white">Results are not shared with candidates.</strong>{" "}
                The company will contact you directly with next steps.
              </p>
              <p>
                Please do not attempt to retake or resubmit this interview —
                only the first completed session is used for review.
              </p>
            </div>
          </div>
        </div>

        {isCompanyInterview ? (
          <Link to="/dashboard">
            <Button className="w-full text-white" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Back to Dashboard
            </Button>
          </Link>
        ) : (
          // Non-company sessions land here only via manual navigation; keep the
          // door open to the report they own.
          <Link to={`/interviews/${id}/report`}>
            <Button variant="outline" className="w-full">
              View Report
            </Button>
          </Link>
        )}
      </Card>
    </div>
  );
}
