"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  AlertCircle,
  Trophy,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Lightbulb,
  Target,
  TrendingUp,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";
import interviewService from "@/services/interviewService";
import feedbackService from "@/services/feedbackService";
import type { PopulatedInterview } from "@/types/interview";
import type { Question } from "@/types/question";
import type { Feedback, FeedbackCategories } from "@/types/feedback";

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

function getScoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Great";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Needs Work";
  return "Poor";
}

const CATEGORY_LABELS: Record<keyof FeedbackCategories, { label: string; icon: React.ElementType }> = {
  communication: { label: "Communication", icon: MessageSquare },
  technicalAccuracy: { label: "Technical Accuracy", icon: Target },
  problemSolving: { label: "Problem Solving", icon: Lightbulb },
  codeQuality: { label: "Code Quality", icon: FileText },
  confidence: { label: "Confidence", icon: TrendingUp },
};

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params.id as string;

  const [interview, setInterview] = useState<PopulatedInterview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [retaking, setRetaking] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await interviewService.getInterview(interviewId);
        if (data.status !== "completed") {
          router.replace(`/interviews/${interviewId}`);
          return;
        }
        setInterview(data);
      } catch {
        setError("Failed to load interview report.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [interviewId, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-sm font-semibold text-text-muted animate-pulse">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card hoverEffect={false} className="p-8 border-border/40 bg-surface/30 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">Something went wrong</h2>
          <p className="text-sm text-text-muted mb-6">{error}</p>
          <Link href="/interviews">
            <Button variant="outline" className="text-text-primary border-border/40">Back to Interviews</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const feedback: Feedback | undefined = interview.feedback;
  const questions: Question[] = interview.questions ?? [];
  const answeredQuestions = questions.filter((q) => q.isAnswered);
  const overallScore = feedback?.overallScore ?? interview.overallScore ?? 0;
  const scoreColor = getScoreColor(overallScore);
  const totalTimeSpent = questions.reduce((sum, q) => sum + (q.timeSpent || 0), 0);

  // Detect placeholder/missing feedback
  const hasFeedback = feedback && feedback.detailedFeedback
    && !feedback.detailedFeedback.includes('unavailable')
    && !feedback.improvements?.some(s => s.includes('will be available once'));

  const handleRegenerateFeedback = async () => {
    setRegenerating(true);
    try {
      await feedbackService.generateFeedback(interviewId, true);
      // Reload interview data to get fresh feedback
      const data = await interviewService.getInterview(interviewId);
      setInterview(data);
    } catch {
      // Silent fail — user can retry
    } finally {
      setRegenerating(false);
    }
  };

  const handleRetakeInterview = async () => {
    setRetaking(true);
    try {
      await interviewService.resetInterview(interviewId);
      router.push(`/interviews/${interviewId}`);
    } catch {
      setError("Failed to reset interview for retaking. Please try again.");
      setRetaking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6 animate-in fade-in duration-700">
      {/* Back link */}
      <Link
        href="/interviews"
        className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Interviews
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Interview Report</h1>
        <p className="text-sm text-text-muted font-medium">{interview.title}</p>
      </div>

      {/* Score Hero */}
      <Card hoverEffect={false} className="p-8 border-border/40 bg-surface/30 backdrop-blur-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Circular score */}
          <div className="flex flex-col items-center gap-3">
            <Progress
              variant="circular"
              size="xl"
              value={overallScore}
              showValue
              color={scoreColor as "primary" | "success" | "warning" | "danger"}
              gradient={false}
            />
            <div className="text-center">
              <p className={cn(
                "text-sm font-bold",
                scoreColor === "success" ? "text-success" : scoreColor === "warning" ? "text-warning" : "text-danger"
              )}>
                {getScoreLabel(overallScore)}
              </p>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Overall Score</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="flex-1 w-full">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Type", value: interview.type.replace("-", " "), icon: MessageSquare },
                { label: "Level", value: interview.difficulty, icon: BarChart3 },
                { label: "Time Spent", value: formatTime(totalTimeSpent), icon: Clock },
                { label: "Answered", value: `${answeredQuestions.length}/${questions.length}`, icon: CheckCircle2 },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="text-center p-3 rounded-xl bg-foreground/[0.03] border border-border/40">
                    <Icon className="w-4 h-4 text-primary mx-auto mb-2" />
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{stat.label}</p>
                    <p className="text-sm font-semibold text-text-primary capitalize">{stat.value}</p>
                  </div>
                );
              })}
            </div>

            {interview.jobRole && (
              <div className="mt-4 flex items-center gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                  {interview.jobRole}
                </Badge>
                {interview.domain && (
                  <Badge className="bg-foreground/5 text-text-muted border-border/40 text-xs font-semibold capitalize">
                    {interview.domain.replace("-", " ")}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      </Card>

      {/* Regenerate feedback banner — shown when feedback is missing or placeholder */}
      {!hasFeedback && (
        <Card hoverEffect={false} className="p-5 border-warning/30 bg-warning/5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-text-primary">AI Feedback Missing or Incomplete</p>
                <p className="text-xs text-text-muted font-medium">Click regenerate to get detailed AI-powered analysis of your interview performance.</p>
              </div>
            </div>
            <Button
              onClick={handleRegenerateFeedback}
              disabled={regenerating}
              className="h-9 px-5 rounded-xl text-xs font-bold flex-shrink-0"
            >
              {regenerating ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
              {regenerating ? 'Generating...' : 'Regenerate'}
            </Button>
          </div>
        </Card>
      )}

      {/* Category Breakdown */}
      {feedback?.categories && (
        <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30">
          <h3 className="text-sm font-bold text-text-primary mb-5 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Category Breakdown
          </h3>
          <div className="space-y-4">
            {(Object.entries(feedback.categories) as [keyof FeedbackCategories, { score: number; feedback: string }][]).map(
              ([key, cat]) => {
                const meta = CATEGORY_LABELS[key];
                if (!meta || cat.score === undefined) return null;
                const Icon = meta.icon;
                const color = getScoreColor(cat.score);
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-text-muted" />
                        <span className="text-xs font-semibold text-text-primary">{meta.label}</span>
                      </div>
                      <span className={cn(
                        "text-xs font-bold",
                        color === "success" ? "text-success" : color === "warning" ? "text-warning" : "text-danger"
                      )}>
                        {cat.score}/100
                      </span>
                    </div>
                    <div className="h-2 w-full bg-foreground/10 rounded-full overflow-hidden">
                      <motion.div
                        className={cn(
                          "h-full rounded-full",
                          color === "success" ? "bg-success" : color === "warning" ? "bg-warning" : "bg-danger"
                        )}
                        initial={{ width: 0 }}
                        animate={{ width: `${cat.score}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                      />
                    </div>
                    {cat.feedback && (
                      <p className="text-[11px] text-text-muted font-medium leading-relaxed">{cat.feedback}</p>
                    )}
                  </div>
                );
              }
            )}
          </div>
        </Card>
      )}

      {/* Strengths & Improvements */}
      {feedback && (feedback.strengths?.length > 0 || feedback.improvements?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {feedback.strengths?.length > 0 && (
            <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30">
              <h3 className="text-sm font-bold text-success mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Strengths
              </h3>
              <ul className="space-y-2.5">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-text-muted font-medium leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {feedback.improvements?.length > 0 && (
            <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30">
              <h3 className="text-sm font-bold text-warning mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Areas to Improve
              </h3>
              <ul className="space-y-2.5">
                {feedback.improvements.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-text-muted font-medium leading-relaxed">
                    <XCircle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* Detailed Feedback */}
      {feedback?.detailedFeedback && (
        <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30">
          <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Detailed Feedback
          </h3>
          <p className="text-xs text-text-muted font-medium leading-relaxed whitespace-pre-line">
            {feedback.detailedFeedback}
          </p>
        </Card>
      )}

      {/* Recommendations */}
      {feedback?.recommendations && feedback.recommendations.length > 0 && (
        <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30">
          <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            Recommendations
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {feedback.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-text-muted font-medium leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Question-by-Question Breakdown */}
      <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30">
        <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Question Breakdown ({answeredQuestions.length}/{questions.length} answered)
        </h3>
        <div className="space-y-2">
          {questions.map((q, idx) => {
            const isExpanded = expandedQuestion === q._id;
            const qScore = q.score ?? 0;
            const qColor = getScoreColor(qScore);
            return (
              <div key={q._id} className="border border-border/40 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedQuestion(isExpanded ? null : q._id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-foreground/[0.02] transition-colors"
                >
                  <span className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                    q.isAnswered
                      ? qColor === "success" ? "bg-success/10 text-success" : qColor === "warning" ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
                      : "bg-foreground/5 text-text-muted"
                  )}>
                    {q.isAnswered ? qScore : "—"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      Q{idx + 1}: {q.text}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] font-bold uppercase tracking-widest">
                        {q.category}
                      </Badge>
                      <Badge className={cn(
                        "text-[8px] font-bold uppercase tracking-widest",
                        q.difficulty === "hard" ? "bg-danger/10 text-danger border-danger/20" :
                        q.difficulty === "easy" ? "bg-success/10 text-success border-success/20" :
                        "bg-warning/10 text-warning border-warning/20"
                      )}>
                        {q.difficulty}
                      </Badge>
                      {q.isAnswered && (
                        <span className="text-[9px] font-medium text-text-muted">{formatTime(q.timeSpent)}</span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                </button>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 pb-4 space-y-3 border-t border-border/40"
                  >
                    <div className="pt-3">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Question</p>
                      <p className="text-xs text-text-primary font-medium leading-relaxed">{q.text}</p>
                    </div>
                    {q.userAnswer && (
                      <div>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Your Answer</p>
                        <p className="text-xs text-text-muted font-medium leading-relaxed bg-foreground/[0.03] rounded-lg p-3">
                          {q.userAnswer}
                        </p>
                      </div>
                    )}
                    {!q.isAnswered && (
                      <div className="flex items-center gap-2 text-xs text-text-muted font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        Skipped
                      </div>
                    )}
                    {q.aiFeedback && (
                      <div>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">AI Feedback</p>
                        <p className="text-xs text-text-muted font-medium leading-relaxed">{q.aiFeedback}</p>
                      </div>
                    )}
                    {q.expectedAnswer && (
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 text-[10px]">Ideal Answer</p>
                        <p className="text-xs text-text-muted font-medium leading-relaxed bg-primary/5 rounded-lg p-3 border border-primary/10">
                          {q.expectedAnswer}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pb-8">
        <Link href={`/interviews/${interviewId}/review`}>
          <Button variant="outline" className="h-10 px-6 rounded-xl text-xs font-bold text-text-primary border-border/40">
            <FileText className="w-3.5 h-3.5 mr-2" />
            Review Answers
          </Button>
        </Link>
        <Button
          onClick={handleRetakeInterview}
          disabled={retaking}
          className="h-10 px-6 rounded-xl text-xs font-bold shadow-lg shadow-primary/20"
        >
          {retaking ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
          {retaking ? "Resetting..." : "Retake Interview"}
        </Button>
        <Link href="/interviews/new">
          <Button variant="outline" className="h-10 px-6 rounded-xl text-xs font-bold text-text-primary border-border/40">
            Start New Interview
          </Button>
        </Link>
        <Link href="/interviews">
          <Button variant="outline" className="h-10 px-6 rounded-xl text-xs font-bold text-text-primary border-border/40">
            <ArrowLeft className="w-3.5 h-3.5 mr-2" />
            All Interviews
          </Button>
        </Link>
      </div>
    </div>
  );
}
