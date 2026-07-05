"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { useSpeechSynthesis } from "./useSpeechSynthesis";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useAudioRecorder } from "./useAudioRecorder";
import { transcribeAudio as transcribeWithSTT } from "../services/sttService";
import { isPlaceholderTranscript, isSomaliLanguage, speechLanguageCode } from "../lib/interviewHelpers";
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
  onSubmitAnswer: (
    questionId: string,
    answer: string,
    timeSpent: number,
    extras?: { audio?: Blob | File; activePromptText?: string }
  ) => Promise<{
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
    suggestedAnswer: string;
    isTimeUp?: boolean;
    isFollowUp?: boolean;
    followUpText?: string | null;
    answeredCandidateQuestion?: boolean;
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
  start: (opts?: { language?: string }) => void;
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
const SILENCE_AUTO_REVIEW_SEC = 2.5;
const MIN_TRANSCRIPT_CHARS = 6;

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

  // Mirror currentQuestionIndex to a ref so callbacks always see the latest value
  // without needing it in their dependency arrays (eliminates stale closure bugs).
  const currentQuestionIndexRef = useRef(0);
  currentQuestionIndexRef.current = currentQuestionIndex;

  const languageRef = useRef(language);
  languageRef.current = language;

  /** Locked when the session starts so speech mode cannot flip mid-interview. */
  const isSomaliSessionRef = useRef(isSomaliLanguage(language));
  const isSomaliSession = () => isSomaliSessionRef.current;

  const languageCode = speechLanguageCode(language);
  const tts = useSpeechSynthesis(languageCode);
  const recognition = useSpeechRecognition(languageCode, !isSomaliLanguage(language));
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
  const activePromptRef = useRef("");
  const abortRef = useRef(false);
  const listenIntervalRef = useRef<ReturnType<typeof setInterval>>();

  /* ── Pause / Resume ────────────────────────────────────── */
  const pause = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    setIsPaused(true);
    tts.pause();
    // Only pause audio/recording if actually in the listening phase
    if (phaseRef.current === "listening") {
      if (isSomaliSession()) {
        audioRecorder.pauseRecording();
      } else {
        try { recognition.stopListening(); } catch {}
      }
    }
  }, [tts, recognition, audioRecorder.pauseRecording, language]);

  const resume = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    setIsPaused(false);
    tts.resume();
    if (phaseRef.current === "listening" && !isSomaliSession()) {
      recognition.startListening();
    } else if (phaseRef.current === "listening") {
      audioRecorder.resumeRecording();
    }
  }, [tts, recognition, audioRecorder.resumeRecording]);

  /* ── Speak and wait until done ─────────────────────────── */
  const speakAndWait = useCallback(
    async (text: string, onPlay?: () => void) => {
      await tts.speak(text, onPlay);
      await delay(150);
    },
    [tts]
  );

  /* ── Session timer ─────────────────────────────────────── */
  // Timer only runs during active interaction phases — NOT during
  // processing/reacting/transitioning (AI is working) or analysis/done.
  const TIMER_ACTIVE_PHASES: ConversationPhase[] = ["greeting", "asking", "listening", "reviewing", "wrapping-up"];
  useEffect(() => {
    if (TIMER_ACTIVE_PHASES.includes(phase) && !isPaused) {
      timerRef.current = setInterval(() => setTimer((p) => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, isPaused]);

  /* ── Stop recording for review ─────────────────────────── */
  const stopRecordingForReview = useCallback(() => {
    if (phaseRef.current === "listening") {
      if (isSomaliSession()) {
        audioRecorder.stopRecording();
      } else {
        recognition.stopListening();
      }
      setPhase("reviewing");
    }
  }, [recognition, audioRecorder.stopRecording]);

  /* ── Listen watchdog: silence auto-review, max time, mic recovery ──── */
  useEffect(() => {
    if (phase !== "listening" || isPaused) {
      if (listenIntervalRef.current) clearInterval(listenIntervalRef.current);
      return;
    }

    const isSomali = isSomaliSession();

    listenIntervalRef.current = setInterval(() => {
      if (phaseRef.current !== "listening" || isPausedRef.current) return;

      if (!isSomali) {
        const transcript = recognition.getTranscript();
        if (transcript.length >= MIN_TRANSCRIPT_CHARS) {
          hasSpokenRef.current = true;
        }

        if (
          hasSpokenRef.current &&
          recognition.silenceDuration >= SILENCE_AUTO_REVIEW_SEC &&
          transcript.length >= MIN_TRANSCRIPT_CHARS
        ) {
          stopRecordingForReview();
          return;
        }

        if (!recognition.isListening && !recognition.error) {
          recognition.startListening();
        }
      } else {
        const vol = audioRecorder.getVolume();
        if (vol > 0.02) {
          hasSpokenRef.current = true;
        }

        if (
          hasSpokenRef.current &&
          audioRecorder.getSilenceDuration() >= SILENCE_AUTO_REVIEW_SEC
        ) {
          stopRecordingForReview();
          return;
        }
      }

      const elapsed = (Date.now() - listenStartRef.current) / 1000;
      if (elapsed > MAX_LISTEN_SEC && hasSpokenRef.current) {
        stopRecordingForReview();
      }
    }, 400);

    return () => {
      if (listenIntervalRef.current) clearInterval(listenIntervalRef.current);
    };
  }, [phase, isPaused, recognition, stopRecordingForReview, audioRecorder]);

  const beginListening = useCallback(async () => {
    setPhase("listening");
    hasSpokenRef.current = false;
    listenStartRef.current = Date.now();
    questionTimerRef.current = 0;

    if (!isSomaliSession()) {
      recognition.resetTranscript();
      recognition.startListening();
      return;
    }

    try {
      await audioRecorder.resetRecording();
      await audioRecorder.startRecording();
    } catch {
      toast.error("Microphone access failed. Allow the mic in your browser and try again.");
      setPhase("reviewing");
    }
  }, [recognition, audioRecorder]);

  /* ── Handle manual submit ────────────────────────────────── */
  const handleManualSubmit = useCallback(
    async (textAnswer?: string) => {
      if (phaseRef.current !== "listening" && phaseRef.current !== "reviewing") return;
      setPhase("processing");

      const isSomali = isSomaliSession();
      let audioAnswer: Blob | null = null;
      if (isSomali) {
        audioAnswer = await audioRecorder.finalizeRecording();
      } else {
        recognition.stopListening();
      }

      // ── Determine transcript ─────────────────────────────────────────────
      let transcript: string;
      let sttSucceeded = false;
      let sttErrorMessage: string | null = null;
      if (textAnswer !== undefined) {
        transcript = textAnswer.trim();
      } else if (isSomali) {
        if (!audioAnswer || audioAnswer.size < 500) {
          toast.error(
            audioAnswer
              ? "Recording too short. Speak for at least 2 seconds, then submit."
              : "No audio captured. Check your microphone and try again."
          );
          await beginListening();
          return;
        }
        try {
          console.log(`[STT] Sending ${(audioAnswer.size / 1024).toFixed(1)} KB to ASR…`);
          transcript = await transcribeWithSTT(audioAnswer, 'answer.webm');
          if (!transcript.trim()) {
            transcript = "[No speech detected]";
          } else {
            sttSucceeded = true;
          }
          console.log(`[STT] Transcript received: "${transcript.slice(0, 80)}"`);
        } catch (sttError) {
          console.warn("[STT] Transcription failed:", sttError);
          sttErrorMessage =
            sttError instanceof Error ? sttError.message : "Speech recognition service unavailable";
          transcript = "[Transcription unavailable — audio was recorded but could not be processed]";
        }
      } else {
        transcript = recognition.getTranscript();
      }

      if (!transcript.trim() || isPlaceholderTranscript(transcript)) {
        if (sttErrorMessage) {
          toast.error(
            sttErrorMessage.includes("503") || sttErrorMessage.includes("fetch")
              ? "Somali speech recognition is unavailable. Ensure the backend ASR service is running on port 8001."
              : `Could not transcribe your answer: ${sttErrorMessage.slice(0, 120)}`
          );
        } else if (transcript.includes("[No speech detected]")) {
          toast.error("We heard audio but could not detect speech. Speak louder and try again.");
        } else {
          toast.error("We didn't capture your answer. Please speak clearly and try again.");
        }
        await beginListening();
        return;
      }

      // Use ref to always get the current question index (avoids stale closure)
      const idx = currentQuestionIndexRef.current;
      const question = questions[idx];
      if (!question) return;

      const timeSpent = Math.round(
        (Date.now() - listenStartRef.current) / 1000
      );

      try {
        // When STT already produced the transcript, skip re-uploading audio
        const result = await onSubmitAnswer(
          question._id,
          transcript,
          timeSpent,
          {
            audio: isSomali && sttSucceeded ? undefined : (audioAnswer || undefined),
            activePromptText: activePromptRef.current || question.text,
          }
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
          activePromptRef.current = result.followUpText;
          setIsQuestionTextVisible(false);
          await delay(500);
          if (abortRef.current) return;
          await speakAndWait(result.followUpText, () => setIsQuestionTextVisible(true));
          if (abortRef.current) return;

          await beginListening();
          return;
        }

        // Topic complete — mark answered and advance to the next pre-generated question
        answeredRef.current.add(question._id);
        setAnsweredCount(answeredRef.current.size);

        const nextIdx = currentQuestionIndexRef.current + 1;
        if (nextIdx < questions.length) {
          setPhase("transitioning");
          await delay(600);
          setCurrentQuestionIndex(nextIdx);
          await askQuestion(nextIdx);
        } else {
          await wrapUp();
        }
      } catch (submitError) {
        console.error("[ConversationEngine] Answer submit failed:", submitError);
        const message = submitError instanceof Error
          ? submitError.message
          : "Failed to submit your answer. Please try again.";
        toast.error(message);
        await beginListening();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      currentQuestionIndex,
      questions,
      language,
      beginListening,
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

      await delay(500);
      if (abortRef.current) return;

      await speakAndWait(q.text, () => setIsQuestionTextVisible(true));
      if (abortRef.current) return;

      activePromptRef.current = q.text;
      await beginListening();
    },
    [questions, speakAndWait, beginListening]
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
  const start = useCallback(async (opts?: { language?: string }) => {
    const sessionLanguage = opts?.language ?? languageRef.current;
    isSomaliSessionRef.current = isSomaliLanguage(sessionLanguage);

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
    if (!isSomaliSession()) {
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

  useEffect(() => {
    if (phase === "idle") {
      isSomaliSessionRef.current = isSomaliLanguage(languageRef.current);
    }
  }, [language]);

  /* ── Cleanup on unmount ────────────────────────────────── */
  useEffect(() => {
    return () => {
      abortRef.current = true;
      tts.cancel();
      if (!isSomaliSessionRef.current) {
        recognition.stopListening();
      } else {
        audioRecorder.resetRecording().catch(() => {});
      }
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
