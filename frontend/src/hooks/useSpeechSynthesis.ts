"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { getApiBaseUrl } from "../lib/apiConfig";
import { isSomaliLanguage } from "../lib/interviewHelpers";

export interface WordHighlight {
  wordIndex: number;
  charIndex: number;
  charLength: number;
}

export interface UseSpeechSynthesisReturn {
  /** Speak the given text. Returns a Promise that resolves when audio finishes. */
  speak: (text: string, onPlay?: () => void) => Promise<void>;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  isFetchingTTS: boolean;
  highlight: WordHighlight | null;
  voiceName: string;
  ready: boolean;
}

export function useSpeechSynthesis(languageCode: string = "en-US"): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFetchingTTS, setIsFetchingTTS] = useState(false);
  const [highlight, setHighlight] = useState<WordHighlight | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const browserUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const playResolveRef = useRef<(() => void) | null>(null);
  const languageCodeRef = useRef(languageCode);
  languageCodeRef.current = languageCode;

  const isSomaliTts = isSomaliLanguage(languageCode);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio();
    audioRef.current = audio;

    audio.onplay = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    audio.onpause = () => {
      if (audio.currentTime < audio.duration) {
        setIsPaused(true);
      }
    };

    audio.onended = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      if (playResolveRef.current) {
        playResolveRef.current();
        playResolveRef.current = null;
      }
    };

    audio.onerror = () => {
      console.warn("[TTS] Audio playback error", audio.error);
      setIsSpeaking(false);
      setIsPaused(false);
      if (playResolveRef.current) {
        playResolveRef.current();
        playResolveRef.current = null;
      }
    };

    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  const speakWithBrowserFallback = useCallback(
    (text: string, onPlay?: () => void) =>
      new Promise<void>((resolve) => {
        if (typeof window === "undefined" || !window.speechSynthesis) {
          resolve();
          return;
        }

        let resolved = false;
        const safeResolve = () => {
          if (resolved) return;
          resolved = true;
          setIsSpeaking(false);
          setIsPaused(false);
          browserUtteranceRef.current = null;
          resolve();
        };

        // Safety timeout — some browsers silently fail to fire onend/onerror
        const fallbackTimer = setTimeout(safeResolve, 15000);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = languageCodeRef.current;
        utterance.onstart = () => {
          setIsSpeaking(true);
          setIsPaused(false);
        };
        utterance.onend = () => {
          clearTimeout(fallbackTimer);
          safeResolve();
        };
        utterance.onerror = () => {
          clearTimeout(fallbackTimer);
          safeResolve();
        };

        browserUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        if (onPlay) onPlay();
      }),
    []
  );

  const speak = useCallback(
    async (text: string, onPlay?: () => void): Promise<void> => {
      const audio = audioRef.current;
      if (!audio) return;

      const somaliMode = isSomaliLanguage(languageCodeRef.current);

      audio.pause();
      audio.currentTime = 0;
      window.speechSynthesis?.cancel();
      browserUtteranceRef.current = null;
      if (playResolveRef.current) {
        playResolveRef.current();
        playResolveRef.current = null;
      }

      setIsFetchingTTS(true);

      try {
        const apiBase = getApiBaseUrl();
        const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${apiBase}/tts`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            text,
            languageCode: languageCodeRef.current,
            language: somaliMode ? "somali" : "english",
          }),
          credentials: "include",
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`TTS API ${response.status}: ${errBody}`);
        }

        const audioBlob = await response.blob();
        if (!audioBlob.size) {
          throw new Error("TTS API returned an empty audio file.");
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        setIsFetchingTTS(false);
        setIsSpeaking(true);
        setIsPaused(false);
        if (onPlay) onPlay();

        audio.src = audioUrl;

        await new Promise<void>((resolve) => {
          playResolveRef.current = resolve;
          audio.play().catch((e) => {
            if (e.name !== "AbortError") {
              console.warn("[TTS] play() rejected:", e);
              setIsSpeaking(false);
              resolve();
            }
          });
        });
        URL.revokeObjectURL(audioUrl);
      } catch (error) {
        console.warn("[TTS] Backend synthesis failed:", error);
        setIsFetchingTTS(false);

        if (somaliMode) {
          toast.error(
            "Somali voice service is starting or unavailable. Wait 1–2 min after backend boot, or run: cd backend && npm run setup:somali-speech"
          );
          if (onPlay) onPlay();
          return;
        }

        if (onPlay) onPlay();
        await speakWithBrowserFallback(text);
      }
    },
    [speakWithBrowserFallback]
  );

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis?.cancel();
    browserUtteranceRef.current = null;
    if (playResolveRef.current) {
      playResolveRef.current();
      playResolveRef.current = null;
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setIsFetchingTTS(false);
    setHighlight(null);
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
    window.speechSynthesis?.pause();
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && audioRef.current.paused && audioRef.current.src && !audioRef.current.ended) {
      audioRef.current.play().catch((e) => {
        if (e.name !== "AbortError") console.error(e);
      });
    }
    window.speechSynthesis?.resume();
  }, []);

  return {
    speak,
    cancel,
    pause,
    resume,
    isSpeaking,
    isPaused,
    isFetchingTTS,
    highlight,
    voiceName: isSomaliTts ? "Somali TTS" : "Piper TTS",
    ready: true,
  };
}
