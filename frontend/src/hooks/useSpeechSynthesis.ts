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

export type TtsStatus = "idle" | "preparing" | "ready" | "playing" | "retrying-fallback" | "unavailable";

export interface UseSpeechSynthesisReturn {
  speak: (text: string, onPlay?: () => void) => Promise<void>;
  prefetch: (text: string) => Promise<boolean>;
  prefetchMany: (texts: string[]) => Promise<void>;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  isSpeaking: boolean;
  isPaused: boolean;
  isFetchingTTS: boolean;
  highlight: WordHighlight | null;
  voiceName: string;
  ready: boolean;
  status: TtsStatus;
  error: string | null;
  provider: string | null;
}

type CachedAudio = { blob: Blob; provider: string | null };
const audioCache = new Map<string, Promise<CachedAudio>>();
const AUDIO_CACHE_MAX = 32;

function normalizeText(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function cacheKey(text: string, languageCode: string): string {
  return `${languageCode.toLowerCase()}\u0000${normalizeText(text)}`;
}

function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`Audio was not ready within ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (caught) => { window.clearTimeout(timer); reject(caught); }
    );
  });
}

async function requestAudio(text: string, languageCode: string): Promise<CachedAudio> {
  const key = cacheKey(text, languageCode);
  const existing = audioCache.get(key);
  if (existing) return existing;

  const request = (async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    headers["X-Request-ID"] = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `tts-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort("TTS request timed out"), 50000);
    try {
      const response = await fetch(`${getApiBaseUrl()}/tts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: normalizeText(text),
          languageCode,
          language: isSomaliLanguage(languageCode) ? "somali" : "english",
        }),
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`TTS API ${response.status}: ${body.slice(0, 240)}`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().startsWith("audio/")) {
        throw new Error(`TTS API returned ${contentType || "an unknown content type"}`);
      }
      const blob = await response.blob();
      if (blob.size <= 44) throw new Error("TTS API returned an empty audio file");
      return { blob, provider: response.headers.get("x-tts-provider") };
    } finally {
      window.clearTimeout(timeout);
    }
  })();

  audioCache.set(key, request);
  request.catch(() => audioCache.delete(key));
  while (audioCache.size > AUDIO_CACHE_MAX) audioCache.delete(audioCache.keys().next().value as string);
  return request;
}

export function useSpeechSynthesis(languageCode: string = "en-US"): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFetchingTTS, setIsFetchingTTS] = useState(false);
  const [highlight] = useState<WordHighlight | null>(null);
  const [status, setStatus] = useState<TtsStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const browserUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const playResolveRef = useRef<(() => void) | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const languageCodeRef = useRef(languageCode);
  const operationRef = useRef(0);
  languageCodeRef.current = languageCode;

  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.onplay = () => { setIsSpeaking(true); setIsPaused(false); setStatus("playing"); };
    audio.onpause = () => { if (!audio.ended && audio.currentTime > 0) setIsPaused(true); };
    audio.onended = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setStatus("ready");
      releaseObjectUrl();
      playResolveRef.current?.();
      playResolveRef.current = null;
    };
    audio.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setStatus("unavailable");
      releaseObjectUrl();
      playResolveRef.current?.();
      playResolveRef.current = null;
    };
    return () => {
      operationRef.current += 1;
      audio.pause();
      audio.removeAttribute("src");
      releaseObjectUrl();
      window.speechSynthesis?.cancel();
      audioRef.current = null;
    };
  }, [releaseObjectUrl]);

  const speakWithBrowserFallback = useCallback((text: string, onPlay?: () => void) => new Promise<boolean>((resolve) => {
    if (!window.speechSynthesis) return resolve(false);
    const isSomali = isSomaliLanguage(languageCodeRef.current);
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(isSomali ? "so" : "en"));
    if (isSomali && !matchingVoice) return resolve(false);

    let settled = false;
    const finish = (played: boolean) => {
      if (settled) return;
      settled = true;
      setIsSpeaking(false);
      setIsPaused(false);
      browserUtteranceRef.current = null;
      resolve(played);
    };
    const timer = window.setTimeout(() => finish(false), 15000);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCodeRef.current;
    if (matchingVoice) utterance.voice = matchingVoice;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setStatus("playing");
      onPlay?.();
    };
    utterance.onend = () => { window.clearTimeout(timer); finish(true); };
    utterance.onerror = () => { window.clearTimeout(timer); finish(false); };
    browserUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }), []);

  const prefetch = useCallback(async (text: string): Promise<boolean> => {
    if (!normalizeText(text)) return false;
    try {
      await requestAudio(text, languageCodeRef.current);
      setStatus((current) => current === "idle" || current === "preparing" ? "ready" : current);
      return true;
    } catch {
      return false;
    }
  }, []);

  const prefetchMany = useCallback(async (texts: string[]) => {
    const queue = [...new Set(texts.map(normalizeText).filter(Boolean))];
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const text = queue[cursor++];
        await prefetch(text);
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, queue.length) }, worker));
  }, [prefetch]);

  const speak = useCallback(async (text: string, onPlay?: () => void): Promise<void> => {
    const audio = audioRef.current;
    if (!audio || !normalizeText(text)) return;
    const operation = ++operationRef.current;

    audio.pause();
    audio.currentTime = 0;
    releaseObjectUrl();
    window.speechSynthesis?.cancel();
    playResolveRef.current?.();
    playResolveRef.current = null;
    setIsFetchingTTS(true);
    setStatus("preparing");
    setError(null);

    try {
      const result = await withDeadline(requestAudio(text, languageCodeRef.current), 8000);
      if (operation !== operationRef.current) return;
      setProvider(result.provider);
      setStatus("ready");
      const audioUrl = URL.createObjectURL(result.blob);
      objectUrlRef.current = audioUrl;
      audio.src = audioUrl;
      setIsFetchingTTS(false);
      await new Promise<void>((resolve) => {
        playResolveRef.current = resolve;
        audio.play().then(() => onPlay?.()).catch(() => resolve());
      });
    } catch (caught) {
      if (operation !== operationRef.current) return;
      const message = caught instanceof Error ? caught.message : "Speech synthesis failed";
      setError(message);
      setIsFetchingTTS(false);
      setStatus("retrying-fallback");
      const played = await speakWithBrowserFallback(text, onPlay);
      if (!played) {
        setStatus("unavailable");
        onPlay?.();
        toast.error(isSomaliLanguage(languageCodeRef.current)
          ? "Somali audio is unavailable. The interview will continue with text; you can retry audio shortly."
          : "Audio is unavailable. The interview will continue with text.");
      } else {
        setProvider("browser-fallback");
        setStatus("ready");
      }
    }
  }, [releaseObjectUrl, speakWithBrowserFallback]);

  const cancel = useCallback(() => {
    operationRef.current += 1;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    releaseObjectUrl();
    window.speechSynthesis?.cancel();
    browserUtteranceRef.current = null;
    playResolveRef.current?.();
    playResolveRef.current = null;
    setIsSpeaking(false);
    setIsPaused(false);
    setIsFetchingTTS(false);
    setStatus("idle");
  }, [releaseObjectUrl]);

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
    window.speechSynthesis?.pause();
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current?.src && audioRef.current.paused && !audioRef.current.ended) void audioRef.current.play();
    window.speechSynthesis?.resume();
  }, []);

  return {
    speak, prefetch, prefetchMany, cancel, pause, resume,
    isSpeaking, isPaused, isFetchingTTS, highlight,
    voiceName: isSomaliLanguage(languageCode) ? "Somali TTS" : "Piper TTS",
    ready: status === "ready" || status === "playing",
    status, error, provider,
  };
}
