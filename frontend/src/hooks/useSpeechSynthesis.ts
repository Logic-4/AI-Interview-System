"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
  /* Stores the resolve callback for the currently-playing utterance */
  const playResolveRef = useRef<(() => void) | null>(null);

  // Create a single reusable Audio element on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio();
    audioRef.current = audio;

    audio.onplay = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    audio.onpause = () => {
      // Only mark paused if we haven't finished — onended fires after onpause in some browsers
      if (audio.currentTime < audio.duration) {
        setIsPaused(true);
      }
    };

    audio.onended = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      // Resolve the speakAndWait promise
      if (playResolveRef.current) {
        playResolveRef.current();
        playResolveRef.current = null;
      }
    };

    audio.onerror = () => {
      console.warn("[OpenTTS] Audio playback error", audio.error);
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

  /**
   * Fetch audio from the local TTS endpoint and play it.
   * The returned Promise resolves when the audio finishes playing (or on error).
   */
  const speak = useCallback(
    async (text: string, onPlay?: () => void): Promise<void> => {
      const audio = audioRef.current;
      if (!audio) return;

      // Cancel anything currently playing
      audio.pause();
      audio.currentTime = 0;
      window.speechSynthesis?.cancel();
      browserUtteranceRef.current = null;
      if (playResolveRef.current) {
        playResolveRef.current(); // resolve any previous pending promise
        playResolveRef.current = null;
      }

      // We are starting the fetch process, but not playing audio yet
      setIsFetchingTTS(true);

      const speakWithBrowserFallback = () =>
        new Promise<void>((resolve) => {
          if (typeof window === "undefined" || !window.speechSynthesis) {
            resolve();
            return;
          }

          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = languageCode;
          utterance.onstart = () => {
            setIsSpeaking(true);
            setIsPaused(false);
          };
          utterance.onend = () => {
            setIsSpeaking(false);
            setIsPaused(false);
            browserUtteranceRef.current = null;
            resolve();
          };
          utterance.onerror = () => {
            setIsSpeaking(false);
            setIsPaused(false);
            browserUtteranceRef.current = null;
            resolve();
          };

          browserUtteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
        });

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, languageCode }),
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

        // Fetch complete, ready to play
        setIsFetchingTTS(false);
        setIsSpeaking(true);
        setIsPaused(false);
        if (onPlay) onPlay();

        audio.src = audioUrl;

        // Wait for the audio to finish playing
        await new Promise<void>((resolve) => {
          playResolveRef.current = resolve;
          audio.play().catch((e) => {
            if (e.name === "AbortError") {
              // It was paused, do not resolve the promise! The audio will resume later.
              console.warn("[OpenTTS] play() was paused before it started.");
            } else {
              console.warn("[OpenTTS] play() rejected:", e);
              setIsSpeaking(false);
              resolve();
            }
          });
        });
        URL.revokeObjectURL(audioUrl);
      } catch (error) {
        console.warn("[OpenTTS] Falling back to browser speech:", error);
        setIsFetchingTTS(false);
        if (onPlay) onPlay();
        await speakWithBrowserFallback();
      }
    },
    [languageCode]
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
    voiceName: "OpenTTS",
    ready: true,
  };
}
