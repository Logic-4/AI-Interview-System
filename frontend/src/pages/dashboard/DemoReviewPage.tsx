import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  ChevronDown, 
  ChevronUp, 
  AlignLeft, 
  Sparkles, 
  Lightbulb,
  Trophy
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import interviewService from "../../services/interviewService";
import feedbackService from "../../services/feedbackService";
import { Interview, PopulatedInterview } from "../../types/interview";
import { Feedback } from "../../types/feedback";

function getConfidenceLabel(score: number) {
  if (score >= 80) return "High";
  if (score >= 60) return "Moderate";
  return "Low";
}

function getQuestionFeedbackText(
  category: string,
  aiFeedback: string | undefined,
  feedback: Feedback | null
) {
  if (aiFeedback) return aiFeedback;
  if (!feedback) return "Feedback not available for this answer yet.";

  if (category === "behavioral") return feedback.categories.communication.feedback;
  if (category === "technical" || category === "system-design") {
    return feedback.categories.technicalAccuracy.feedback;
  }
  return feedback.detailedFeedback || "Feedback summary unavailable.";
}

export default function DemoReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedInterviewId = searchParams.get("interviewId");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completedInterviews, setCompletedInterviews] = useState<Interview[]>([]);
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(requestedInterviewId);
  const [interview, setInterview] = useState<PopulatedInterview | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [generatingFeedback, setGeneratingFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCompletedInterviews = async () => {
      setLoadingList(true);
      setError(null);
      try {
        const { interviews } = await interviewService.getInterviews({
          status: "completed",
          page: 1,
          limit: 20,
        });

        setCompletedInterviews(interviews);

        if (!interviews.length) {
          setSelectedInterviewId(null);
          setInterview(null);
          setFeedback(null);
          setLoading(false);
          return;
        }

        const matchedRequested = requestedInterviewId
          ? interviews.find((item) => item._id === requestedInterviewId)
          : null;

        setSelectedInterviewId((prev) => {
          if (matchedRequested) return matchedRequested._id;
          if (prev && interviews.some((item) => item._id === prev)) return prev;
          return interviews[0]._id;
        });
      } catch {
        setError("Unable to load completed interviews.");
        setLoading(false);
      } finally {
        setLoadingList(false);
      }
    };

    loadCompletedInterviews();
  }, [requestedInterviewId]);

  useEffect(() => {
    if (!selectedInterviewId) return;

    const loadDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const interviewData = await interviewService.getInterview(selectedInterviewId);
        setInterview(interviewData);
        setExpandedId(interviewData.questions[0]?._id ?? null);

        try {
          const feedbackData = await feedbackService.getFeedback(selectedInterviewId);
          setFeedback(feedbackData);
        } catch (feedbackError) {
          const status = (feedbackError as { response?: { status?: number } })?.response?.status;
          if (status === 404) {
            setFeedback(null);
          } else {
            throw feedbackError;
          }
        }
      } catch {
        setInterview(null);
        setFeedback(null);
        setError("Unable to load interview feedback.");
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [selectedInterviewId]);

  const handleGenerateFeedback = async () => {
    if (!selectedInterviewId) return;
    setGeneratingFeedback(true);
    setError(null);
    try {
      const generated = await feedbackService.generateFeedback(selectedInterviewId);
      setFeedback(generated);
    } catch {
      setError("Could not generate feedback right now.");
    } finally {
      setGeneratingFeedback(false);
    }
  };

  const overallScore = feedback?.overallScore ?? interview?.overallScore ?? 0;
  const confidenceScore = feedback?.categories.confidence.score ?? 0;

  const criticalGaps = useMemo(() => {
    if (!feedback) return 0;
    const categoryScores = [
      feedback.categories.communication.score,
      feedback.categories.technicalAccuracy.score,
      feedback.categories.problemSolving.score,
      feedback.categories.codeQuality.score,
      feedback.categories.confidence.score,
    ];
    return categoryScores.filter((score) => score < 70).length;
  }, [feedback]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loadingList) {
    return (
      <div className="h-64 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!completedInterviews.length) {
    return (
      <div className="space-y-4 py-14 text-center">
        <h2 className="text-xl font-bold">No completed interviews yet</h2>
        <p className="text-sm text-text-muted">Finish an interview to unlock question-level feedback.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto text-black dark:text-white-dark">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
         <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight mb-2 dark:text-white">Interview Feedback</h1>
            <p className="text-[13px] font-semibold text-text-muted leading-relaxed">
              Detailed analysis of your &quot;{interview?.title ?? "Interview"}&quot; session with AI-driven suggestions.
            </p>
         </div>
         <div className="flex items-center gap-3">
            <select
              value={selectedInterviewId ?? ""}
              onChange={(e) => {
                setSelectedInterviewId(e.target.value);
                setSearchParams({ interviewId: e.target.value }, { replace: true });
              }}
              className="form-select h-10 px-3 rounded-md bg-white border border-white-light dark:border-[#17263c] dark:bg-[#121e32] text-xs font-semibold"
            >
              {completedInterviews.map((iv) => (
                <option key={iv._id} value={iv._id}>
                  {iv.title}
                </option>
              ))}
            </select>
            <Button
              onClick={handleGenerateFeedback}
              disabled={generatingFeedback || loading || !selectedInterviewId}
              className="h-10 px-5 bg-primary hover:bg-primary/95 text-white text-xs font-bold gap-2 rounded-md"
            >
               <Trophy className="w-4 h-4" />
               {feedback ? "Refresh Feedback" : generatingFeedback ? "Generating..." : "Generate Feedback"}
            </Button>
         </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-md border border-danger/20 bg-danger/10 text-danger text-sm font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-56 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* Overall Score */}
             <Card className="p-6 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black" hoverEffect={false}>
                <div className="flex items-center justify-between mb-4">
                   <span className="text-xs font-bold text-text-muted tracking-wide">Overall Score</span>
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                   <span className="text-3xl font-black tabular-nums dark:text-white">{(overallScore / 10).toFixed(1)}</span>
                   <span className="text-sm font-bold text-text-muted">/ 10</span>
                </div>
                <div className="h-1.5 w-full bg-white-light dark:bg-[#1b2e4b] rounded-full overflow-hidden">
                   <div className="h-full bg-primary" style={{ width: `${overallScore}%` }} />
                </div>
             </Card>

             {/* Confidence Level */}
             <Card className="p-6 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black" hoverEffect={false}>
                <div className="flex items-center justify-between mb-4">
                   <span className="text-xs font-bold text-text-muted tracking-wide">Confidence Level</span>
                   <div className="px-2 py-0.5 rounded flex items-center justify-center bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase">
                      {confidenceScore >= 70 ? "Strong" : confidenceScore >= 50 ? "Stable" : "Improving"}
                   </div>
                </div>
                <div className="mb-2">
                   <span className="text-2xl font-black dark:text-white">{getConfidenceLabel(confidenceScore)}</span>
                </div>
                <p className="text-[11px] font-semibold text-text-muted">
                   Based on communication confidence scoring.
                </p>
             </Card>

             {/* Critical Gaps */}
             <Card className="p-6 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black" hoverEffect={false}>
                <div className="flex items-center justify-between mb-4">
                   <span className="text-xs font-bold text-text-muted tracking-wide">Critical Gaps</span>
                   <div className="px-2 py-0.5 rounded flex items-center justify-center bg-danger/10 text-danger text-[10px] font-bold tracking-widest uppercase">
                      Action Required
                   </div>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                   <span className="text-2xl font-black tabular-nums dark:text-white">{criticalGaps}</span>
                   <span className="text-sm font-bold text-text-muted">Areas</span>
                </div>
                <p className="text-[11px] font-semibold text-text-muted truncate">
                   {feedback?.improvements?.slice(0, 3).join(", ") || "No major gaps detected yet."}
                </p>
             </Card>
          </div>

          {/* Question Analysis List */}
          <div>
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Question-by-Question Analysis</h2>
                <div className="flex items-center gap-4 text-[11px] font-bold text-text-muted">
                   <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-success" /> Strong
                   </div>
                   <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-warning" /> Needs Work
                   </div>
                </div>
             </div>

             <div className="space-y-4">
              {(interview?.questions ?? []).map((q) => {
                const isExpanded = expandedId === q._id;
                const score = q.score ?? 0;
                const scoreColor =
                  score >= 70
                    ? "text-success bg-success/10 border-success/20"
                    : "text-warning bg-warning/10 border-warning/20";

                return (
                  <Card
                    key={q._id}
                    className={cn(
                      "border transition-all duration-300 overflow-hidden",
                      isExpanded
                        ? "border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black"
                        : "border-white-light dark:border-[#1b2e4b]/40 bg-white dark:bg-black/40 hover:bg-white-light/20 dark:hover:bg-[#1a2941]/40 cursor-pointer"
                    )}
                    hoverEffect={false}
                  >
                    <div
                      className="px-6 py-5 flex items-center gap-4 select-none cursor-pointer"
                      onClick={() => toggleExpand(q._id)}
                    >
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center text-xs font-black border flex-shrink-0 tabular-nums",
                          scoreColor
                        )}
                      >
                        {(score / 10).toFixed(1)}
                      </div>
                      <h3 className="text-sm font-bold flex-1 dark:text-white">{q.text}</h3>
                      <div className="text-text-muted">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                          <div className="px-6 pb-6 pt-2 border-t border-white-light dark:border-[#1b2e4b] space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-widest">
                                  <AlignLeft className="w-3.5 h-3.5" />
                                  Candidate Transcript
                                </div>
                                <div className="p-4 rounded-md bg-white-light/30 dark:bg-black/60 border border-white-light dark:border-[#1b2e4b] text-[13px] font-semibold leading-relaxed text-text-secondary dark:text-white-dark">
                                  {q.userAnswer || "No answer captured for this question."}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-widest">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  AI Feedback
                                </div>
                                <div className="p-4 text-[13px] font-semibold leading-relaxed text-text-secondary dark:text-white-dark">
                                  {getQuestionFeedbackText(q.category, q.aiFeedback, feedback)}
                                </div>
                              </div>
                            </div>

                            <div className="p-5 rounded-md bg-primary/5 border border-primary/10">
                              <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest mb-3">
                                <Lightbulb className="w-3.5 h-3.5" />
                                Suggested Better Answer
                              </div>
                              <p className="text-[13px] font-semibold leading-relaxed opacity-90 text-text-primary dark:text-white">
                                {q.expectedAnswer ||
                                  feedback?.recommendations?.[0] ||
                                  "No suggested answer available for this question yet."}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                );
              })}
             </div>

             {!(interview?.questions?.length) && (
                <Card className="p-8 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black text-center text-sm font-medium text-text-muted" hoverEffect={false}>
                   No question-level data is available for this interview.
                </Card>
             )}
          </div>
        </>
      )}
    </div>
  );
}
