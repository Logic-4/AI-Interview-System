"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/** Preferred voices ranked by quality — matched by partial name (case-insensitive). */
const VOICE_PREFERENCE = [
  "google uk english female",
  "google uk english male",
  "google us english",
  "microsoft zira",
  "microsoft david",
  "microsoft mark",
  "samantha",        // macOS high-quality
  "karen",           // macOS Australian
  "daniel",          // macOS British
  "moira",           // macOS Irish
  "fiona",           // macOS Scottish
  "google",          // any other Google voice
  "microsoft",       // any other Microsoft voice
];

function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  // Filter to English voices
  const englishVoices = voices.filter((v) =>
    v.lang.startsWith("en")
  );
  const pool = englishVoices.length ? englishVoices : voices;

  // Walk preference list and return first match
  for (const pref of VOICE_PREFERENCE) {
    const match = pool.find((v) =>
      v.name.toLowerCase().includes(pref)
    );
    if (match) return match;
  }

  // Fallback: first English voice, or first voice overall
  return pool[0] || voices[0];
}

export interface WordHighlight {
  /** Index of the word currently being spoken (0-based) */
  wordIndex: number;
  /** Character offset into the full text */
  charIndex: number;
  /** Length of the word being spoken */
  charLength: number;
}

export interface UseSpeechSynthesisReturn {
  /** Speak the given text */
  speak: (text: string) => void;
  /** Stop speaking */
  cancel: () => void;
  /** Pause speech */
  pause: () => void;
  /** Resume speech */
  resume: () => void;
  /** Whether the engine is currently speaking */
  isSpeaking: boolean;
  /** Whether the engine is paused */
  isPaused: boolean;
  /** Current word being highlighted */
  highlight: WordHighlight | null;
  /** The selected voice name */
  voiceName: string;
  /** Whether voices have loaded */
  ready: boolean;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highlight, setHighlight] = useState<WordHighlight | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [ready, setReady] = useState(false);

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wordsRef = useRef<string[]>([]);

  // Load voices (may fire async on some browsers)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) {
        const best = pickBestVoice(voices);
        voiceRef.current = best;
        setVoiceName(best?.name ?? "Default");
        setReady(true);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    // Split text into words for highlight mapping
    wordsRef.current = text.split(/\s+/);

    // Apply best voice
    if (voiceRef.current) {
      utterance.voice = voiceRef.current;
    }

    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Word-boundary event → highlight
    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (event.name === "word") {
        // Find which word index this charIndex corresponds to
        const charIdx = event.charIndex;
        const charLen = event.charLength || 1;
        let accumulated = 0;
        let wordIdx = 0;
        for (let i = 0; i < wordsRef.current.length; i++) {
          if (accumulated >= charIdx) {
            wordIdx = i;
            break;
          }
          // +1 for the space separator
          accumulated += wordsRef.current[i].length + 1;
          wordIdx = i + 1;
        }
        setHighlight({
          wordIndex: Math.min(wordIdx, wordsRef.current.length - 1),
          charIndex: charIdx,
          charLength: charLen,
        });
      }
    };

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setHighlight(null);
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setHighlight(null);
      utteranceRef.current = null;
    };

    utterance.onpause = () => setIsPaused(true);
    utterance.onresume = () => setIsPaused(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setHighlight(null);
  }, []);

  const pause = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.pause();
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.resume();
  }, []);

  return {
    speak,
    cancel,
    pause,
    resume,
    isSpeaking,
    isPaused,
    highlight,
    voiceName,
    ready,
  };
}
