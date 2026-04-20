"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  MessageSquare,
  Zap,
  Mic,
  MicOff,
  Volume2,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import interviewService from "@/services/interviewService";
import feedbackService from "@/services/feedbackService";
import { useInterviewStore } from "@/stores/interviewStore";
import { useAuthStore } from "@/stores/authStore";
import {
  useConversationEngine,
  type ChatMessage,
} from "@/hooks/useConversationEngine";
import type { Question } from "@/types/question";
import type { PopulatedInterview } from "@/types/interview";

/* ─── Timer helper ──────────────────────────────────────────── */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/* ─── Page phases ───────────────────────────────────────────── */
type PagePhase = "loading" | "ready" | "active" | "error";

export default function InterviewSessionPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params.id as string;
  const { user } = useAuthStore();

  const {
    setActiveInterview,
    setSessionActive,
    recordAnswer,
    resetSession,
  } = useInterviewStore();

  const [pagePhase, setPagePhase] = useState<PagePhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [interview, setInterview] = useState<PopulatedInterview | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  /* ── Fetch interview data ─────────────────────────────────── */
  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const data = await interviewService.getInterview(interviewId);
        if (data.status === "completed") {
          router.replace(`/interviews/${interviewId}/report`);
          return;
        }
        setInterview(data);
        setActiveInterview(data);
        setPagePhase("ready");
      } catch {
        setError("Failed to load interview. Please try again.");
        setPagePhase("error");
      }
    };

    resetSession();
    fetchInterview();

    return () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  /* ── Callbacks for conversation engine ─────────────────── */
  const onSubmitAnswer = useCallback(
    async (questionId: string, answer: string, timeSpent: number) => {
      const result = await interviewService.submitAnswer(interviewId, questionId, {
        userAnswer: answer,
        timeSpent,
      });
      recordAnswer(questionId, result.question);
      return result.evaluation;
    },
    [interviewId, recordAnswer]
  );

  const onComplete = useCallback(async () => {
    await interviewService.completeInterview(interviewId);
  }, [interviewId]);

  const onGenerateFeedback = useCallback(async () => {
    try {
      await feedbackService.generateFeedback(interviewId);
    } catch {
      // Non-critical — report page handles missing feedback
    }
  }, [interviewId]);

  /* ── Conversation engine ─────────────────────────────────── */
  const questions: Question[] = interview?.questions ?? [];
  const engine = useConversationEngine({
    userName: user?.name ?? "there",
    interviewTitle: interview?.title ?? "",
    interviewType: interview?.type ?? "mixed",
    questions,
    onSubmitAnswer,
    onComplete,
    onGenerateFeedback,
  });

  /* ── Auto-scroll chat ─────────────────────────────────────── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [engine.messages.length, engine.recognition.interimTranscript]);

  /* ── Start interview (API + engine) ───────────────────────── */
  const handleStart = async () => {
    if (!interview) return;
    try {
      setPagePhase("loading");
      const started = await interviewService.startInterview(interviewId);
      setInterview(started);
      setActiveInterview(started);
      setSessionActive(true);
      setPagePhase("active");
      // Small delay to let UI mount, then start engine
      setTimeout(() => engine.start(), 300);
    } catch {
      setError("Failed to start interview.");
      setPagePhase("error");
    }
  };

  /* ── Redirect when analysis done ──────────────────────────── */
  useEffect(() => {
    if (engine.phase === "done") {
      const t = setTimeout(() => {
        router.push(`/interviews/${interviewId}/report`);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [engine.phase, interviewId, router]);

  /* ─── Loading State ───────────────────────────────────────── */
  if (pagePhase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-text-muted">Loading interview...</p>
        </div>
      </div>
    );
  }

  /* ─── Error State ─────────────────────────────────────────── */
  if (pagePhase === "error") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card hoverEffect={false} className="p-8 border-border/40 bg-surface/30 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">Something went wrong</h2>
          <p className="text-sm text-text-muted mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Link href="/interviews">
              <Button variant="outline" className="text-text-primary border-border/40">Back to Interviews</Button>
            </Link>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ─── Ready State — Pre-session lobby ─────────────────────── */
  if (pagePhase === "ready" && interview) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-8 animate-in fade-in duration-700">
        <Link href="/interviews" className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Interviews
        </Link>

        <Card hoverEffect={false} className="p-8 border-border/40 bg-surface/30 backdrop-blur-2xl relative overflow-hidden">
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">{interview.title}</h1>
              <p className="text-sm text-text-muted font-medium">
                Your AI interviewer is ready. This will feel like a live conversation — just speak naturally.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Type", value: interview.type.replace("-", " "), icon: MessageSquare },
                { label: "Level", value: interview.difficulty, icon: BarChart3 },
                { label: "Duration", value: `${interview.duration}m`, icon: Clock },
                { label: "Questions", value: String(questions.length), icon: CheckCircle2 },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="text-center p-3 rounded-xl bg-foreground/[0.03] border border-border/40">
                    <Icon className="w-4 h-4 text-primary mx-auto mb-2" />
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-text-primary capitalize">{item.value}</p>
                  </div>
                );
              })}
            </div>

            {interview.jobRole && (
              <div className="text-center">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">{interview.jobRole}</Badge>
              </div>
            )}

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3">
              <InfoIcon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-xs font-semibold text-text-muted leading-relaxed space-y-1">
                <p>The interviewer will <strong className="text-text-primary">greet you by name</strong>, ask questions, and <strong className="text-text-primary">listen automatically</strong> when you respond.</p>
                <p>Just <strong className="text-text-primary">speak naturally</strong> — recording starts and stops automatically. No buttons needed during the interview.</p>
                <p>Make sure your <strong className="text-text-primary">microphone is allowed</strong> in your browser.</p>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button
                size="xl"
                className="h-14 px-12 rounded-xl text-sm font-semibold uppercase tracking-wider shadow-xl shadow-primary/20 group"
                onClick={handleStart}
              >
                <Mic className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Begin Interview
              </Button>
            </div>
          </div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        </Card>
      </div>
    );
  }

  /* ─── Active / Conversation Session ───────────────────────── */
  const progressPercent =
    questions.length > 0
      ? Math.round((engine.answeredCount / questions.length) * 100)
      : 0;

  const isAnalyzing = engine.phase === "analyzing" || engine.phase === "done";

  /* ── Analysis overlay ──────────────────────────────────────── */
  if (isAnalyzing) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] animate-in fade-in duration-700">
        <Card hoverEffect={false} className="p-10 border-border/40 bg-surface/30 max-w-md w-full text-center space-y-8">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto relative">
            <BarChart3 className="w-10 h-10 text-primary" />
            {engine.phase !== "done" && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary animate-ping" />
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-text-primary">
              {engine.phase === "done" ? "Report Ready!" : "Analyzing Your Interview"}
            </h2>
            <p className="text-sm text-text-muted font-medium">{engine.analysisStage.label}</p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-2.5 w-full bg-foreground/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                animate={{ width: `${engine.analysisStage.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-xs font-bold text-text-muted tabular-nums">
              {engine.analysisStage.progress}%
            </p>
          </div>

          {engine.phase === "done" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-xs text-text-muted font-medium">Redirecting to your report...</p>
            </motion.div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-3 animate-in fade-in duration-500 flex flex-col h-[calc(100vh-6rem)]">
      {/* ── Top Bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
            Q{engine.currentQuestionIndex + 1}/{engine.totalQuestions}
          </span>
          <div className="w-28 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-[10px] font-bold text-text-muted">{progressPercent}%</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Live listening indicator */}
          {engine.recognition.isListening && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-danger/10 border border-danger/20 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              <span className="text-[10px] font-bold text-danger uppercase tracking-widest">Listening</span>
            </div>
          )}
          {engine.tts.isSpeaking && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-lg">
              <Volume2 className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Speaking</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground/[0.03] border border-border/40 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-bold text-text-primary tabular-nums">{formatTime(engine.timer)}</span>
          </div>
        </div>
      </div>

      {/* ── Chat Area ──────────────────────────────────────── */}
      <Card hoverEffect={false} className="flex-1 border-border/40 bg-surface/30 backdrop-blur-2xl relative overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
          <AnimatePresence initial={false}>
            {engine.messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} tts={engine.tts} />
            ))}
          </AnimatePresence>

          {/* Live transcript preview */}
          {engine.phase === "listening" && (
            <div className="flex justify-end">
              <div className="max-w-[80%] space-y-1">
                {(engine.recognition.finalTranscript || engine.recognition.interimTranscript) && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-4 py-3 rounded-2xl rounded-br-md bg-primary/10 border border-primary/20"
                  >
                    <p className="text-sm text-text-primary font-medium leading-relaxed">
                      {engine.recognition.finalTranscript}
                      {engine.recognition.interimTranscript && (
                        <span className="text-text-muted/60 italic">
                          {engine.recognition.finalTranscript ? " " : ""}
                          {engine.recognition.interimTranscript}
                        </span>
                      )}
                    </p>
                  </motion.div>
                )}

                {/* Volume indicator */}
                <div className="flex items-center justify-end gap-2 px-1">
                  <VolumeBar volume={engine.recognition.volume} />
                  {engine.recognition.isSpeaking && (
                    <span className="text-[9px] font-bold text-success uppercase tracking-widest">Speaking</span>
                  )}
                  {!engine.recognition.isSpeaking && engine.recognition.isListening && (
                    <span className="text-[9px] font-bold text-text-muted/50 uppercase tracking-widest">Waiting...</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Processing indicator */}
          {engine.phase === "processing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 px-4 py-2"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span className="text-xs font-medium text-text-muted">Evaluating your answer...</span>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>

        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      </Card>

      {/* ── Bottom Controls ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0 px-1">
        <div className="flex items-center gap-2">
          {engine.recognition.isListening ? (
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-danger animate-pulse" />
              <span className="text-xs font-semibold text-text-muted">
                Mic active — speak naturally
              </span>
            </div>
          ) : engine.recognition.error ? (
            <div className="flex items-center gap-2">
              <MicOff className="w-4 h-4 text-danger" />
              <span className="text-xs font-semibold text-danger">Mic error: {engine.recognition.error}</span>
            </div>
          ) : (
            <span className="text-xs font-semibold text-text-muted/50">
              {engine.phase === "asking" || engine.phase === "greeting"
                ? "Interviewer is speaking..."
                : engine.phase === "reacting" || engine.phase === "transitioning"
                  ? "Moving on..."
                  : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {engine.phase === "listening" && (
            <Button
              variant="outline"
              onClick={engine.interruptAndContinue}
              className="h-8 px-3 rounded-lg text-[10px] font-bold text-text-muted border-border/40"
            >
              <SkipForward className="w-3 h-3 mr-1.5" />
              {(engine.recognition.finalTranscript + engine.recognition.interimTranscript).trim()
                ? "Submit & Continue"
                : "Skip Question"}
            </Button>
          )}
          {/* Question progress dots */}
          <div className="flex items-center gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i < engine.answeredCount
                    ? "bg-success"
                    : i === engine.currentQuestionIndex
                      ? "bg-primary scale-125"
                      : "bg-foreground/15"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

function ChatBubble({
  message,
  tts,
}: {
  message: ChatMessage;
  tts: ReturnType<typeof import("@/hooks/useSpeechSynthesis").useSpeechSynthesis>;
}) {
  const isInterviewer = message.role === "interviewer";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex justify-center"
      >
        <span className="text-[10px] font-bold text-text-muted/50 uppercase tracking-widest bg-foreground/[0.03] px-3 py-1 rounded-full">
          {message.text}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex", isInterviewer ? "justify-start" : "justify-end")}
    >
      <div
        className={cn(
          "max-w-[80%] px-4 py-3 rounded-2xl",
          isInterviewer
            ? "bg-foreground/[0.04] border border-border/30 rounded-bl-md"
            : "bg-primary/10 border border-primary/20 rounded-br-md"
        )}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5 text-text-muted/50">
          {isInterviewer ? "Interviewer" : "You"}
        </p>
        <p className="text-sm text-text-primary font-medium leading-relaxed">
          {isInterviewer && tts.isSpeaking
            ? message.text.split(/\s+/).map((word, i, arr) => {
                const isHighlighted = tts.highlight?.wordIndex === i;
                return (
                  <span key={i}>
                    <span
                      className={cn(
                        "transition-all duration-100 rounded-sm px-[1px]",
                        isHighlighted ? "bg-primary/20 text-primary font-semibold" : ""
                      )}
                    >
                      {word}
                    </span>
                    {i < arr.length - 1 ? " " : ""}
                  </span>
                );
              })
            : message.text}
        </p>
      </div>
    </motion.div>
  );
}

function VolumeBar({ volume }: { volume: number }) {
  const bars = 8;
  const filled = Math.round(volume * bars * 8);
  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-[3px] rounded-full transition-all duration-75",
            i < filled ? "bg-success h-3" : "bg-foreground/15 h-1.5"
          )}
        />
      ))}
    </div>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
