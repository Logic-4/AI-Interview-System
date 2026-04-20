"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSpeechSynthesis } from "./useSpeechSynthesis";
import { useSpeechRecognition } from "./useSpeechRecognition";
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
  questions: Question[];
  onSubmitAnswer: (questionId: string, answer: string, timeSpent: number) => Promise<{
    score: number;
    feedback: string;
    strengths?: string[];
    improvements?: string[];
  }>;
  onComplete: () => Promise<void>;
  onGenerateFeedback: () => Promise<void>;
}

export interface ConversationEngineReturn {
  phase: ConversationPhase;
  messages: ChatMessage[];
  currentQuestionIndex: number;
  totalQuestions: number;
  answeredCount: number;
  tts: ReturnType<typeof useSpeechSynthesis>;
  recognition: ReturnType<typeof useSpeechRecognition>;
  analysisStage: AnalysisStage;
  timer: number;
  start: () => void;
  interruptAndContinue: () => void;
}

/* ─── Helpers ───────────────────────────────────────────── */
let msgCounter = 0;
function makeMsg(
  role: ChatMessage["role"],
  text: string
): ChatMessage {
  return { id: `msg-${++msgCounter}`, role, text, timestamp: Date.now() };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* Silence threshold: if user is silent this long after speaking, auto-submit */
const AUTO_SUBMIT_SILENCE_SEC = 3.5;
/* If user never speaks for this long, gently prompt */
const GENTLE_PROMPT_SILENCE_SEC = 8;
/* Maximum listen time per question */
const MAX_LISTEN_SEC = 120;

/* ─── Natural reactions to score ────────────────────────── */
function getScoreReaction(score: number): string {
  if (score >= 85) {
    const opts = [
      "That was a really strong answer.",
      "Great response, well articulated.",
      "Impressive, you covered the key points very well.",
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }
  if (score >= 65) {
    const opts = [
      "Good answer. You touched on the main ideas there.",
      "Solid response. A couple of areas you could expand on, but overall good.",
      "That was decent. You showed understanding of the concept.",
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }
  if (score >= 40) {
    const opts = [
      "Thanks for that. There are some areas where you could go deeper.",
      "I see where you were going. Let me note that for the feedback.",
      "Okay, that gives me a sense of your thinking on this.",
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }
  const opts = [
    "Alright, noted. We'll cover that in the feedback.",
    "Thanks for trying. Let's move on to the next one.",
    "Okay, no worries. Let's continue.",
  ];
  return opts[Math.floor(Math.random() * opts.length)];
}

function getTransitionPhrase(index: number, total: number): string {
  if (index === total - 1) return "Alright, this is the last question.";
  if (index === 0) return "Let's start with the first question.";
  const opts = [
    "Let's move on.",
    "Next question.",
    "Here's the next one for you.",
    "Alright, moving forward.",
    "Okay, next up.",
  ];
  return opts[Math.floor(Math.random() * opts.length)];
}

/* ─── Hook ──────────────────────────────────────────────── */
export function useConversationEngine(
  config: ConversationEngineConfig
): ConversationEngineReturn {
  const {
    userName,
    interviewType,
    questions,
    onSubmitAnswer,
    onComplete,
    onGenerateFeedback,
  } = config;

  const [phase, setPhase] = useState<ConversationPhase>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [timer, setTimer] = useState(0);
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>({
    label: "",
    progress: 0,
  });

  const tts = useSpeechSynthesis();
  const recognition = useSpeechRecognition();

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const listenStartRef = useRef(0);
  const questionTimerRef = useRef(0);
  const answeredRef = useRef<Set<string>>(new Set());
  const hasSpokenRef = useRef(false);
  const promptedRef = useRef(false);
  const abortRef = useRef(false);

  /* ── Push message ──────────────────────────────────────── */
  const pushMsg = useCallback(
    (role: ChatMessage["role"], text: string) => {
      setMessages((prev) => [...prev, makeMsg(role, text)]);
    },
    []
  );

  /* ── Speak and wait until done ─────────────────────────── */
  const speakAndWait = useCallback(
    async (text: string) => {
      tts.speak(text);
      // Wait for speech to finish
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            clearInterval(check);
            resolve();
          }
        }, 150);
        // Safety timeout
        setTimeout(() => { clearInterval(check); resolve(); }, 30000);
      });
      // Small breathing pause
      await delay(400);
    },
    [tts]
  );

  /* ── Session timer ─────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "idle" && phase !== "done" && phase !== "analyzing") {
      timerRef.current = setInterval(() => setTimer((p) => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  /* ── Auto-submit when user stops speaking ──────────────── */
  useEffect(() => {
    if (phase !== "listening") return;
    if (!recognition.isListening) return;

    const fullText = (recognition.finalTranscript + " " + recognition.interimTranscript).trim();

    // User has spoken something and is now silent long enough → auto submit
    if (
      fullText.length > 0 &&
      hasSpokenRef.current &&
      recognition.silenceDuration >= AUTO_SUBMIT_SILENCE_SEC
    ) {
      // Trigger processing
      handleAutoSubmit(fullText);
      return;
    }

    // Track whether user has started speaking
    if (recognition.isSpeaking && fullText.length > 2) {
      hasSpokenRef.current = true;
      promptedRef.current = false;
    }

    // Gentle prompt if user hasn't said anything
    if (
      !hasSpokenRef.current &&
      recognition.silenceDuration >= GENTLE_PROMPT_SILENCE_SEC &&
      !promptedRef.current
    ) {
      promptedRef.current = true;
      const prompts = [
        "Take your time. Whenever you're ready.",
        "No rush, just speak naturally when you're ready.",
        "I'm listening, go ahead whenever you'd like.",
      ];
      const prompt = prompts[Math.floor(Math.random() * prompts.length)];
      pushMsg("interviewer", prompt);
      tts.speak(prompt);
    }

    // Max time guard
    const elapsed = (Date.now() - listenStartRef.current) / 1000;
    if (elapsed > MAX_LISTEN_SEC && fullText.length > 0) {
      handleAutoSubmit(fullText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phase,
    recognition.silenceDuration,
    recognition.finalTranscript,
    recognition.interimTranscript,
    recognition.isSpeaking,
    recognition.isListening,
  ]);

  /* ── Handle auto submit ────────────────────────────────── */
  const handleAutoSubmit = useCallback(
    async (transcript: string) => {
      if (phaseRef.current !== "listening") return;
      setPhase("processing");
      recognition.stopListening();

      const question = questions[currentQuestionIndex];
      if (!question) return;

      pushMsg("candidate", transcript);

      const timeSpent = Math.round(
        (Date.now() - listenStartRef.current) / 1000
      );

      try {
        const evaluation = await onSubmitAnswer(
          question._id,
          transcript,
          timeSpent
        );
        answeredRef.current.add(question._id);
        setAnsweredCount(answeredRef.current.size);

        // React naturally
        setPhase("reacting");
        const reaction = getScoreReaction(evaluation.score);
        pushMsg("interviewer", reaction);
        await speakAndWait(reaction);

        // Move to next question or wrap up
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
        pushMsg("system", "There was a technical issue. Let me note your answer and move on.");
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
    [currentQuestionIndex, questions]
  );

  /* ── Ask a question ────────────────────────────────────── */
  const askQuestion = useCallback(
    async (idx: number) => {
      if (abortRef.current) return;
      const q = questions[idx];
      if (!q) return;

      setPhase("asking");

      // Transition phrase
      const transition = getTransitionPhrase(idx, questions.length);
      pushMsg("interviewer", transition);
      await speakAndWait(transition);
      if (abortRef.current) return;

      // Small pause to simulate thinking
      await delay(500);
      if (abortRef.current) return;

      // Ask the actual question
      pushMsg("interviewer", q.text);
      await speakAndWait(q.text);
      if (abortRef.current) return;

      // Start listening automatically
      setPhase("listening");
      hasSpokenRef.current = false;
      promptedRef.current = false;
      listenStartRef.current = Date.now();
      questionTimerRef.current = 0;
      recognition.resetTranscript();
      recognition.startListening();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, speakAndWait, pushMsg]
  );

  /* ── Wrap up ───────────────────────────────────────────── */
  const wrapUp = useCallback(async () => {
    setPhase("wrapping-up");
    const farewell =
      `That's all the questions I had for you today. Thank you for your time, ${userName.split(" ")[0]}. ` +
      "I'll now analyze your responses and prepare a detailed report.";
    pushMsg("interviewer", farewell);
    await speakAndWait(farewell);

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
      // Complete the interview
      setAnalysisStage(stages[0]);
      await onComplete();

      // Generate feedback
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
  }, [userName, pushMsg, speakAndWait, onComplete, onGenerateFeedback]);

  /* ── Greeting + Start ──────────────────────────────────── */
  const start = useCallback(async () => {
    abortRef.current = false;
    msgCounter = 0;
    setMessages([]);
    setCurrentQuestionIndex(0);
    setAnsweredCount(0);
    answeredRef.current.clear();
    setTimer(0);

    setPhase("greeting");

    const firstName = userName.split(" ")[0] || "there";
    const greeting =
      `Hi ${firstName}, welcome! I'll be conducting your ${interviewType.replace("-", " ")} interview today. ` +
      `We have ${questions.length} questions lined up. ` +
      "Take your time and answer naturally. Let's get started.";

    pushMsg("interviewer", greeting);
    await speakAndWait(greeting);
    if (abortRef.current) return;

    await delay(600);
    if (abortRef.current) return;

    // Ask first question
    await askQuestion(0);
  }, [userName, interviewType, questions.length, pushMsg, speakAndWait, askQuestion]);

  /* ── Manual interrupt (skip / continue) ────────────────── */
  const interruptAndContinue = useCallback(() => {
    tts.cancel();
    recognition.stopListening();

    const fullText = (recognition.finalTranscript + " " + recognition.interimTranscript).trim();

    if (phase === "listening" && fullText.length > 0) {
      // Submit whatever we have
      handleAutoSubmit(fullText);
    } else if (phase === "listening") {
      // Skip question
      pushMsg("system", "Question skipped.");
      const nextIdx = currentQuestionIndex + 1;
      if (nextIdx < questions.length) {
        setCurrentQuestionIndex(nextIdx);
        askQuestion(nextIdx);
      } else {
        wrapUp();
      }
    }
  }, [
    phase,
    tts,
    recognition,
    currentQuestionIndex,
    questions.length,
    handleAutoSubmit,
    pushMsg,
    askQuestion,
    wrapUp,
  ]);

  /* ── Cleanup on unmount ────────────────────────────────── */
  useEffect(() => {
    return () => {
      abortRef.current = true;
      tts.cancel();
      recognition.stopListening();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    phase,
    messages,
    currentQuestionIndex,
    totalQuestions: questions.length,
    answeredCount,
    tts,
    recognition,
    analysisStage,
    timer,
    start,
    interruptAndContinue,
  };
}
