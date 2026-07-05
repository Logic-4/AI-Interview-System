import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Volume2,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { cn } from "../../lib/utils";
import interviewService from "../../services/interviewService";
import type { PopulatedInterview } from "../../types/interview";
import type { Question } from "../../types/question";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getScoreColor(score: number) {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

export default function InterviewReviewPage() {
  const params = useParams();
  const navigate = useNavigate();
  const interviewId = params.id as string;

  const [interview, setInterview] = useState<PopulatedInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [retryMode, setRetryMode] = useState<string | null>(null);
  const [retryAnswer, setRetryAnswer] = useState('');
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryResult, setRetryResult] = useState<{ score: number; feedback: string; strengths: string[]; improvements: string[] } | null>(null);
  const [expandedRetry, setExpandedRetry] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await interviewService.getInterview(interviewId);
        setInterview(data);
      } catch {
        setError("Failed to load interview.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [interviewId]);

  const speakText = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  };

  const handleRetry = async () => {
    if (!q || !retryAnswer.trim()) return;
    setRetryLoading(true);
    setRetryResult(null);
    try {
      const result = await interviewService.retryEvaluate(interviewId, q._id, retryAnswer);
      setRetryResult(result.evaluation);
    } catch {
      setRetryResult({ score: 0, feedback: 'Evaluation failed. Please try again.', strengths: [], improvements: [] });
    } finally {
      setRetryLoading(false);
    }
  };

  const startRetry = (questionId: string) => {
    setRetryMode(questionId);
    setRetryAnswer('');
    setRetryResult(null);
  };

  const cancelRetry = () => {
    setRetryMode(null);
    setRetryAnswer('');
    setRetryResult(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-sm font-semibold text-text-muted animate-pulse">Loading review...</p>
        </div>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card hoverEffect={false} className="p-8 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary dark:text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-text-muted mb-6">{error}</p>
          <Link to="/interviews">
            <Button variant="outline" className="text-text-primary dark:text-white border-white-light dark:border-[#1b2e4b]">Back to Interviews</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const questions: Question[] = interview.questions ?? [];
  const q = questions[currentIdx];
  const total = questions.length;

  if (!q) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-text-muted">No questions found.</p>
      </div>
    );
  }

  const qScore = q.score ?? 0;
  const scoreColor = getScoreColor(qScore);

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-5 animate-in fade-in duration-500 text-black dark:text-white-dark">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to={`/interviews/${interviewId}/report`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-text-primary dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Report
        </Link>
        <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
          Review Mode
        </span>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-text-muted">
          Q{currentIdx + 1}/{total}
        </span>
        <div className="flex-1 h-1.5 bg-[#1b2e4b]/10 dark:bg-[#1b2e4b] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${((currentIdx + 1) / total) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      {/* Question Card */}
      <Card hoverEffect={false} className="p-6 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black relative overflow-hidden">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          {/* Meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold uppercase tracking-widest">
              {q.category}
            </Badge>
            <Badge className={cn(
              "text-[9px] font-bold uppercase tracking-widest",
              q.difficulty === "hard" ? "bg-danger/10 text-danger border-danger/20" :
              q.difficulty === "easy" ? "bg-success/10 text-success border-success/20" :
              "bg-warning/10 text-warning border-warning/20"
            )}>
              {q.difficulty}
            </Badge>
            {q.isAnswered && (
              <Badge className={cn(
                "text-[9px] font-bold uppercase tracking-widest",
                scoreColor === "success" ? "bg-success/10 text-success border-success/20" :
                scoreColor === "warning" ? "bg-warning/10 text-warning border-warning/20" :
                "bg-danger/10 text-danger border-danger/20"
              )}>
                Score: {qScore}/100
              </Badge>
            )}
            {!q.isAnswered && (
              <Badge className="bg-foreground/5 text-text-muted border border-white-light dark:border-[#1b2e4b] text-[9px] font-bold uppercase tracking-widest">
                Skipped
              </Badge>
            )}
            {q.timeSpent > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-text-muted">
                <Clock className="w-3 h-3" /> {formatTime(q.timeSpent)}
              </span>
            )}
          </div>

          {/* Question */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-bold tracking-tight text-text-primary dark:text-white leading-relaxed flex-1">
                {q.text}
              </h2>
              <button
                onClick={() => speakText(q.text)}
                className="flex-shrink-0 w-8 h-8 rounded-md border border-white-light dark:border-[#1b2e4b] flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/40 transition-all"
                title="Read aloud"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Your Answer */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Your Answer</p>
            {q.isAnswered && q.userAnswer ? (
              <div className="bg-white-light/30 dark:bg-black/60 rounded-md p-4 border border-white-light dark:border-[#1b2e4b]">
                <p className="text-xs text-text-primary dark:text-white font-medium leading-relaxed">{q.userAnswer}</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-4 rounded-md bg-white-light/30 dark:bg-black/60 border border-white-light dark:border-[#1b2e4b]">
                <XCircle className="w-4 h-4 text-text-muted" />
                <p className="text-xs text-text-muted font-semibold italic">No answer provided — this question was skipped.</p>
              </div>
            )}
          </div>

          {/* AI Feedback */}
          {q.aiFeedback && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5">
                <BarChart3 className="w-3 h-3" /> AI Feedback
              </p>
              <div className="bg-white-light/30 dark:bg-black/60 rounded-md p-4 border border-white-light dark:border-[#1b2e4b]">
                <p className="text-xs text-text-muted font-semibold leading-relaxed">{q.aiFeedback}</p>
              </div>
            </div>
          )}

          {/* Practice Loop — Retry */}
          {q.isAnswered && q.score !== null && q.score < 70 && retryMode !== q._id && (
            <button
              onClick={() => startRetry(q._id)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-md border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Practice This Question
            </button>
          )}

          {retryMode === q._id && (
            <div className="space-y-3 p-4 rounded-md border border-primary/20 bg-primary/5">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Retry Answer
              </p>
              <textarea
                value={retryAnswer}
                onChange={(e) => setRetryAnswer(e.target.value)}
                placeholder="Type your improved answer here..."
                rows={4}
                className="w-full bg-[#fafafa] dark:bg-black border border-white-light dark:border-[#1b2e4b] rounded-md p-4 text-xs font-semibold focus:outline-none focus:border-primary/50 transition-all resize-none text-text-primary dark:text-white placeholder:text-text-muted"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleRetry}
                  disabled={retryLoading || !retryAnswer.trim()}
                  className="h-8 px-4 rounded-md text-[10px] font-bold text-white"
                >
                  {retryLoading ? (
                    <LoadingSpinner size="sm" className="mr-1.5 inline-block text-white" />
                  ) : (
                    <Send className="w-3 h-3 mr-1.5" />
                  )}
                  Submit Retry
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelRetry}
                  className="h-8 px-4 rounded-md text-[10px] font-bold text-text-muted border-white-light dark:border-[#1b2e4b]"
                >
                  Cancel
                </Button>
              </div>

              {/* Retry Result */}
              {retryResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2 p-3 rounded-md border border-success/20 bg-success/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-success uppercase tracking-widest">Retry Score</span>
                    <span className={cn(
                      "text-sm font-bold",
                      (retryResult.score ?? 0) >= 70 ? "text-success" : "text-warning"
                    )}>
                      {retryResult.score}/100
                    </span>
                  </div>
                  {retryResult.feedback && (
                    <p className="text-xs text-text-muted font-semibold leading-relaxed">{retryResult.feedback}</p>
                  )}
                  {retryResult.strengths?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-success uppercase tracking-widest">Strengths</p>
                      <ul className="space-y-0.5">
                        {retryResult.strengths.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-text-muted font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-success flex-shrink-0 mt-0.5" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {retryResult.improvements?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-warning uppercase tracking-widest">Still Needs Work</p>
                      <ul className="space-y-0.5">
                        {retryResult.improvements.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-text-muted font-semibold">
                            <XCircle className="w-3 h-3 text-warning flex-shrink-0 mt-0.5" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    onClick={cancelRetry}
                    className="text-[10px] font-bold text-primary hover:underline mt-1"
                  >
                    Close &amp; try again
                  </button>
                </motion.div>
              )}
            </div>
          )}

          {/* Retry History */}
          {q.retryAnswers && q.retryAnswers.length > 0 && (
            <div className="space-y-1.5">
              <button
                onClick={() => setExpandedRetry(expandedRetry === q._id ? null : q._id)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted uppercase tracking-widest hover:text-primary transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry History ({q.retryAnswers.length})
                {expandedRetry === q._id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {expandedRetry === q._id && (
                <div className="space-y-2">
                  {q.retryAnswers.map((ra, i) => (
                    <div key={i} className="p-3 rounded-md border border-white-light dark:border-[#1b2e4b] bg-white-light/30 dark:bg-black/60 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Attempt {i + 1}</span>
                        <span className={cn(
                          "text-xs font-bold",
                          (ra.score ?? 0) >= 70 ? "text-success" : "text-warning"
                        )}>
                          {ra.score}/100
                        </span>
                      </div>
                      <p className="text-xs text-text-muted font-semibold">{ra.answer}</p>
                      {ra.feedback && <p className="text-[11px] text-text-muted font-semibold">{ra.feedback}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Expected Answer */}
          {q.expectedAnswer && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" /> Ideal Answer
              </p>
              <div className="bg-primary/5 rounded-md p-4 border border-primary/10">
                <p className="text-xs text-text-muted font-semibold leading-relaxed">{q.expectedAnswer}</p>
              </div>
            </div>
          )}
        </motion.div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => { setCurrentIdx(Math.max(0, currentIdx - 1)); window.speechSynthesis?.cancel(); }}
          disabled={currentIdx === 0}
          className="h-10 px-5 rounded-md text-xs font-bold text-text-primary dark:text-white border-white-light dark:border-[#1b2e4b] disabled:opacity-30"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Previous
        </Button>

        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {questions.map((_, i) => {
            const isAns = questions[i].isAnswered;
            const isCur = i === currentIdx;
            return (
              <button
                key={i}
                onClick={() => { setCurrentIdx(i); window.speechSynthesis?.cancel(); }}
                className={cn(
                  "w-7 h-7 rounded-md text-[10px] font-bold transition-all",
                  isCur
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : isAns
                      ? "bg-success/10 text-success border border-success/20"
                      : "bg-[#fafafa] dark:bg-[#1a2941] text-text-muted border border-white-light dark:border-[#1b2e4b] hover:bg-[#fafafa]/50 dark:hover:bg-[#1b2e4b]"
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          onClick={() => { setCurrentIdx(Math.min(total - 1, currentIdx + 1)); window.speechSynthesis?.cancel(); }}
          disabled={currentIdx === total - 1}
          className="h-10 px-5 rounded-md text-xs font-bold text-text-primary dark:text-white border-white-light dark:border-[#1b2e4b] disabled:opacity-30"
        >
          Next <ArrowRight className="w-3.5 h-3.5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
