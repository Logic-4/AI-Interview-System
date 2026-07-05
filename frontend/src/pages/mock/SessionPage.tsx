import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Mic,
  MicOff,
  Volume2,
  Pause,
  Play,
  StopCircle,
  Loader2,
} from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { cn } from "../../lib/utils";
import interviewService from "../../services/interviewService";
import feedbackService from "../../services/feedbackService";
import { useInterviewStore } from "../../stores/interviewStore";
import { useAuthStore } from "../../stores/authStore";
import { useConversationEngine } from "../../hooks/useConversationEngine";

import type { Question } from "../../types/question";
import type { PopulatedInterview } from "../../types/interview";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

type PagePhase = "loading" | "ready" | "active" | "error" | "no-interview";

export default function SessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { activeInterview, setActiveInterview, recordAnswer, resetSession } = useInterviewStore();

  const [pagePhase, setPagePhase] = useState<PagePhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [interview, setInterview] = useState<PopulatedInterview | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isEnding, setIsEnding] = useState(false);



  /* ── Resolve interview ─────────────────────────── */
  useEffect(() => {
    const interviewId = searchParams.get("id");

    const load = async () => {
      resetSession();

      if (interviewId) {
        try {
          const data = await interviewService.getInterview(interviewId);
          if (data.status === "completed") {
            navigate(`/interviews/${interviewId}/report`, { replace: true });
            return;
          }
          setInterview(data);
          setActiveInterview(data);
          setPagePhase("ready");
          return;
        } catch {
          setError("Failed to load interview.");
          setPagePhase("error");
          return;
        }
      }

      if (activeInterview && activeInterview.status !== "completed") {
        setInterview(activeInterview as PopulatedInterview);
        setPagePhase("ready");
        return;
      }

      setPagePhase("no-interview");
    };

    load();
  }, [searchParams, navigate, setActiveInterview, resetSession, activeInterview]);

  /* ── Callbacks for conversation engine ──────── */
  const getInterviewId = () => interview?._id || activeInterview?._id || "";

  const onSubmitAnswer = useCallback(
    async (
      questionId: string,
      answer: string,
      timeSpent: number,
      extras?: { audio?: Blob | File; activePromptText?: string }
    ) => {
      const id = interview?._id || activeInterview?._id || "";
      if (!id) throw new Error("No interview ID");

      const audio = extras?.audio;
      const audioFile = audio
        ? audio instanceof File
          ? audio
          : new File([audio], `somali-answer-${questionId}.webm`, { type: audio.type || "audio/webm" })
        : undefined;

      const result = await interviewService.submitAnswer(id, questionId, {
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
    [recordAnswer, interview]
  );

  const onComplete = useCallback(async () => {
    const id = getInterviewId();
    if (!id) return;
    await interviewService.completeInterview(id);
  }, []);

  const onGenerateFeedback = useCallback(async () => {
    const id = getInterviewId();
    if (!id) return;
    try {
      await feedbackService.generateFeedback(id);
    } catch { /* non-critical */ }
  }, []);

  /* ── Conversation engine ────────────────────── */
  const questions: Question[] = interview?.questions ?? [];
  const isSomali = interview?.language === "somali";
  const engine = useConversationEngine({
    userName: user?.name ?? "there",
    interviewTitle: interview?.title ?? "",
    interviewType: interview?.type ?? "mixed",
    language: interview?.language ?? "english",
    questions,
    onSubmitAnswer,
    onComplete,
    onGenerateFeedback,
  });

  /* ── Start ──────────────────────────────────── */
  const handleStart = async () => {
    const id = getInterviewId();
    if (!id) return;
    try {
      setPagePhase("loading");
      const started = await interviewService.startInterview(id);
      setInterview(started);
      setActiveInterview(started);
      setPagePhase("active");

      setTimeout(() => engine.start(), 300);
    } catch {
      setError("Failed to start interview.");
      setPagePhase("error");
    }
  };

  /* ── Redirect when done ─────────────────────── */
  useEffect(() => {
    if (engine.phase === "done") {
      const t = setTimeout(() => {
        navigate(`/processing`);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [engine.phase, navigate]);

  /* ── Keyboard shortcut (Space) ──────────────── */
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

  /* ── Toggle mic ─────────────────────────────── */
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

  /* ── End interview ──────────────────────────── */
  const handleEndInterview = async () => {
    if (isEnding) return;
    setIsEnding(true);
    engine.tts.cancel();
    engine.recognition.stopListening();
    const id = getInterviewId();
    if (id) {
      try { await interviewService.completeInterview(id); } catch {}
    }
    navigate(`/processing`);
  };

  /* ──────────────────────────────────────────────────────────────
     Render: Loading
     ──────────────────────────────────────────────────────────── */
  if (pagePhase === "loading") {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size="lg" />
          <p className="text-sm font-semibold text-text-muted animate-pulse">Loading interview session...</p>
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────────
     Render: Error
     ──────────────────────────────────────────────────────────── */
  if (pagePhase === "error") {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <Card hoverEffect={false} className="p-8 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">Something went wrong</h2>
          <p className="text-sm text-text-muted mb-6">{error || "Could not load interview session."}</p>
          <div className="flex gap-3 justify-center">
            <Link to="/preparation">
              <Button variant="outline" className="text-text-primary border-white-light dark:border-[#1b2e4b]">Back to Preparation</Button>
            </Link>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────────
     Render: No interview selected
     ──────────────────────────────────────────────────────────── */
  if (pagePhase === "no-interview") {
    return (
      <div className="min-h-screen bg-[#0E1117] text-text-primary flex flex-col items-center justify-center px-6">
        <Card hoverEffect={false} className="p-10 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black max-w-lg text-center">
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-bold text-foreground mb-2">No Interview Selected</h2>
          <p className="text-sm text-text-muted mb-6">
            Start by creating a new interview or go through the preparation checklist.
          </p>
          <div className="flex gap-3 justify-center">
            <Link to="/preparation">
              <Button className="text-white">Go to Preparation</Button>
            </Link>
            <Link to="/interviews/new">
              <Button variant="outline" className="text-text-primary border-white-light dark:border-[#1b2e4b]">New Interview</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────────
     Render: Ready (pre-session lobby)
     ──────────────────────────────────────────────────────────── */
  if (pagePhase === "ready" && interview) {
    return (
      <div className="min-h-screen bg-[#0E1117] text-text-primary flex flex-col items-center justify-center px-6">
        <div className="max-w-xl w-full space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Mic className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{interview.title || "Mock Interview"}</h1>
          <p className="text-text-muted text-sm font-semibold">
            {isSomali
              ? "Wareysiga ayaa diyaar ah. Ka jawaab codkaaga."
              : "Your AI interviewer is ready. Just speak naturally."}
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
            {[
              { label: isSomali ? "Nooca" : "Type", value: interview.type.replace("-", " ") },
              { label: isSomali ? "Heerka" : "Level", value: interview.difficulty },
              { label: isSomali ? "Muddada" : "Duration", value: `${interview.duration}m` },
              { label: isSomali ? "Su'aalaha" : "Questions", value: String(questions.length) },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-md bg-white/5 border border-white/10">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-white capitalize">{item.value}</p>
              </div>
            ))}
          </div>
          <Button
            size="xl"
            className="h-14 px-12 rounded-md text-sm font-semibold uppercase tracking-wider shadow-xl shadow-primary/20 text-white animate-pulse"
            onClick={handleStart}
          >
            <Mic className="w-5 h-5 mr-2" />
            {isSomali ? "Bilow Wareysiga" : "Begin Interview"}
          </Button>
        </div>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────────────
     Render: Active session (theater mode via portal)
     ──────────────────────────────────────────────────────────── */
  if (pagePhase === "active") {
    const progressPercent = questions.length > 0
      ? Math.round((engine.answeredCount / questions.length) * 100)
      : 0;
    const isAnalyzing = engine.phase === "analyzing" || engine.phase === "done";
    const isListeningPhase = engine.phase === "listening";
    const showListening = isSomali
      ? engine.audioRecorder.isRecording && isListeningPhase
      : engine.recognition.isListening && isListeningPhase;
    const showVisualizerActive = isSomali ? isListeningPhase : showListening;
    const currentQ = questions[engine.currentQuestionIndex];
    const currentQuestionText = currentQ?.text || "";
    const fullTranscript = (engine.recognition.finalTranscript + " " + engine.recognition.interimTranscript).trim();

    if (isAnalyzing) {
      return createPortal(
        <div className="fixed top-0 left-0 w-screen h-screen z-[9999] bg-background text-text-primary flex items-center justify-center">
          <div className="max-w-md w-full text-center space-y-8 px-6">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-10 h-10 text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {engine.phase === "done" ? (isSomali ? "Diiwaanka waa diyaar!" : "Report Ready!") : (isSomali ? "Falanqaynta wareysiga..." : "Analyzing Your Interview")}
              </h2>
              <p className="text-sm text-text-secondary mt-2 font-medium">{engine.analysisStage.label}</p>
            </div>
            <div className="space-y-3 max-w-sm mx-auto">
              <div className="h-2 w-full bg-foreground/10 rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${engine.analysisStage.progress}%` }} transition={{ duration: 0.5 }} />
              </div>
              <p className="text-xs font-bold text-text-muted tabular-nums">{engine.analysisStage.progress}%</p>
            </div>
            {engine.phase === "done" && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-text-muted">
                {isSomali ? "Lagugu wareejinayaa diiwaanka..." : "Redirecting to your report..."}
              </motion.p>
            )}
          </div>
        </div>,
        document.body
      );
    }

    return createPortal(
      <div className="fixed top-0 left-0 w-screen h-screen z-[9999] bg-background text-text-primary flex flex-col">


        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 flex-shrink-0 border-b border-white-light dark:border-[#1b2e4b]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
              Q{engine.currentQuestionIndex + 1}/{engine.totalQuestions}
            </span>
            <div className="w-28 h-1 bg-white-light dark:bg-[#1b2e4b] rounded-full overflow-hidden">
              <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progressPercent}%` }} transition={{ duration: 0.5 }} />
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
              <span className="text-sm font-bold text-foreground tabular-nums">{formatTime(engine.timer)}</span>
            </div>
          </div>
        </div>

        {/* Center Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 overflow-y-auto relative">
          {engine.isPaused && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80 backdrop-blur-sm">
              <div className="text-center space-y-4 max-w-sm">
                <div className="w-20 h-20 rounded-full bg-[#fafafa] dark:bg-[#1a2941] border border-white-light dark:border-[#1b2e4b] flex items-center justify-center mx-auto">
                  <Pause className="w-8 h-8 text-text-secondary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Interview Paused</h3>
                <p className="text-sm text-text-secondary">Press resume to continue.</p>
                <Button onClick={engine.resume} className="mt-4 text-white"><Play className="w-4 h-4 mr-2" /> Resume</Button>
              </div>
            </div>
          )}

          {/* Audio Visualizer */}
          <div className="relative w-24 h-24 mb-8 flex-shrink-0">
            <div className={cn("absolute inset-0 rounded-full transition-all duration-500", showVisualizerActive ? (isSomali ? "bg-primary/10 scale-110" : "bg-danger/10 scale-110") : engine.tts.isSpeaking ? "bg-primary/10 scale-110" : "bg-[#fafafa] dark:bg-[#1a2941]")}>
              <div className={cn("absolute inset-0 rounded-full animate-ping opacity-40", showVisualizerActive ? (isSomali ? "bg-primary/20" : "bg-danger/20") : engine.tts.isSpeaking ? "bg-primary/20" : "bg-foreground/10")} />
            </div>
            <div className={cn("absolute inset-3 rounded-full flex items-center justify-center transition-all duration-300", showVisualizerActive ? (isSomali ? "bg-primary/15 border-2 border-primary/40" : "bg-danger/15 border-2 border-danger/40") : engine.tts.isSpeaking ? "bg-primary/20 border-2 border-primary/30" : "bg-white dark:bg-black border border-white-light dark:border-[#1b2e4b]")}>
              <Mic className={cn("w-8 h-8 transition-all duration-300", showListening || (isSomali && isListeningPhase) ? "text-danger" : engine.tts.isSpeaking ? "text-primary" : "text-text-muted")} />
            </div>
            <div className="absolute -inset-6 flex items-center justify-center pointer-events-none">
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={i}
                  className={cn("absolute w-[2px] rounded-full", showVisualizerActive ? (isSomali ? "bg-primary/40" : "bg-danger/40") : engine.tts.isSpeaking ? "bg-primary/40" : "bg-foreground/20")}
                  animate={{ height: showVisualizerActive ? (isSomali ? [14, 24, 14] : [14, 36, 14]) : engine.tts.isSpeaking ? [20, 44, 20] : [14, 14, 14], opacity: showVisualizerActive || engine.tts.isSpeaking ? [0.3, 0.7, 0.3] : [0.15] }}
                  transition={{ duration: 1 + i * 0.15, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }}
                  style={{ transform: `rotate(${i * 60}deg) translateY(-44px)`, transformOrigin: "center center" }}
                />
              ))}
            </div>
          </div>

          {/* Question Text */}
          <div className="max-w-2xl w-full text-center mb-4 flex-shrink-0 min-h-[4rem]">
            {!engine.isQuestionTextVisible ? (
              <motion.div key="fetching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"></div>
              </motion.div>
            ) : engine.activeFollowUpText ? (
              <motion.p key="follow-up" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-xl md:text-2xl font-bold text-primary leading-relaxed">{engine.activeFollowUpText}</motion.p>
            ) : currentQuestionText ? (
              <motion.p key="original" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xl md:text-2xl font-bold text-foreground leading-relaxed">{currentQuestionText}</motion.p>
            ) : (
              <p className="text-lg text-text-muted">Preparing question...</p>
            )}
          </div>

          {/* English transcript */}
          {!isSomali && (showListening || engine.phase === "reviewing") && fullTranscript && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full text-center mb-4 flex-shrink-0">
              <div className="px-4 py-3 rounded-md bg-primary/10 border border-primary/20 inline-block">
                <p className="text-sm text-foreground font-semibold leading-relaxed">
                  {engine.recognition.finalTranscript}
                  {engine.recognition.interimTranscript && <span className="text-text-muted italic">{engine.recognition.finalTranscript ? " " : ""}{engine.recognition.interimTranscript}</span>}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                {showListening ? (
                  <>
                    <VolumeBar volume={engine.recognition.volume} />
                    {engine.recognition.isSpeaking ? <span className="text-[9px] font-bold text-success uppercase tracking-widest">Speaking</span> : <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Waiting...</span>}
                  </>
                ) : (
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Recording Stopped — Review your answer</span>
                )}
              </div>
            </motion.div>
          )}

          {/* Somali recording indicator */}
          {isSomali && (engine.phase === "listening" || engine.phase === "reviewing") && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg w-full text-center px-4 mb-4 flex-shrink-0">
              <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-3 inline-block">
                <p className="text-sm font-semibold text-foreground">
                  {engine.phase === "listening" ? "Hadalkaga waa la duubayaa..." : "Duubista waa la joojiyay. Gudbi jawaabta markaad diyaar tahay."}
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <VolumeBar volume={engine.audioRecorder.analyserData ? 0.12 : 0} />
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">{engine.phase === "listening" ? "Recording" : "Ready"}</span>
                </div>
              </div>
            </motion.div>
          )}

          {engine.phase === "processing" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-4 py-2 justify-center flex-shrink-0">
              <LoadingSpinner size="sm" />
              <span className="text-xs font-semibold text-text-muted">Evaluating your answer...</span>
            </motion.div>
          )}
        </div>

        {/* Bottom Bar */}
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
            </div>

            <div className="hidden sm:flex items-center gap-1.5">
              {questions.map((_, i) => (
                <div key={i} className={cn("w-2 h-2 rounded-full transition-all", i < engine.answeredCount ? "bg-success" : i === engine.currentQuestionIndex ? "bg-primary scale-125" : "bg-white-light dark:bg-[#1b2e4b]")} />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {(engine.phase === "listening" || engine.phase === "reviewing") && (
                <div className="flex items-center gap-2">
                  {engine.phase === "listening" && (
                    <button onClick={engine.stopRecordingForReview} className="h-8 px-3 rounded-md text-[10px] font-bold text-foreground bg-warning/10 border border-warning/30 hover:bg-warning/20 transition-colors">
                      <Pause className="w-3 h-3 mr-1.5 inline-block align-middle" />
                      Stop Recording (Space)
                    </button>
                  )}
                  <button onClick={() => engine.handleManualSubmit()} className="h-8 px-3 rounded-md text-[10px] font-bold text-white bg-primary hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
                    <CheckCircle2 className="w-3 h-3 mr-1.5 inline-block align-middle" />
                    Submit Answer
                  </button>
                </div>
              )}

              {!isSomali && (
                <button onClick={toggleMic} disabled={!showListening} className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-all", isMicMuted ? "bg-warning/10 text-warning border border-warning/30" : showListening ? "bg-danger/10 text-danger border border-danger/30" : "bg-white-light/30 dark:bg-[#1a2941]/50 text-text-muted border border-white-light dark:border-[#1b2e4b]")} title={isMicMuted ? "Unmute" : "Mute"}>
                  {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}

              <button onClick={engine.isPaused ? engine.resume : engine.pause} className="w-10 h-10 rounded-full bg-white-light/30 dark:bg-[#1a2941]/50 border border-white-light dark:border-[#1b2e4b] flex items-center justify-center text-text-secondary hover:bg-white-light dark:hover:bg-[#1b2e4b] transition-all" title={engine.isPaused ? "Resume" : "Pause"}>
                {engine.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>

              <button onClick={handleEndInterview} disabled={isEnding} className="h-10 px-4 rounded-md text-[10px] font-bold uppercase tracking-wider bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 transition-colors disabled:opacity-50">
                {isEnding ? <LoadingSpinner size="sm" className="text-danger" /> : <><StopCircle className="w-4 h-4 mr-1.5 inline-block align-middle" /> End</>}
              </button>
            </div>
          </div>
        </div>

        <div className="h-16 flex-shrink-0" />
      </div>,
      document.body
    );
  }

  return null;
}

function VolumeBar({ volume }: { volume: number }) {
  const bars = 8;
  const filled = Math.round(volume * bars * 8);
  return (
    <div className="flex items-center gap-[2px]">
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} className={cn("w-[3px] rounded-full transition-all duration-75", i < filled ? "bg-success h-3" : "bg-foreground/20 h-1.5")} />
      ))}
    </div>
  );
}
