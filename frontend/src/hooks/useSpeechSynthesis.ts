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
      console.error("[Cloud TTS] Audio playback error");
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
   * Fetch audio from the Cloud TTS endpoint and play it.
   * The returned Promise resolves when the audio finishes playing (or on error).
   */
  const speak = useCallback(
    async (text: string, onPlay?: () => void): Promise<void> => {
      const audio = audioRef.current;
      if (!audio) return;

      // Cancel anything currently playing
      audio.pause();
      audio.currentTime = 0;
      if (playResolveRef.current) {
        playResolveRef.current(); // resolve any previous pending promise
        playResolveRef.current = null;
      }

      // We are starting the fetch process, but not playing audio yet
      setIsFetchingTTS(true);

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
            console.error("[Cloud TTS] play() rejected:", e);
            setIsSpeaking(false);
            resolve();
          });
        });
      } catch (error) {
        console.error("[Cloud TTS] Error:", error);
        setIsFetchingTTS(false);
        setIsSpeaking(false);
        if (onPlay) onPlay(); // Fallback so UI text shows up
      }
    },
    [languageCode]
  );

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (playResolveRef.current) {
      playResolveRef.current();
      playResolveRef.current = null;
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setHighlight(null);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current?.paused) {
      audioRef.current.play().catch(console.error);
    }
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
    voiceName: "Cloud TTS",
    ready: true,
  };
}
