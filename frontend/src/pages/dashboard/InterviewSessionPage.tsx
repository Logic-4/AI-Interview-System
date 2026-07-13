import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  MessageSquare,
  Zap,
  Mic,
  MicOff,
  Volume2,
  Pause,
  Play,
  StopCircle,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { cn } from "../../lib/utils";
import interviewService from "../../services/interviewService";
import feedbackService from "../../services/feedbackService";
import { useInterviewStore } from "../../stores/interviewStore";
import { useAuthStore } from "../../stores/authStore";
import { useConversationEngine } from "../../hooks/useConversationEngine";
import { computeQuestionsReady } from "../../lib/interviewHelpers";

import type { Question } from "../../types/question";
import type { PopulatedInterview } from "../../types/interview";

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
  const navigate = useNavigate();
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
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [questionsReady, setQuestionsReady] = useState(false);

  // Guard against double-calling completeInterview (race between wrapUp and End button)
  const hasCompletedRef = useRef(false);



  /* ── Fetch interview data ─────────────────────────────────── */
  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const data = await interviewService.getInterview(interviewId);
        if (data.status === "completed") {
          navigate(`/interviews/${interviewId}/report`, { replace: true });
          return;
        }
        setInterview(data);
        setActiveInterview(data);
        // Check if background generation is already done
        const ready = computeQuestionsReady(data);
        setQuestionsReady(ready);
        setPagePhase("ready");
      } catch {
        setError("Failed to load interview. Please try again.");
        setPagePhase("error");
      }
    };

    hasCompletedRef.current = false;
    resetSession();
    fetchInterview();
  }, [interviewId, navigate, setActiveInterview, resetSession]);

  /* ── Poll until all questions are ready ──────────────────── */
  useEffect(() => {
    if (questionsReady || pagePhase === "error" || interview?.generationStatus === "failed" || interview?.generationStatus === "partial") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const data = await interviewService.getInterviewProgress(interviewId, controller.signal);
        setInterview((current) => {
          const merged = current ? { ...current, ...data, questions: data.questions } : data;
          setActiveInterview(merged);
          return merged;
        });
        const ready = computeQuestionsReady(data);
        if (ready) {
          setQuestionsReady(true);
          return;
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        console.warn("[Interview] Progress update failed; retrying", caught);
      }
      timer = setTimeout(poll, 2000);
    };
    timer = setTimeout(poll, 500);

    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [questionsReady, pagePhase, interviewId, interview?.generationStatus, setActiveInterview]);

  /* ── Callbacks for conversation engine ─────────────────── */
  const onSubmitAnswer = useCallback(
    async (
      questionId: string,
      answer: string,
      timeSpent: number,
      extras?: { audio?: Blob | File; activePromptText?: string }
    ) => {
      const audio = extras?.audio;
      const audioFile = audio
        ? audio instanceof File
          ? audio
          : new File([audio], `somali-answer-${questionId}.webm`, { type: audio.type || "audio/webm" })
        : undefined;

      const result = await interviewService.submitAnswer(interviewId, questionId, {
        userAnswer: answer || undefined,
        timeSpent,
        audio: audioFile,
        activePromptText: extras?.activePromptText,
      });
      recordAnswer(questionId, result.question);

      return {
        ...result.evaluation,
        isTimeUp: result.isTimeUp,
        isFollowUp: result.isFollowUp,
        followUpText: result.followUpText,
        answeredCandidateQuestion: result.answeredCandidateQuestion,
      };
    },
    [interviewId, recordAnswer]
  );

  const onComplete = useCallback(async () => {
    if (hasCompletedRef.current) return; // guard against double-call
    hasCompletedRef.current = true;
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
  const generationFailed = interview?.generationStatus === "failed";
  const generationPartial = interview?.generationStatus === "partial";
  const engine = useConversationEngine({
    userName: user?.name ?? "there",
    interviewTitle: interview?.title ?? "",
    interviewType: interview?.type ?? "mixed",
    language: interview?.language ?? "english",
    questions,
    expectedQuestionCount: interview?.expectedQuestionCount ?? questions.length,
    onSubmitAnswer,
    onComplete,
    onGenerateFeedback,
  });

  useEffect(() => {
    if (!questions.length) return;
    void engine.tts.prefetch(questions[0].text);
    if (questions.length > 1) {
      void engine.tts.prefetchMany(questions.slice(1).map((question) => question.text));
    }
  }, [questions, engine.tts.prefetch, engine.tts.prefetchMany]);

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

      // Save session start to sessionStorage for recovery
      sessionStorage.setItem(`interview_${interviewId}_started`, "1");
      setTimeout(() => engine.start(), 300);
    } catch {
      setError("Failed to start interview.");
      setPagePhase("error");
    }
  };

  const handleRetryGeneration = async () => {
    try {
      const updated = await interviewService.retryQuestionGeneration(interviewId);
      setInterview((current) => current ? { ...current, ...updated } : updated);
      setQuestionsReady(false);
    } catch {
      setError("Could not retry question generation. Please try again shortly.");
    }
  };

  /* ── Redirect when analysis done ──────────────────────────── */
  useEffect(() => {
    if (engine.phase === "done") {
      const t = setTimeout(() => {
        sessionStorage.removeItem(`interview_${interviewId}_started`);
        navigate(`/interviews/${interviewId}/report`);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [engine.phase, interviewId, navigate]);

  /* ── Keyboard Listeners (Space to Stop Recording) ─────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && engine.phase === "listening") {
        e.preventDefault();
        engine.stopRecordingForReview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [engine]);

  /* ── Toggle mic ──────────────────────────────────────────── */
  const toggleMic = useCallback(() => {
    setIsMicMuted((prev) => {
      if (prev) {
        engine.recognition.startListening();
      } else {
        engine.recognition.stopListening();
      }
      return !prev;
    });
  }, [engine.recognition]);

  /* ── End interview ───────────────────────────────────────── */
  const handleEndInterview = async () => {
    if (isEnding) return;
    setIsEnding(true);
    engine.tts.cancel();
    engine.recognition.stopListening();
    
    try {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        await interviewService.completeInterview(interviewId);
      }
    } catch {}
    sessionStorage.removeItem(`interview_${interviewId}_started`);
    navigate(`/interviews/${interviewId}/report`);
  };

  /* ─── Loading State ───────────────────────────────────────── */
  if (pagePhase === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-sm font-semibold text-text-muted animate-pulse">Loading interview...</p>
        </div>
      </div>
    );
  }

  /* ─── Error State ─────────────────────────────────────────── */
  if (pagePhase === "error") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card hoverEffect={false} className="p-8 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary dark:text-white mb-2">Something went wrong</h2>
          <p className="text-sm text-text-muted mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <Link to="/interviews">
              <Button variant="outline" className="text-text-primary dark:text-white border-white-light dark:border-[#1b2e4b]">Back to Interviews</Button>
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
      <div className="max-w-2xl mx-auto py-12 space-y-8 animate-in fade-in duration-700 text-black dark:text-white-dark">
        <Link to="/interviews" className="inline-flex items-center gap-2 text-sm font-semibold text-text-muted hover:text-text-primary dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Interviews
        </Link>

        <Card hoverEffect={false} className="p-8 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black relative overflow-hidden">
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary dark:text-white">{interview.title}</h1>
              <p className="text-sm text-text-muted font-semibold">
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
                  <div key={item.label} className="text-center p-3 rounded-md bg-white-light/30 dark:bg-[#1a2941]/50 border border-white-light dark:border-[#1b2e4b]">
                    <Icon className="w-4 h-4 text-primary mx-auto mb-2" />
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-text-primary dark:text-white capitalize">{item.value}</p>
                  </div>
                );
              })}
            </div>

            {interview.jobRole && (
              <div className="text-center">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">{interview.jobRole}</Badge>
              </div>
            )}

            <div className="p-4 rounded-md bg-primary/5 border border-primary/10 flex gap-3">
              <InfoIcon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-xs font-semibold text-text-muted leading-relaxed space-y-1">
                <p>The interviewer will <strong className="text-text-primary dark:text-white">greet you by name</strong>, ask questions, and <strong className="text-text-primary dark:text-white">listen automatically</strong> when you respond.</p>
                <p>Just <strong className="text-text-primary dark:text-white">speak naturally</strong> — recording starts and stops automatically. No buttons needed during the interview.</p>
                <p>Make sure your <strong className="text-text-primary dark:text-white">microphone is allowed</strong> in your browser.</p>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              {!questions.length ? (
                <div className="text-center space-y-4">
                  <div className="flex items-center gap-3 px-6 py-4 rounded-md bg-primary/5 border border-primary/15">
                    {generationFailed ? <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" /> : <LoadingSpinner size="sm" className="flex-shrink-0" />}
                    <div className="text-left">
                      <p className="text-sm font-bold text-text-primary dark:text-white">Preparing your questions…</p>
                      <p className="text-xs font-medium text-text-muted opacity-70">
                        {generationFailed
                          ? (interview.generationError || "The AI model endpoint is unavailable.")
                          : `AI is generating ${interview.expectedQuestionCount ?? "your"} questions in the background`}
                      </p>
                    </div>
                  </div>
                  <div className="h-1 w-64 mx-auto bg-foreground/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary/60 rounded-full"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      style={{ width: "55%" }}
                    />
                  </div>
                  <p className="text-xs text-text-muted opacity-60 font-medium">
                    You'll be able to begin shortly — {questions.length} question{questions.length !== 1 ? "s" : ""} ready so far
                  </p>
                  {generationFailed && (
                    <Button variant="outline" onClick={handleRetryGeneration}>Retry generation</Button>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <Button
                    size="xl"
                    className="h-14 px-12 rounded-md text-sm font-semibold uppercase tracking-wider shadow-xl shadow-primary/20 group text-white animate-pulse"
                    onClick={handleStart}
                  >
                    <Mic className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                    Begin Interview
                  </Button>
                  {!questionsReady && !generationPartial && (
                    <p className="text-xs text-text-muted">Later questions will continue preparing in the background.</p>
                  )}
                  {generationPartial && (
                    <div className="space-y-2">
                      <p className="text-xs text-warning">Some later questions could not be prepared. You can begin now or retry.</p>
                      <Button variant="outline" size="sm" onClick={handleRetryGeneration}>Retry missing questions</Button>
                    </div>
                  )}
                </div>
              )}
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

  /* ── Theater Mode (active session) via React Portal ────────── */
  if (pagePhase === "active") {
    const isSomali = interview?.language === "somali";
    const isListeningPhase = engine.phase === "listening";
    const showListening = isSomali
      ? engine.audioRecorder.isRecording && isListeningPhase
      : engine.recognition.isListening && isListeningPhase;
    const showVisualizerActive = isSomali ? isListeningPhase : showListening;
    const currentQ = questions[engine.currentQuestionIndex];
    const currentQuestionText = currentQ?.text || "";
    const fullTranscript = (engine.recognition.finalTranscript + " " + engine.recognition.interimTranscript).trim();

    /* Analysis overlay */
    if (isAnalyzing) {
      return createPortal(
        <div className="fixed top-0 left-0 w-screen h-screen z-[9999] bg-background text-text-primary dark:text-white flex items-center justify-center">
          <div className="max-w-md w-full text-center space-y-8 px-6">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-10 h-10 text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground dark:text-white">
                {engine.phase === "done" ? "Report Ready!" : "Analyzing Your Interview"}
              </h2>
              <p className="text-sm text-text-secondary dark:text-white-dark mt-2 font-medium">{engine.analysisStage.label}</p>
            </div>
            <div className="space-y-3 max-w-sm mx-auto">
              <div className="h-2 w-full bg-foreground/10 dark:bg-white-light/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: `${engine.analysisStage.progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-xs font-bold text-text-muted dark:text-white-dark tabular-nums">{engine.analysisStage.progress}%</p>
            </div>
            {engine.phase === "done" && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-text-muted">
                Redirecting to your report...
              </motion.p>
            )}
          </div>
        </div>,
        document.body
      );
    }

    /* Active session theater mode — clean single-question UI */
    return createPortal(
      <div className="fixed top-0 left-0 w-screen h-screen z-[9999] bg-background text-text-primary dark:text-white flex flex-col">


        {/* ── Top bar ──────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b border-white-light dark:border-[#1b2e4b]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
              Q{engine.currentQuestionIndex + 1}/{engine.totalQuestions}
            </span>
            <div className="w-28 h-1 bg-white-light dark:bg-[#1b2e4b] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {showListening && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-danger/10 border border-danger/30 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                <span className="text-[10px] font-bold text-danger uppercase tracking-widest">Listening</span>
              </div>
            )}
            {engine.tts.isSpeaking && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md">
                <Volume2 className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Speaking</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#fafafa] dark:bg-[#1a2941] border border-white-light dark:border-[#1b2e4b] rounded-md">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-bold text-foreground dark:text-white tabular-nums">{formatTime(engine.timer)}</span>
            </div>
          </div>
        </div>

        {/* ── Center Content (visualizer + current question) ──── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 overflow-y-auto relative">
          {/* Paused overlay */}
          {engine.isPaused && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm">
              <div className="text-center space-y-4 max-w-sm">
                <div className="w-20 h-20 rounded-full bg-[#fafafa] dark:bg-[#1a2941] border border-white-light dark:border-[#1b2e4b] flex items-center justify-center mx-auto">
                  <Pause className="w-8 h-8 text-text-secondary" />
                </div>
                <h3 className="text-xl font-bold text-foreground dark:text-white">Interview Paused</h3>
                <p className="text-sm text-text-secondary dark:text-white-dark">Press resume to continue when you&apos;re ready.</p>
                <Button onClick={engine.resume} className="mt-4 text-white">
                  <Play className="w-4 h-4 mr-2" /> Resume
                </Button>
              </div>
            </div>
          )}

          {/* Audio Visualizer */}
          <div className="relative w-24 h-24 mb-8 flex-shrink-0">
            <div className={cn(
              "absolute inset-0 rounded-full transition-all duration-500",
              showVisualizerActive ? (isSomali ? "bg-primary/10 scale-110" : "bg-danger/10 scale-110") : engine.tts.isSpeaking ? "bg-primary/10 scale-110" : "bg-[#fafafa] dark:bg-[#1a2941]"
            )}>
              <div className={cn(
                "absolute inset-0 rounded-full animate-ping opacity-40",
                showVisualizerActive ? (isSomali ? "bg-primary/20" : "bg-danger/20") : engine.tts.isSpeaking ? "bg-primary/20" : "bg-foreground/10"
              )} />
            </div>
            <div className={cn(
              "absolute inset-3 rounded-full flex items-center justify-center transition-all duration-300",
              showVisualizerActive ? (isSomali ? "bg-primary/15 border-2 border-primary/40" : "bg-danger/15 border-2 border-danger/40") :
              engine.tts.isSpeaking ? "bg-primary/20 border-2 border-primary/30" :
              "bg-white dark:bg-black border border-white-light dark:border-[#1b2e4b]"
            )}>
              <Mic className={cn(
                "w-8 h-8 transition-all duration-300",
                showListening || (isSomali && isListeningPhase) ? "text-danger" :
                engine.tts.isSpeaking ? "text-primary" :
                "text-text-muted"
              )} />
            </div>
            <div className="absolute -inset-6 flex items-center justify-center pointer-events-none">
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={i}
                  className={cn(
                    "absolute w-[2px] rounded-full",
                    showVisualizerActive ? (isSomali ? "bg-primary/40" : "bg-danger/40") : engine.tts.isSpeaking ? "bg-primary/40" : "bg-foreground/20"
                  )}
                  animate={{
                    height: showVisualizerActive ? (isSomali ? [14, 24, 14] : [14, 36, 14]) : engine.tts.isSpeaking ? [20, 44, 20] : [14, 14, 14],
                    opacity: showVisualizerActive || engine.tts.isSpeaking ? [0.3, 0.7, 0.3] : [0.15],
                  }}
                  transition={{
                    duration: 1 + i * 0.15,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.1,
                  }}
                  style={{
                    transform: `rotate(${i * 60}deg) translateY(-44px)`,
                    transformOrigin: "center center",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Current Question Text */}
          <div className="max-w-2xl w-full text-center mb-4 flex-shrink-0 min-h-[4rem]">
            {!engine.isQuestionTextVisible ? (
              <motion.div
                key="fetching"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center space-x-2"
              >
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"></div>
              </motion.div>
            ) : engine.activeFollowUpText ? (
              <motion.p
                key="follow-up"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-xl md:text-2xl font-bold text-primary leading-relaxed"
              >
                {engine.activeFollowUpText}
              </motion.p>
            ) : currentQuestionText ? (
              <motion.p
                key="original"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xl md:text-2xl font-bold text-foreground dark:text-white leading-relaxed"
              >
                {currentQuestionText}
              </motion.p>
            ) : (
              <p className="text-lg text-text-muted">Preparing question...</p>
            )}
            {engine.tts.status === "preparing" && (
              <p className="mt-3 text-xs font-semibold text-text-muted">Preparing audio...</p>
            )}
            {engine.tts.status === "retrying-fallback" && (
              <p className="mt-3 text-xs font-semibold text-warning">Retrying with a fallback voice...</p>
            )}
            {engine.tts.status === "unavailable" && (
              <p className="mt-3 text-xs font-semibold text-warning">Audio unavailable — continue with the question text.</p>
            )}
          </div>

          {/* Interim transcript */}
          {!isSomali && (showListening || engine.phase === "reviewing") && fullTranscript && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-lg w-full text-center mb-4 flex-shrink-0"
            >
              <div className="px-4 py-3 rounded-md bg-primary/10 border border-primary/20 inline-block">
                <p className="text-sm text-foreground dark:text-white font-semibold leading-relaxed">
                  {engine.recognition.finalTranscript}
                  {engine.recognition.interimTranscript && (
                    <span className="text-text-muted italic">
                      {engine.recognition.finalTranscript ? " " : ""}
                      {engine.recognition.interimTranscript}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                {showListening ? (
                  <>
                    <VolumeBar volume={engine.recognition.volume} />
                    {engine.recognition.isSpeaking ? (
                      <span className="text-[9px] font-bold text-success uppercase tracking-widest">Speaking</span>
                    ) : (
                      <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Waiting...</span>
                    )}
                  </>
                ) : (
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Recording Stopped — Review your answer</span>
                )}
              </div>
            </motion.div>
          )}

          {isSomali && (engine.phase === "listening" || engine.phase === "reviewing") && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-lg w-full text-center px-4 mb-4 flex-shrink-0"
            >
              <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-3 inline-block">
                <p className="text-sm font-semibold text-foreground dark:text-white">
                  {engine.phase === "listening"
                    ? "Hadalkaga waa la duubayaa..."
                    : "Duubista waa la joojiyay. Gudbi jawaabta markaad diyaar tahay."}
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <VolumeBar volume={engine.audioRecorder.analyserData ? 0.12 : 0} />
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">
                    {engine.phase === "listening" ? "Recording" : "Ready"}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Processing indicator */}
          {engine.phase === "processing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 px-4 py-2 justify-center flex-shrink-0"
            >
              <LoadingSpinner size="sm" />
              <span className="text-xs font-semibold text-text-muted">Evaluating your answer...</span>
            </motion.div>
          )}
        </div>

        {/* ── Bottom Control Bar (fixed) ────────────────────────── */}
        <div className="fixed bottom-0 left-0 w-full bg-white/95 dark:bg-black/90 backdrop-blur-md shadow-lg border-t border-white-light dark:border-[#1b2e4b] px-6 py-3 z-[10000]">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {showListening && !isSomali ? (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                  <span className="text-xs font-semibold text-text-secondary truncate">Listening</span>
                </div>
              ) : engine.recognition.error && !isSomali ? (
                <div className="flex items-center gap-2">
                  <MicOff className="w-4 h-4 text-danger flex-shrink-0" />
                  <span className="text-xs font-semibold text-danger truncate">Mic error</span>
                </div>
              ) : null}
              {engine.phase === "listening" && !showListening && isMicMuted && !isSomali && (
                <span className="text-xs font-semibold text-warning">Mic muted</span>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-1.5">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i < engine.answeredCount ? "bg-success" : i === engine.currentQuestionIndex ? "bg-primary scale-125" : "bg-white-light dark:bg-[#1b2e4b]"
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {(engine.phase === "listening" || engine.phase === "reviewing") && (
                <div className="flex items-center gap-2">
                  {engine.phase === "listening" && (
                    <button
                      onClick={engine.stopRecordingForReview}
                      className="h-8 px-3 rounded-md text-[10px] font-bold text-foreground dark:text-white bg-warning/10 border border-warning/30 hover:bg-warning/20 transition-colors"
                    >
                      <Pause className="w-3 h-3 mr-1.5 inline-block align-middle" />
                      Stop Recording (Space)
                    </button>
                  )}
                  <button
                    onClick={() => engine.handleManualSubmit()}
                    className="h-8 px-3 rounded-md text-[10px] font-bold text-white bg-primary hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1.5 inline-block align-middle" />
                    Submit Answer
                  </button>
                </div>
              )}

              {!isSomali && (
                <button
                  onClick={toggleMic}
                  disabled={!showListening}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                    isMicMuted ? "bg-warning/10 text-warning border border-warning/30" :
                    showListening ? "bg-danger/10 text-danger border border-danger/30" :
                    "bg-white-light/30 dark:bg-[#1a2941]/50 text-text-muted border border-white-light dark:border-[#1b2e4b]"
                  )}
                  title={isMicMuted ? "Unmute" : "Mute"}
                >
                  {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}

              <button
                onClick={engine.isPaused ? engine.resume : engine.pause}
                className="w-10 h-10 rounded-full bg-white-light/30 dark:bg-[#1a2941]/50 border border-white-light dark:border-[#1b2e4b] flex items-center justify-center text-text-secondary hover:bg-white-light dark:hover:bg-[#1b2e4b] transition-all"
                title={engine.isPaused ? "Resume" : "Pause"}
              >
                {engine.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>

              <button
                onClick={handleEndInterview}
                disabled={isEnding}
                className="h-10 px-4 rounded-md text-[10px] font-bold uppercase tracking-wider bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 transition-colors disabled:opacity-50"
              >
                {isEnding ? (
                  <LoadingSpinner size="sm" className="text-danger" />
                ) : (
                  <><StopCircle className="w-4 h-4 mr-1.5 inline-block align-middle" /> End</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Spacer for fixed bottom bar */}
        <div className="h-16 flex-shrink-0" />
      </div>,
      document.body
    );
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

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
            i < filled ? "bg-success h-3" : "bg-foreground/20 h-1.5"
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
