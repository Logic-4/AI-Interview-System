"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface WordHighlight {
  wordIndex: number;
  charIndex: number;
  charLength: number;
}

export type TtsStatus = "idle" | "preparing" | "ready" | "playing" | "unavailable";

export interface UseSpeechSynthesisReturn {
  speak: (text: string, onPlay?: () => void) => Promise<void>;
  prefetch: (text: string) => void;
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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
const SAMPLE_RATE = 24000;

function normalizeText(text: string): string {
  return String(text || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function* readChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.length) yield value;
    }
  } finally {
    // Runs on normal completion AND on early exit (for-await-of calls
    // .return() on the generator when the consuming loop breaks/returns),
    // so an aborted/superseded speak() still releases the stream reader.
    reader.cancel().catch(() => {});
  }
}

async function* readCached(chunks: Uint8Array[]): AsyncGenerator<Uint8Array> {
  for (const chunk of chunks) yield chunk;
}

/** Converts a little-endian 16-bit PCM byte buffer into normalized Float32 samples. */
function pcm16ToFloat32(bytes: Uint8Array): Float32Array {
  const sampleCount = Math.floor(bytes.length / 2);
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

export function useSpeechSynthesis(languageCode: string = "en-US"): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFetchingTTS, setIsFetchingTTS] = useState(false);
  const [highlight] = useState<WordHighlight | null>(null);
  const [status, setStatus] = useState<TtsStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const pendingByteRef = useRef<Uint8Array | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const languageCodeRef = useRef(languageCode);
  const operationRef = useRef(0);
  languageCodeRef.current = languageCode;
  // Prefetched audio for upcoming text, keyed by "languageCode::text". Lets
  // the next question's TTS finish generating while the candidate is still
  // answering the current one, so speak() can play it back instantly instead
  // of paying the Gemini TTS round-trip at the moment it's needed.
  const prefetchCacheRef = useRef<Map<string, Promise<{ chunks: Uint8Array[]; provider: string | null }>>>(new Map());

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const stopActiveSources = useCallback(() => {
    for (const node of activeSourcesRef.current) {
      try { node.onended = null; node.stop(); } catch { /* already stopped */ }
    }
    activeSourcesRef.current = [];
    pendingByteRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      operationRef.current += 1;
      abortControllerRef.current?.abort();
      stopActiveSources();
      prefetchCacheRef.current.clear();
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
    };
  }, [stopActiveSources]);

  /** Fire-and-forget: fetches and buffers TTS audio so a later speak() call for
   *  the same text plays back instantly instead of hitting the network. */
  const prefetch = useCallback((text: string) => {
    const cleaned = normalizeText(text);
    if (!cleaned) return;
    const key = `${languageCodeRef.current}::${cleaned}`;
    if (prefetchCacheRef.current.has(key)) return;

    const isSomali = /^so/i.test(languageCodeRef.current);
    const promise = (async () => {
      const response = await fetch(`${API_BASE_URL}/tts`, {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: JSON.stringify({
          text: cleaned,
          languageCode: languageCodeRef.current,
          language: isSomali ? "somali" : "english",
        }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`TTS prefetch failed with status ${response.status}`);
      }
      const provider = response.headers.get("x-tts-provider");
      const chunks: Uint8Array[] = [];
      for await (const chunk of readChunks(response.body)) chunks.push(chunk);
      return { chunks, provider };
    })();

    promise.catch(() => { prefetchCacheRef.current.delete(key); });
    prefetchCacheRef.current.set(key, promise);
  }, []);

  const speak = useCallback(async (text: string, onPlay?: () => void): Promise<void> => {
    const cleaned = normalizeText(text);
    if (!cleaned) return;
    const operation = ++operationRef.current;

    abortControllerRef.current?.abort();
    stopActiveSources();
    setIsFetchingTTS(true);
    setStatus("preparing");
    setError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    // Gemini TTS can be slow to start; Somali segments are typically longer
    // than English, so give them extra headroom before aborting.
    const deadlineMs = 30000;
    const timeoutTimer = window.setTimeout(() => controller.abort("TTS request timed out"), deadlineMs);

    try {
      const audioContext = getAudioContext();
      if (audioContext.state === "suspended") await audioContext.resume();

      const isSomali = /^so/i.test(languageCodeRef.current);
      const cacheKey = `${languageCodeRef.current}::${cleaned}`;
      const cachedPromise = prefetchCacheRef.current.get(cacheKey);
      prefetchCacheRef.current.delete(cacheKey);

      let chunkSource: AsyncGenerator<Uint8Array> | null = null;
      let providerHeader: string | null = null;

      if (cachedPromise) {
        try {
          const cached = await cachedPromise;
          providerHeader = cached.provider;
          chunkSource = readCached(cached.chunks);
        } catch {
          chunkSource = null; // prefetch failed — fall through to a live fetch
        }
      }

      if (!chunkSource) {
        const response = await fetch(`${API_BASE_URL}/tts`, {
          method: "POST",
          credentials: "include",
          headers: authHeaders(),
          body: JSON.stringify({
            text: cleaned,
            languageCode: languageCodeRef.current,
            language: isSomali ? "somali" : "english",
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`TTS request failed with status ${response.status}`);
        }
        providerHeader = response.headers.get("x-tts-provider");
        chunkSource = readChunks(response.body);
      }

      if (operation !== operationRef.current) return;

      setProvider(providerHeader);
      nextStartTimeRef.current = audioContext.currentTime + 0.05;
      let firstChunk = true;
      let lastNode: AudioBufferSourceNode | null = null;
      const playbackResolver: { resolve: () => void } = { resolve: () => {} };
      const playbackDone = new Promise<void>((resolve) => { playbackResolver.resolve = resolve; });

      const scheduleChunk = (bytes: Uint8Array) => {
        const samples = pcm16ToFloat32(bytes);
        if (!samples.length) return;
        const buffer = audioContext.createBuffer(1, samples.length, SAMPLE_RATE);
        buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
        const node = audioContext.createBufferSource();
        node.buffer = buffer;
        node.connect(audioContext.destination);
        const startAt = Math.max(nextStartTimeRef.current, audioContext.currentTime);
        node.start(startAt);
        nextStartTimeRef.current = startAt + buffer.duration;
        activeSourcesRef.current.push(node);
        lastNode = node;
      };

      for await (const value of chunkSource) {
        // Exiting the loop here calls chunkSource.return(), which runs
        // readChunks' finally block and cancels the underlying stream reader.
        if (operation !== operationRef.current) return;
        if (!value || !value.length) continue;

        let bytes = value;
        if (pendingByteRef.current) {
          const merged = new Uint8Array(pendingByteRef.current.length + bytes.length);
          merged.set(pendingByteRef.current, 0);
          merged.set(bytes, pendingByteRef.current.length);
          bytes = merged;
          pendingByteRef.current = null;
        }
        if (bytes.length % 2 !== 0) {
          pendingByteRef.current = bytes.subarray(bytes.length - 1);
          bytes = bytes.subarray(0, bytes.length - 1);
        }
        if (!bytes.length) continue;

        if (firstChunk) {
          firstChunk = false;
          window.clearTimeout(timeoutTimer);
          setIsFetchingTTS(false);
          setStatus("playing");
          setIsSpeaking(true);
          setIsPaused(false);
          onPlay?.();
        }
        scheduleChunk(bytes);
      }

      if (firstChunk) {
        // Stream ended with no audio at all.
        throw new Error("TTS stream returned no audio");
      }

      if (lastNode) {
        (lastNode as AudioBufferSourceNode).onended = () => playbackResolver.resolve();
      } else {
        playbackResolver.resolve();
      }
      await playbackDone;
      if (operation !== operationRef.current) return;
      setIsSpeaking(false);
      setIsPaused(false);
      setStatus("ready");
    } catch (caught) {
      window.clearTimeout(timeoutTimer);
      if (operation !== operationRef.current) return;
      stopActiveSources();
      const message = caught instanceof Error ? caught.message : "Speech synthesis failed";
      setError(message);
      setIsFetchingTTS(false);
      setIsSpeaking(false);
      setIsPaused(false);
      setStatus("unavailable");
      // Fail silently — reveal the caller's UI (question text) via onPlay so
      // the candidate can still read and answer, without a noisy alert.
      onPlay?.();
      throw caught instanceof Error ? caught : new Error(message);
    } finally {
      window.clearTimeout(timeoutTimer);
    }
  }, [getAudioContext, stopActiveSources]);

  const cancel = useCallback(() => {
    operationRef.current += 1;
    abortControllerRef.current?.abort();
    stopActiveSources();
    setIsSpeaking(false);
    setIsPaused(false);
    setIsFetchingTTS(false);
    setStatus("idle");
  }, [stopActiveSources]);

  const pause = useCallback(() => {
    audioContextRef.current?.suspend().catch(() => {});
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    audioContextRef.current?.resume().catch(() => {});
    setIsPaused(false);
  }, []);

  return {
    speak, prefetch, cancel, pause, resume,
    isSpeaking, isPaused, isFetchingTTS, highlight,
    voiceName: /^so/i.test(languageCode) ? "Gemini TTS (Somali)" : "Gemini TTS",
    ready: status === "ready" || status === "playing",
    status, error, provider,
  };
}
