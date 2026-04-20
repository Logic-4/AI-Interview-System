"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

import { useState, useRef, useCallback, useEffect } from "react";

/* ─── Types ─────────────────────────────────────────────── */
export interface SpeechRecognitionState {
  /** Whether the recogniser is actively listening */
  isListening: boolean;
  /** Live interim transcript (updates as user speaks) */
  interimTranscript: string;
  /** Final committed transcript so far */
  finalTranscript: string;
  /** Whether the user is currently speaking (sound detected) */
  isSpeaking: boolean;
  /** Current input volume 0-1 */
  volume: number;
  /** Seconds of silence since user last spoke */
  silenceDuration: number;
  /** Error message, if any */
  error: string | null;
  /** Whether the browser supports speech recognition */
  supported: boolean;
}

export interface SpeechRecognitionActions {
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export type UseSpeechRecognitionReturn = SpeechRecognitionState &
  SpeechRecognitionActions;

/* Volume threshold below which we consider silence */
const SILENCE_VOLUME_THRESHOLD = 0.02;
/* How often we check the analyser for volume (ms) */
const VOLUME_POLL_MS = 100;

/* ─── Hook ──────────────────────────────────────────────── */
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const lastSpeechTimeRef = useRef(Date.now());
  const stoppedRef = useRef(false);
  const finalRef = useRef("");

  const supported =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);

  /* ── Cleanup helpers ─────────────────────────────────── */
  const cleanupAudio = useCallback(() => {
    if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
    if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  /* ── Start ───────────────────────────────────────────── */
  const startListening = useCallback(async () => {
    if (!supported) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    setError(null);
    stoppedRef.current = false;

    try {
      // Mic stream for volume analysis
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Poll volume
      const dataArr = new Uint8Array(analyser.frequencyBinCount);
      volumeIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArr);
        let sum = 0;
        for (let i = 0; i < dataArr.length; i++) {
          const v = (dataArr[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArr.length);
        setVolume(rms);

        if (rms > SILENCE_VOLUME_THRESHOLD) {
          setIsSpeaking(true);
          lastSpeechTimeRef.current = Date.now();
        } else {
          setIsSpeaking(false);
        }
      }, VOLUME_POLL_MS);

      // Track silence duration
      lastSpeechTimeRef.current = Date.now();
      silenceIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - lastSpeechTimeRef.current) / 1000;
        setSilenceDuration(elapsed);
      }, 250);

      // Speech Recognition API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: { resultIndex: number; results: SpeechRecognitionResultList }) => {
        let interim = "";
        let final = finalRef.current;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += (final ? " " : "") + transcript.trim();
          } else {
            interim += transcript;
          }
        }

        finalRef.current = final;
        setFinalTranscript(final);
        setInterimTranscript(interim);
        lastSpeechTimeRef.current = Date.now();
      };

      recognition.onerror = (event: { error: string }) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
        setError(`Speech recognition error: ${event.error}`);
      };

      recognition.onend = () => {
        // Auto-restart if not manually stopped (continuous mode workaround)
        if (!stoppedRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {
            // Already running
          }
        } else {
          setIsListening(false);
        }
      };

      recognition.start();
      setIsListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  /* ── Stop ────────────────────────────────────────────── */
  const stopListening = useCallback(() => {
    stoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
      recognitionRef.current = null;
    }
    cleanupAudio();
    setIsListening(false);
    setIsSpeaking(false);
    setVolume(0);
    setSilenceDuration(0);
  }, [cleanupAudio]);

  /* ── Reset ───────────────────────────────────────────── */
  const resetTranscript = useCallback(() => {
    finalRef.current = "";
    setFinalTranscript("");
    setInterimTranscript("");
    setSilenceDuration(0);
  }, []);

  /* ── Cleanup on unmount ──────────────────────────────── */
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* noop */ }
      }
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return {
    isListening,
    interimTranscript,
    finalTranscript,
    isSpeaking,
    volume,
    silenceDuration,
    error,
    supported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
