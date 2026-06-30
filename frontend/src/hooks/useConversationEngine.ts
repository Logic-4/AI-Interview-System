"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSpeechSynthesis } from "./useSpeechSynthesis";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useAudioRecorder } from "./useAudioRecorder";
import type { Question } from "@/types/question";

/* ─── Types ─────────────────────────────────────────────── */
export type ConversationPhase =
  | "idle"
  | "greeting"
  | "asking"
  | "listening"
  | "processing"
  | "reacting"
  | "follow-up"
  | "transitioning"
  | "wrapping-up"
  | "analyzing"
  | "reviewing"
  | "done";

export interface ChatMessage {
  id: string;
  role: "interviewer" | "candidate" | "system";
  text: string;
  timestamp: number;
}

export interface AnalysisStage {
  label: string;
  progress: number;
}

export interface ConversationEngineConfig {
  userName: string;
  interviewTitle: string;
  interviewType: string;
  language?: string;
  questions: Question[];
  onSubmitAnswer: (questionId: string, answer: string, timeSpent: number, audio?: Blob | File) => Promise<{
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
    suggestedAnswer: string;
    isTimeUp?: boolean;
    isFollowUp?: boolean;
    followUpText?: string | null;
  }>;
  onComplete: () => Promise<void>;
  onGenerateFeedback: () => Promise<void>;
}

export interface ConversationEngineReturn {
  phase: ConversationPhase;
  currentQuestionIndex: number;
  totalQuestions: number;
  answeredCount: number;
  tts: ReturnType<typeof useSpeechSynthesis>;
  recognition: ReturnType<typeof useSpeechRecognition>;
  audioRecorder: ReturnType<typeof useAudioRecorder>;
  analysisStage: AnalysisStage;
  timer: number;
  isPaused: boolean;
  activeFollowUpText: string | null;
  isQuestionTextVisible: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stopRecordingForReview: () => void;
  handleManualSubmit: (textAnswer?: string) => void;
  interruptAndContinue: () => void;
}

/* ─── Helpers ───────────────────────────────────────────── */
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* Maximum listen time per question */
const MAX_LISTEN_SEC = 120;

/* ─── Hook ──────────────────────────────────────────────── */
export function useConversationEngine(
  config: ConversationEngineConfig
): ConversationEngineReturn {
  const {
    userName,
    interviewType,
    language = "english",
    questions,
    onSubmitAnswer,
    onComplete,
    onGenerateFeedback,
  } = config;

  const [phase, setPhase] = useState<ConversationPhase>("idle");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [timer, setTimer] = useState(0);
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>({
    label: "",
    progress: 0,
  });
  const [activeFollowUpText, setActiveFollowUpText] = useState<string | null>(null);
  const [isQuestionTextVisible, setIsQuestionTextVisible] = useState(false);

  // Map our language names to Web Speech API locale codes
  const getLanguageCode = (lang: string) => {
    switch (lang.toLowerCase()) {
      case "somali": return "so-SO";
      default: return "en-US";
    }
  };

  const languageCode = getLanguageCode(language);
  const tts = useSpeechSynthesis(languageCode);
  const recognition = useSpeechRecognition(languageCode);
  const audioRecorder = useAudioRecorder();

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const listenStartRef = useRef(0);
  const questionTimerRef = useRef(0);
  const answeredRef = useRef<Set<string>>(new Set());
  const hasSpokenRef = useRef(false);
  const abortRef = useRef(false);

  /* ── Pause / Resume ────────────────────────────────────── */
  const pause = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    setIsPaused(true);
    tts.pause();
    if (language.toLowerCase() !== "somali") {
      try { recognition.stopListening(); } catch {}
    } else {
      audioRecorder.pauseRecording();
    }
  }, [tts, recognition, audioRecorder.pauseRecording, language]);

  const resume = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    setIsPaused(false);
    tts.resume();
    if (phaseRef.current === "listening" && language.toLowerCase() !== "somali") {
      recognition.startListening();
    } else if (phaseRef.current === "listening") {
      audioRecorder.resumeRecording();
    }
  }, [tts, recognition, audioRecorder.resumeRecording, language]);

  /* ── Speak and wait until done ─────────────────────────── */
  const speakAndWait = useCallback(
    async (text: string, onPlay?: () => void) => {
      await tts.speak(text, onPlay);
      await delay(400);
    },
    [tts]
  );

  /* ── Session timer ─────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "idle" && phase !== "done" && phase !== "analyzing" && !isPaused) {
      timerRef.current = setInterval(() => setTimer((p) => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, isPaused]);

  /* ── Auto-submit removed, only max time guard remains ──── */
  useEffect(() => {
    if (phase !== "listening") return;
    if (isPaused) return;
    if (!recognition.isListening) return;

    const fullText = (recognition.finalTranscript + " " + recognition.interimTranscript).trim();

    // Max time guard
    const elapsed = (Date.now() - listenStartRef.current) / 1000;
    if (elapsed > MAX_LISTEN_SEC && fullText.length > 0) {
      stopRecordingForReview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phase,
    recognition.finalTranscript,
    recognition.interimTranscript,
    recognition.isListening,
  ]);

  /* ── Stop recording for review ─────────────────────────── */
  const stopRecordingForReview = useCallback(() => {
    if (phaseRef.current === "listening") {
      if (language.toLowerCase() !== "somali") {
        recognition.stopListening();
      } else {
        audioRecorder.stopRecording();
      }
      setPhase("reviewing");
    }
  }, [recognition, audioRecorder.stopRecording, language]);

  /* ── Handle manual submit ────────────────────────────────── */
  const handleManualSubmit = useCallback(
    async (textAnswer?: string) => {
      if (phaseRef.current !== "listening" && phaseRef.current !== "reviewing") return;
      setPhase("processing");
      if (language.toLowerCase() !== "somali") {
        recognition.stopListening();
      }

      const isSomali = language.toLowerCase() === "somali";
      let audioAnswer: Blob | null = null;
      if (isSomali) {
        audioAnswer = audioRecorder.isRecording
          ? await audioRecorder.stopRecordingAsync()
          : audioRecorder.audioBlob;
      }
      
      const transcript = textAnswer !== undefined
        ? (textAnswer.trim() || "[No answer provided]")
        : isSomali
          ? ""
          : ((recognition.finalTranscript + " " + recognition.interimTranscript).trim() || "[No audio detected. The candidate submitted without speaking.]");

      const question = questions[currentQuestionIndex];
      if (!question) return;

      const timeSpent = Math.round(
        (Date.now() - listenStartRef.current) / 1000
      );

      try {
        const result = await onSubmitAnswer(
          question._id,
          transcript,
          timeSpent,
          audioAnswer || undefined
        );

        // Time is up — wrap up the interview
        if (result.isTimeUp) {
          answeredRef.current.add(question._id);
          setAnsweredCount(answeredRef.current.size);
          await speakAndWait("We are out of time. Thank you for completing this interview. We will now prepare your report.");
          await wrapUp();
          return;
        }

        // Follow-up — speak the follow-up and re-listen on the SAME question
        if (result.isFollowUp && result.followUpText) {
          setPhase("follow-up");
          setActiveFollowUpText(result.followUpText);
          setIsQuestionTextVisible(false);
          await delay(500);
          if (abortRef.current) return;
          await speakAndWait(result.followUpText, () => setIsQuestionTextVisible(true));
          if (abortRef.current) return;

          // Re-listen for the follow-up answer (same question index)
          setPhase("listening");
          hasSpokenRef.current = false;
          listenStartRef.current = Date.now();
          recognition.resetTranscript();
          if (language.toLowerCase() !== "somali") {
            recognition.startListening();
          } else {
            audioRecorder.resetRecording();
            await audioRecorder.startRecording();
          }
          return;
        }

        // Topic complete — mark answered and advance to the next pre-generated question
        answeredRef.current.add(question._id);
        setAnsweredCount(answeredRef.current.size);

        const nextIdx = currentQuestionIndex + 1;
        if (nextIdx < questions.length) {
          setPhase("transitioning");
          await delay(600);
          setCurrentQuestionIndex(nextIdx);
          await askQuestion(nextIdx);
        } else {
          await wrapUp();
        }
      } catch {
        // Silently move on — answer was already recorded server-side
        answeredRef.current.add(question._id);
        setAnsweredCount(answeredRef.current.size);
        const nextIdx = currentQuestionIndex + 1;
        if (nextIdx < questions.length) {
          setCurrentQuestionIndex(nextIdx);
          await askQuestion(nextIdx);
        } else {
          await wrapUp();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      currentQuestionIndex,
      questions,
      language,
      audioRecorder.isRecording,
      audioRecorder.audioBlob,
      audioRecorder.stopRecordingAsync,
      audioRecorder.resetRecording,
      audioRecorder.startRecording,
    ]
  );

  /* ── Ask a question ────────────────────────────────────── */
  const askQuestion = useCallback(
    async (idx: number) => {
      if (abortRef.current) return;
      const q = questions[idx];
      if (!q) return;

      setPhase("asking");
      setActiveFollowUpText(null);
      setIsQuestionTextVisible(false);

      // Ask the actual question directly — no hardcoded transition phrases
      await delay(500);
      if (abortRef.current) return;

      await speakAndWait(q.text, () => setIsQuestionTextVisible(true));
      if (abortRef.current) return;

      // Start listening automatically
      setPhase("listening");
      hasSpokenRef.current = false;
      listenStartRef.current = Date.now();
      questionTimerRef.current = 0;
      recognition.resetTranscript();
      if (language.toLowerCase() !== "somali") {
        recognition.startListening();
      } else {
        audioRecorder.resetRecording();
        await audioRecorder.startRecording();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, speakAndWait, language, audioRecorder.resetRecording, audioRecorder.startRecording]
  );

  /* ── Wrap up ───────────────────────────────────────────── */
  const wrapUp = useCallback(async () => {
    setPhase("wrapping-up");

    // No hardcoded farewell — move directly to analysis
    await delay(500);

    // Analysis phase
    setPhase("analyzing");
    const stages = [
      { label: "Completing interview...", progress: 15 },
      { label: "Analyzing responses...", progress: 35 },
      { label: "Evaluating communication...", progress: 55 },
      { label: "Generating detailed report...", progress: 75 },
      { label: "Finalizing results...", progress: 95 },
    ];

    try {
      setAnalysisStage(stages[0]);
      await onComplete();

      setAnalysisStage(stages[1]);
      await delay(800);
      setAnalysisStage(stages[2]);
      await delay(600);
      setAnalysisStage(stages[3]);
      await onGenerateFeedback();
      setAnalysisStage(stages[4]);
      await delay(500);
      setAnalysisStage({ label: "Report ready!", progress: 100 });
      await delay(800);
    } catch {
      setAnalysisStage({ label: "Report ready!", progress: 100 });
      await delay(500);
    }

    setPhase("done");
  }, [onComplete, onGenerateFeedback]);

  /* ── Greeting + Start ──────────────────────────────────── */
  const start = useCallback(async () => {
    abortRef.current = false;
    setCurrentQuestionIndex(0);
    setAnsweredCount(0);
    answeredRef.current.clear();
    setTimer(0);
    setIsQuestionTextVisible(false);

    // No hardcoded greeting — the AI's intro-category question handles it
    setPhase("greeting");
    await delay(400);
    if (abortRef.current) return;

    await askQuestion(0);
  }, [askQuestion]);

  /* ── Manual interrupt (skip / continue) ────────────────── */
  const interruptAndContinue = useCallback(() => {
    tts.cancel();
    if (language.toLowerCase() !== "somali") {
      recognition.stopListening();
    } else {
      audioRecorder.stopRecording();
    }

    if (phase === "listening" || phase === "reviewing") {
      handleManualSubmit();
    }
  }, [
    phase,
    tts,
    recognition,
    audioRecorder.stopRecording,
    currentQuestionIndex,
    questions.length,
    handleManualSubmit,
    stopRecordingForReview,
    askQuestion,
    wrapUp,
    language,
  ]);

  /* ── Cleanup on unmount ────────────────────────────────── */
  useEffect(() => {
    return () => {
      abortRef.current = true;
      tts.cancel();
      recognition.stopListening();
      audioRecorder.resetRecording();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    phase,
    currentQuestionIndex,
    totalQuestions: questions.length,
    answeredCount,
    tts,
    recognition,
    audioRecorder,
    analysisStage,
    timer,
    isPaused,
    activeFollowUpText,
    isQuestionTextVisible,
    start,
    pause,
    resume,
    stopRecordingForReview,
    handleManualSubmit,
    interruptAndContinue,
  };
}
