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
  | "asked"
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
  expectedQuestionCount?: number;
  onSubmitAnswer: (
    questionId: string,
    answer: string,
    timeSpent: number,
    extras?: { audio?: Blob | File; activePromptText?: string }
  ) => Promise<{
    score: number | null;
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
  beginListening: () => Promise<void>;
}

/* ─── Helpers ───────────────────────────────────────────── */
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ponytail: same reasoning as the recorder.stop() 15s cap below — completeInterview
// and generateFeedback each have a 30s axios timeout, but that alone wasn't
// enough to stop the analysis screen from hanging forever in the field. Cap
// them explicitly so wrapUp() always reaches "done" and navigates away.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([promise, delay(ms)]);
}

/* Maximum listen time per question */
const MAX_LISTEN_SEC = 120;
// How long a candidate can go silent mid-answer before we assume they're
// done and auto-stop for review. 2.5s was cutting people off mid-thought —
// a normal "let me think about that..." pause on a technical question is
// longer than that, and a truncated answer then gets scored as if it were
// complete. ponytail: single global threshold, not adaptive to speech
// cadence — raise further (or make per-question) if candidates still get
// cut off while actively formulating an answer.
const SILENCE_AUTO_REVIEW_SEC = 5;

/* ─── Hook ──────────────────────────────────────────────── */
/**
 * Compose a warm, language-aware opening line for the interviewer to speak
 * before the first question — greets the candidate by name and sets the
 * expectation that this is a conversation, not a quiz.
 */
function buildWelcomeMessage(
  userName: string,
  interviewTitle: string,
  language: string
): string {
  const isSomali = isSomaliLanguage(language);
  const displayName = userName?.split(" ")[0] || (isSomali ? "musharrax" : "there");
  const roleLabel = interviewTitle?.trim() || (isSomali ? "shaqada aad codsatay" : "your role");
  if (isSomali) {
    return `Salaan, ${displayName}. Ku soo dhawoow wareysigaaga AI ee ${roleLabel}. Waxaan ku waydiin doonaa dhowr su'aalood si aan si fiican kuu fahamno. Si dabiici ah u hadal — waxaad heli doontaa waqti aad ku fikirto ka hor su'aal kasta. Aan bilowno.`;
  }
  return `Hi ${displayName}, welcome to your AI interview for ${roleLabel}. I'll ask you a few questions so we can get to know you better. Speak naturally — you'll have time to think before each question. Let's begin.`;
}

/** Language-aware farewell said before the analysis screen appears. */
function buildFarewellMessage(userName: string, language: string): string {
  const isSomali = isSomaliLanguage(language);
  const displayName = userName?.split(" ")[0] || "";
  if (isSomali) {
    return displayName
      ? `Mahadsanid, ${displayName}. Taasi waa dhamaadka wareysiga. Waxaan hadda diyaarinaynaa warbixintaada.`
      : `Mahadsanid. Taasi waa dhamaadka wareysiga. Waxaan hadda diyaarinaynaa warbixintaada.`;
  }
  return displayName
    ? `Thank you, ${displayName}. That's the end of the interview. I'll prepare your report now.`
    : `Thank you. That's the end of the interview. I'll prepare your report now.`;
}

export function useConversationEngine(
  config: ConversationEngineConfig
): ConversationEngineReturn {
  const {
    userName,
    interviewTitle,
    interviewType,
    language = "english",
    questions,
    expectedQuestionCount = questions.length,
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
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const expectedQuestionCountRef = useRef(expectedQuestionCount);
  expectedQuestionCountRef.current = expectedQuestionCount;

  const languageRef = useRef(language);
  languageRef.current = language;

  const languageCode = speechLanguageCode(language);
  const tts = useSpeechSynthesis(languageCode);
  // Browser Web Speech API is used ONLY for English — it provides both live
  // interim text for the UI and the primary submit-time transcript. On
  // unsupported browsers or empty transcripts, submit falls back to the
  // backend STT path (Gemini). Somali always uses the audio-upload path
  // since the browser has no Somali recognition model.
  const recognitionEnabled = !isSomaliLanguage(language);
  const recognition = useSpeechRecognition(languageCode, recognitionEnabled);
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
  // Guards against a candidate double-clicking "Submit Answer" or the space
  // watchdog racing with a manual click — a duplicate submission would
  // upload the same audio twice and could re-score the topic.
  const isSubmittingRef = useRef(false);

  /* ── Pause / Resume ────────────────────────────────────── */
  const pause = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    setIsPaused(true);
    tts.pause();
    if (phaseRef.current === "listening") {
      audioRecorder.pauseRecording();
      if (recognitionEnabled) {
        try { recognition.stopListening(); } catch { /* ignore */ }
      }
    }
  }, [tts, audioRecorder.pauseRecording, recognition, recognitionEnabled]);

  const resume = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    setIsPaused(false);
    tts.resume();
    if (phaseRef.current === "listening") {
      audioRecorder.resumeRecording();
      if (recognitionEnabled) recognition.startListening();
    }
  }, [tts, audioRecorder.resumeRecording, recognition, recognitionEnabled]);

  /* ── Speak and wait until done ─────────────────────────── */
  const speakAndWait = useCallback(
    async (text: string, onPlay?: () => void) => {
      try {
        await tts.speak(text, onPlay);
      } catch {
        // TTS failure is surfaced by useSpeechSynthesis. Do not break the
        // conversation flow — proceed to the next step.
      }
      await delay(150);
    },
    [tts]
  );

  /* ── Session timer ─────────────────────────────────────── */
  // Timer only runs during active interaction phases — NOT during
  // processing/reacting/transitioning (AI is working) or analysis/done.
  const TIMER_ACTIVE_PHASES: ConversationPhase[] = ["greeting", "asking", "asked", "listening", "reviewing", "wrapping-up"];
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
      audioRecorder.stopRecording();
      if (recognitionEnabled) {
        try { recognition.stopListening(); } catch { /* ignore */ }
      }
      setPhase("reviewing");
    }
  }, [audioRecorder.stopRecording, recognition, recognitionEnabled]);

  /* ── Listen watchdog: silence auto-review, max listen time ──────────
     Single unified path for both English and Somali: mic volume from the
     MediaRecorder analyser is the only signal we watch. Browser Web Speech
     API is no longer used — transcription always goes through the backend
     (Gemini, for both English and Somali) at submit time. */
  useEffect(() => {
    if (phase !== "listening" || isPaused) {
      if (listenIntervalRef.current) clearInterval(listenIntervalRef.current);
      return;
    }

    listenIntervalRef.current = setInterval(() => {
      if (phaseRef.current !== "listening" || isPausedRef.current) return;

      if (audioRecorder.getVolume() > 0.02) {
        hasSpokenRef.current = true;
      }

      if (
        hasSpokenRef.current &&
        audioRecorder.getSilenceDuration() >= SILENCE_AUTO_REVIEW_SEC
      ) {
        stopRecordingForReview();
        return;
      }

      const elapsed = (Date.now() - listenStartRef.current) / 1000;
      if (elapsed > MAX_LISTEN_SEC && hasSpokenRef.current) {
        stopRecordingForReview();
      }
    }, 400);

    return () => {
      if (listenIntervalRef.current) clearInterval(listenIntervalRef.current);
    };
  }, [phase, isPaused, stopRecordingForReview, audioRecorder]);

  const beginListening = useCallback(async () => {
    setPhase("listening");
    hasSpokenRef.current = false;
    listenStartRef.current = Date.now();
    questionTimerRef.current = 0;

    try {
      await audioRecorder.resetRecording();
      await audioRecorder.startRecording();
    } catch {
      toast.error("Microphone access failed. Allow the mic in your browser and try again.");
      setPhase("reviewing");
      return;
    }

    if (recognitionEnabled) {
      recognition.resetTranscript();
      recognition.startListening();
    }
  }, [audioRecorder, recognition, recognitionEnabled]);

  /* ── Handle manual submit ────────────────────────────────── */
  const handleManualSubmit = useCallback(
    async (textAnswer?: string) => {
      if (phaseRef.current !== "listening" && phaseRef.current !== "reviewing") return;
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setPhase("processing");

      try {
      const audioAnswer = await audioRecorder.finalizeRecording();
      if (recognitionEnabled) {
        try { recognition.stopListening(); } catch { /* ignore */ }
      }

      // ── Determine transcript ─────────────────────────────────────────────
      // Priority order:
      //   1) An explicit textAnswer override (e.g. review-mode edit).
      //   2) English: browser Web Speech API transcript (primary, live).
      //   3) Backend STT: Gemini (fallback when the browser is unsupported
      //      or returned nothing for English; always for Somali).
      let transcript: string;
      let sttErrorMessage: string | null = null;
      if (textAnswer !== undefined) {
        transcript = textAnswer.trim();
      } else {
        const browserTranscript = recognitionEnabled
          ? recognition.getTranscript().trim()
          : "";

        if (browserTranscript) {
          transcript = browserTranscript;
          console.log(`[STT] Using browser transcript (${transcript.length} chars): "${transcript.slice(0, 80)}"`);
        } else if (!audioAnswer || audioAnswer.size < 500) {
          toast.error(
            audioAnswer
              ? "Recording too short. Speak for at least 2 seconds, then submit."
              : "No audio captured. Check your microphone and try again."
          );
          await beginListening();
          return;
        } else {
          // Browser transcript unavailable — fall back to backend STT.
          try {
            console.log(`[STT] Sending ${(audioAnswer.size / 1024).toFixed(1)} KB to backend ASR…`);
            transcript = await transcribeWithSTT(audioAnswer, 'answer.webm', languageCode);
            if (!transcript.trim()) {
              transcript = "[No speech detected]";
            }
            console.log(`[STT] Backend transcript received: "${transcript.slice(0, 80)}"`);
          } catch (sttError) {
            console.warn("[STT] Backend transcription failed:", sttError);
            sttErrorMessage =
              sttError instanceof Error ? sttError.message : "Speech recognition service unavailable";
            transcript = "";
          }
        }
      }

      if (!transcript.trim() || isPlaceholderTranscript(transcript)) {
        // If we captured audio, submit anyway — the backend keeps the recording
        // and can transcribe with its fallback path. Only bounce the candidate
        // back to listening when there is truly nothing recorded.
        if (audioAnswer && audioAnswer.size > 500) {
          if (sttErrorMessage) {
            toast("Speech-to-text is slow. Submitting your recorded answer for review.", { icon: "⚠️" });
          }
          transcript = "";
        } else {
          if (sttErrorMessage) {
            const normalizedError = sttErrorMessage.toLowerCase();
            const message = normalizedError.includes("503")
              ? `Speech recognition did not respond in time and may still be warming (${sttErrorMessage.slice(0, 100)}). Please retry.`
              : normalizedError.includes("fetch")
                ? `Could not reach speech recognition: ${sttErrorMessage.slice(0, 120)}`
                : `Could not transcribe your answer: ${sttErrorMessage.slice(0, 120)}`;
            toast.error(message);
          } else if (transcript.includes("[No speech detected]")) {
            toast.error("We heard audio but could not detect speech. Speak louder and try again.");
          } else {
            toast.error("We didn't capture your answer. Please speak clearly and try again.");
          }
          await beginListening();
          return;
        }
      }

      // Use ref to always get the current question index (avoids stale closure)
      const idx = currentQuestionIndexRef.current;
      const question = questionsRef.current[idx];
      if (!question) return;

      const timeSpent = Math.round(
        (Date.now() - listenStartRef.current) / 1000
      );

      try {
        // When STT already produced the transcript, skip re-uploading audio
        const submitArgs = [
          question._id,
          transcript,
          timeSpent,
          {
            audio: audioAnswer || undefined,
            activePromptText: activePromptRef.current || question.text,
          },
        ] as const;

        let result;
        try {
          result = await onSubmitAnswer(...submitArgs);
        } catch (firstError) {
          // A slow-but-successful evaluation can still outrun the request
          // timeout — retry once before falling back to the outer catch's
          // "toast + re-record" path, which would otherwise discard the
          // answer the candidate already gave.
          console.warn("[ConversationEngine] Submit failed, retrying once:", firstError);
          result = await onSubmitAnswer(...submitArgs);
        }

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
          // Hide until voice actually begins to keep text + audio in sync.
          setIsQuestionTextVisible(false);
          await delay(50);
          if (abortRef.current) return;
          try {
            await tts.speak(result.followUpText, () => {
              setIsQuestionTextVisible(true);
            });
          } catch {
            setIsQuestionTextVisible(true);
          }
          await delay(150);
          if (abortRef.current) return;

          setPhase("asked");
          return;
        }

        // Candidate asked a question and the topic was otherwise complete —
        // the model's answer still needs to be spoken before we move on,
        // instead of silently discarding it and jumping to the next question.
        if (result.answeredCandidateQuestion && result.followUpText) {
          setIsQuestionTextVisible(false);
          await delay(50);
          if (abortRef.current) return;
          try {
            await tts.speak(result.followUpText, () => {
              setIsQuestionTextVisible(true);
            });
          } catch {
            setIsQuestionTextVisible(true);
          }
          await delay(150);
          if (abortRef.current) return;
        }

        // Topic complete — mark answered and advance to the next pre-generated question
        answeredRef.current.add(question._id);
        setAnsweredCount(answeredRef.current.size);

        const nextIdx = currentQuestionIndexRef.current + 1;
        if (nextIdx < expectedQuestionCountRef.current) {
          setPhase("transitioning");
          const waitStartedAt = Date.now();
          while (!questionsRef.current[nextIdx] && Date.now() - waitStartedAt < 20000 && !abortRef.current) {
            await delay(250);
          }
          if (!questionsRef.current[nextIdx]) {
            toast.error("The next question is still unavailable. Your completed answers were saved.");
            await wrapUp();
            return;
          }
          await delay(150);
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
      } finally {
        // Always release the guard, whether we returned early (bad audio,
        // no question, follow-up handoff) or completed the whole submit.
        isSubmittingRef.current = false;
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
      const q = questionsRef.current[idx];
      if (!q) return;

      setPhase("asking");
      setActiveFollowUpText(null);
      setIsQuestionTextVisible(true);

      await delay(50);
      if (abortRef.current) return;

      activePromptRef.current = q.text;

      // Warm the next question's TTS now, while the candidate is about to
      // spend tens of seconds listening/answering this one — by the time
      // askQuestion(idx + 1) runs, its audio is likely already cached.
      const nextQuestion = questionsRef.current[idx + 1];
      if (nextQuestion?.text) {
        tts.prefetch(nextQuestion.text);
      }

      try {
        await tts.speak(q.text);
      } catch {
        // TTS failed — question text is already visible; proceed to listening.
      }
      await delay(150);
      if (abortRef.current) return;

      setPhase("asked");
    },
    [tts]
  );

  /* ── Wrap up ───────────────────────────────────────────── */
  const wrapUp = useCallback(async () => {
    setPhase("wrapping-up");

    // Speak a farewell so the session doesn't just cut to the analysis screen.
    // Wrapped in try/catch — a TTS outage at the very end must not block the
    // report from being generated.
    const farewell = buildFarewellMessage(userName, languageRef.current);
    activePromptRef.current = farewell;
    try {
      await tts.speak(farewell);
    } catch {
      // Ignore — proceed to analysis.
    }
    await delay(400);

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
      await withTimeout(onComplete(), 20000);

      setAnalysisStage(stages[1]);
      await delay(800);
      setAnalysisStage(stages[2]);
      await delay(600);
      setAnalysisStage(stages[3]);
      await withTimeout(onGenerateFeedback(), 20000);
      setAnalysisStage(stages[4]);
      await delay(500);
      setAnalysisStage({ label: "Report ready!", progress: 100 });
      await delay(800);
    } catch {
      setAnalysisStage({ label: "Report ready!", progress: 100 });
      await delay(500);
    }

    setPhase("done");
  }, [onComplete, onGenerateFeedback, tts, userName]);

  /* ── Greeting + Start ──────────────────────────────────── */
  const start = useCallback(async (opts?: { language?: string }) => {
    const sessionLanguage = opts?.language ?? languageRef.current;

    abortRef.current = false;
    setCurrentQuestionIndex(0);
    setAnsweredCount(0);
    answeredRef.current.clear();
    setTimer(0);
    setIsQuestionTextVisible(false);

    setPhase("greeting");
    await delay(50);
    if (abortRef.current) return;

    // Speak a warm welcome before diving into the first question. The
    // question text stays hidden until the welcome finishes so the visible
    // question and the voice never desync.
    const welcome = buildWelcomeMessage(userName, interviewTitle, sessionLanguage);
    activePromptRef.current = welcome;
    // Warm question 0's TTS now, same as askQuestion does for the *next*
    // question — otherwise the very first question pays the full synthesis
    // latency live, with no head start, unlike every question after it.
    const firstQuestion = questionsRef.current[0];
    if (firstQuestion?.text) {
      tts.prefetch(firstQuestion.text);
    }
    try {
      await tts.speak(welcome);
    } catch {
      // A TTS outage must not prevent the interview from starting.
    }
    if (abortRef.current) return;
    await delay(250);

    await askQuestion(0);
  }, [askQuestion, tts, userName, interviewTitle]);

  /* ── Manual interrupt (skip / continue) ────────────────── */
  const interruptAndContinue = useCallback(() => {
    tts.cancel();
    audioRecorder.stopRecording();
    if (recognitionEnabled) {
      try { recognition.stopListening(); } catch { /* ignore */ }
    }

    if (phase === "listening" || phase === "reviewing") {
      handleManualSubmit();
    }
  }, [
    phase,
    tts,
    audioRecorder.stopRecording,
    recognition,
    recognitionEnabled,
    handleManualSubmit,
  ]);

  /* ── Cleanup on unmount ────────────────────────────────── */
  useEffect(() => {
    return () => {
      abortRef.current = true;
      tts.cancel();
      try { recognition.stopListening(); } catch { /* ignore */ }
      audioRecorder.resetRecording().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
    };
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
    beginListening,
  };
}
