"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { 
  Trophy, 
  ThumbsUp, 
  AlertTriangle, 
  Play, 
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import interviewService from "@/services/interviewService";
import feedbackService from "@/services/feedbackService";
import { Interview, PopulatedInterview } from "@/types/interview";
import { Feedback } from "@/types/feedback";

const CATEGORY_LABELS: Record<string, string> = {
  communication: "Communication",
  technicalAccuracy: "Technical Knowledge",
  problemSolving: "Problem Solving",
  codeQuality: "Code Quality",
  confidence: "Confidence",
};

function getScoreBadge(score: number) {
  if (score >= 80) return "bg-success/10 border-success/20 text-success";
  if (score >= 60) return "bg-warning/10 border-warning/20 text-warning";
  return "bg-danger/10 border-danger/20 text-danger";
}

export default function InterviewResultPage() {
  const searchParams = useSearchParams();
  const requestedInterviewId = searchParams.get("interviewId");

  const [completedInterviews, setCompletedInterviews] = useState<Interview[]>([]);
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(
    requestedInterviewId
  );
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
        setError("Unable to load interview results.");
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [selectedInterviewId]);

  const overallScore = feedback?.overallScore ?? interview?.overallScore ?? 0;
  const completedAt = interview?.completedAt ?? interview?.updatedAt ?? interview?.createdAt;

  const scoreDelta = useMemo(() => {
    if (!selectedInterviewId) return null;
    const sorted = [...completedInterviews]
      .filter((iv) => iv.overallScore !== null)
      .sort((a, b) => {
        const dateA = new Date(a.completedAt ?? a.createdAt).getTime();
        const dateB = new Date(b.completedAt ?? b.createdAt).getTime();
        return dateB - dateA;
      });
    const currentIndex = sorted.findIndex((iv) => iv._id === selectedInterviewId);
    if (currentIndex < 0 || currentIndex >= sorted.length - 1) return null;
    const previous = sorted[currentIndex + 1];
    if (previous.overallScore === null) return null;
    const diff = overallScore - previous.overallScore;
    return Math.round(diff);
  }, [completedInterviews, overallScore, selectedInterviewId]);

  const categories = feedback
    ? [
        { label: CATEGORY_LABELS.communication, score: feedback.categories.communication.score },
        { label: CATEGORY_LABELS.technicalAccuracy, score: feedback.categories.technicalAccuracy.score },
        { label: CATEGORY_LABELS.problemSolving, score: feedback.categories.problemSolving.score },
        { label: CATEGORY_LABELS.codeQuality, score: feedback.categories.codeQuality.score },
        { label: CATEGORY_LABELS.confidence, score: feedback.categories.confidence.score },
      ]
    : [];

  const strengths = feedback?.strengths ?? [];
  const improvements = feedback?.improvements ?? [];

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
        <p className="text-sm text-text-muted">Finish an interview to unlock real AI result analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <div className="flex items-center gap-2 mb-2">
               <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Interview Analysis</span>
               <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold text-text-muted">
                  SESSION #{selectedInterviewId?.slice(-6).toUpperCase()}
               </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{interview?.title ?? "Interview Result"}</h1>
            <p className="text-[13px] font-medium text-text-muted mt-1">
              {completedAt
                ? `Completed on ${new Date(completedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}`
                : "Completed interview"} • {interview?.duration ?? 0} minutes duration
            </p>
         </div>
         <div className="flex items-center gap-2">
            <select
              value={selectedInterviewId ?? ""}
              onChange={(e) => setSelectedInterviewId(e.target.value)}
              className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold"
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
              className="bg-primary hover:bg-primary-light text-white shadow-lg shadow-primary/20 h-10 px-5 text-sm font-semibold gap-2 rounded-xl"
            >
              <Trophy className="w-4 h-4" />
              {feedback ? "Refresh Feedback" : generatingFeedback ? "Generating..." : "Generate Feedback"}
            </Button>
         </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl border border-danger/20 bg-danger/10 text-danger text-sm font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-56 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Overall Score Card */}
         <Card className="col-span-1 p-6 border-white/5 bg-surface/40 flex flex-col items-center justify-center relative overflow-hidden">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] mb-8">Overall Score</h3>
            
            <div className="relative w-40 h-40 flex items-center justify-center mb-8">
              {/* Circular Progress Background */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
                <circle
                  cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="6"
                  strokeDasharray="439.8" strokeDashoffset={439.8 - (439.8 * overallScore) / 100}
                  className="text-primary transition-all duration-1000 ease-out drop-shadow-[0_0_10px_rgba(41,98,255,0.5)]"
                  strokeLinecap="round"
                />
              </svg>
              <div className="flex flex-col items-center justify-center text-center mt-2">
                <span className="text-5xl font-black text-white tracking-tighter tabular-nums leading-none">{overallScore}</span>
                <span className="text-sm font-bold text-text-muted">/ 100</span>
              </div>
            </div>

            {scoreDelta !== null && (
              <div className={`px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wider flex items-center gap-1.5 border ${getScoreBadge(overallScore)}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {scoreDelta >= 0 ? "+" : ""}{scoreDelta} vs previous session
              </div>
            )}
          </Card>

          {/* Competency Breakdown */}
          <Card className="col-span-1 lg:col-span-2 p-6 border-white/5 bg-surface/40">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-bold text-white tracking-wide">Competency Breakdown</h3>
              <div className="flex items-center gap-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Current
                </div>
                <div className="flex items-center gap-1.5 opacity-60">
                  <span className="w-2 h-2 rounded-full bg-white/10" /> Target
                </div>
              </div>
            </div>

            <div className="space-y-6">
               {(categories.length ? categories : [{ label: "No feedback categories yet", score: 0 }]).map((item, idx) => (
                 <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                       <span>{item.label}</span>
                       <span>{item.score}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${item.score}%` }}
                         transition={{ duration: 1, delay: 0.2 + idx * 0.1 }}
                         className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(41,98,255,0.3)]" 
                       />
                    </div>
                 </div>
               ))}
            </div>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Key Strengths */}
         <Card className="p-6 border-white/5 bg-[#121922]">
            <div className="flex items-center gap-2 mb-6 text-success">
               <ThumbsUp className="w-4 h-4" />
               <h3 className="text-sm font-bold">Key Strengths</h3>
            </div>
            <div className="space-y-5">
               {(strengths.length ? strengths : ["No strengths available yet."]).map((item, idx) => (
                 <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <div>
                       <h4 className="text-[13px] font-bold text-white mb-1">Strength {idx + 1}</h4>
                       <p className="text-[11px] font-medium text-text-secondary leading-relaxed">{item}</p>
                    </div>
                 </div>
               ))}
            </div>
         </Card>

         {/* Areas to Improve */}
         <Card className="p-6 border-white/5 bg-[#1A1612]">
            <div className="flex items-center gap-2 mb-6 text-warning">
               <AlertTriangle className="w-4 h-4" />
               <h3 className="text-sm font-bold">Areas to Improve</h3>
            </div>
            <div className="space-y-5">
               {(improvements.length ? improvements : ["No improvements available yet."]).map((item, idx) => (
                 <div key={idx} className="flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                       <h4 className="text-[13px] font-bold text-white mb-1">Improvement {idx + 1}</h4>
                       <p className="text-[11px] font-medium text-text-secondary leading-relaxed">{item}</p>
                    </div>
                 </div>
               ))}
            </div>
         </Card>
      </div>

      {/* Review Recording */}
      <Card className="p-1 border-white/5 bg-surface/30 overflow-hidden relative group">
         <div className="w-full aspect-video bg-[#0A0A0F] rounded-xl flex items-center justify-center relative overflow-hidden">
            {/* Simulated background heatmap / video thumbnail */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-[#0A0A0F] to-secondary/10" />
            
            <div className="z-10 flex flex-col items-center">
               <button
                 className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 transition-all shadow-xl group-hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed"
                 disabled={!interview?.recordingUrl}
                 onClick={() => {
                   if (!interview?.recordingUrl) return;
                   window.open(interview.recordingUrl, "_blank", "noopener,noreferrer");
                 }}
               >
                  <Play className="w-6 h-6 text-white ml-1 fill-white" />
               </button>
               <h3 className="text-base font-bold text-white tracking-tight">Review Interview Recording</h3>
               <p className="text-xs font-medium text-text-muted mt-2 max-w-sm text-center">
                  {interview?.recordingUrl
                    ? "Watch your real interview recording."
                    : "No recording is attached to this interview yet."}
               </p>
            </div>
         </div>
      </Card>
      </>
      )}
    </div>
  );
}
