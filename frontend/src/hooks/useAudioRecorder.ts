import { useState, useRef, useCallback, useEffect } from 'react';

const SILENCE_VOLUME_THRESHOLD = 0.02;
const VOLUME_POLL_MS = 100;

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  /** 0–1 mic level for UI */
  volume: number;
  /** Seconds since last speech detected */
  silenceDuration: number;
  analyserData: Uint8Array | null;
}

export interface AudioRecorderActions {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  stopRecordingAsync: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => Promise<void>;
  getVolume: () => number;
  getSilenceDuration: () => number;
  /** Stop if needed and return the latest recorded blob (ref-backed, not stale). */
  finalizeRecording: () => Promise<Blob | null>;
}

export function useAudioRecorder(): AudioRecorderState & AudioRecorderActions {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [silenceDuration, setSilenceDuration] = useState(0);
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const volumeIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);
  const resetResolverRef = useRef<(() => void) | null>(null);
  const volumeRef = useRef(0);
  const silenceDurationRef = useRef(0);
  const lastSpeechTimeRef = useRef(Date.now());
  const dataArrRef = useRef<Uint8Array | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const finalizingRef = useRef<Promise<Blob | null> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const cleanupStream = useCallback(() => {
    if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    dataArrRef.current = null;
    volumeRef.current = 0;
    silenceDurationRef.current = 0;
    setVolume(0);
    setSilenceDuration(0);
    setAnalyserData(null);
  }, []);

  const pollVolume = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    if (!dataArrRef.current || dataArrRef.current.length !== analyser.fftSize) {
      dataArrRef.current = new Uint8Array(analyser.fftSize);
    }
    const dataArr = dataArrRef.current;
    analyser.getByteTimeDomainData(dataArr as Uint8Array<ArrayBuffer>);

    let sum = 0;
    for (let i = 0; i < dataArr.length; i++) {
      const v = (dataArr[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataArr.length);
    volumeRef.current = rms;
    setVolume(rms);
    setAnalyserData(dataArr.slice());

    if (rms > SILENCE_VOLUME_THRESHOLD) {
      lastSpeechTimeRef.current = Date.now();
    }
    const elapsed = (Date.now() - lastSpeechTimeRef.current) / 1000;
    silenceDurationRef.current = elapsed;
    setSilenceDuration(elapsed);
  }, []);

  const getVolume = useCallback(() => volumeRef.current, []);
  const getSilenceDuration = useCallback(() => silenceDurationRef.current, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          resetResolverRef.current = resolve;
          mediaRecorderRef.current?.stop();
        });
      } else {
        cleanupStream();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: mimeType })
          : null;
        audioBlobRef.current = blob;
        if (blob) {
          setAudioBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
        }
        if (stopResolverRef.current) {
          stopResolverRef.current(blob);
          stopResolverRef.current = null;
        }
        finalizingRef.current = null;
        if (resetResolverRef.current) {
          resetResolverRef.current();
          resetResolverRef.current = null;
        }
        cleanupStream();
      };

      recorder.onerror = () => {
        setError('Recording failed. Please check your microphone.');
      };

      recorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      setAudioBlob(null);
      audioBlobRef.current = null;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);

      lastSpeechTimeRef.current = Date.now();
      silenceDurationRef.current = 0;

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      volumeIntervalRef.current = setInterval(pollVolume, VOLUME_POLL_MS);
      pollVolume();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setError(msg);
      setIsRecording(false);
      cleanupStream();
      throw err;
    }
  }, [audioUrl, cleanupStream, pollVolume]);

  const ensureStopPending = useCallback(() => {
    if (!stopResolverRef.current) {
      const promise = new Promise<Blob | null>((resolve) => {
        stopResolverRef.current = resolve;
      });
      finalizingRef.current = promise;
    }
  }, []);

  const flushAndStopRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    ensureStopPending();
    try {
      recorder.requestData();
    } catch {
      // ignore
    }
    recorder.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
    setIsRecording(false);
    setIsPaused(false);
  }, [ensureStopPending]);

  const stopRecording = useCallback(() => {
    flushAndStopRecorder();
  }, [flushAndStopRecorder]);

  const stopRecordingAsync = useCallback((): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      return Promise.resolve(audioBlobRef.current);
    }

    return new Promise((resolve) => {
      stopResolverRef.current = resolve;
      flushAndStopRecorder();
    });
  }, [flushAndStopRecorder]);

  const finalizeRecording = useCallback(async (): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      return stopRecordingAsync();
    }
    if (audioBlobRef.current) {
      return audioBlobRef.current;
    }
    if (finalizingRef.current) {
      return finalizingRef.current;
    }
    return null;
  }, [stopRecordingAsync]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
      setIsPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      volumeIntervalRef.current = setInterval(pollVolume, VOLUME_POLL_MS);
      setIsPaused(false);
    }
  }, [pollVolume]);

  const resetRecording = useCallback(async (): Promise<void> => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        resetResolverRef.current = resolve;
        mediaRecorderRef.current?.stop();
      });
    } else {
      cleanupStream();
    }
    chunksRef.current = [];
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setAudioBlob(null);
    audioBlobRef.current = null;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setError(null);
    if (stopResolverRef.current) {
      stopResolverRef.current(null);
      stopResolverRef.current = null;
    }
    finalizingRef.current = null;
  }, [audioUrl, cleanupStream]);

  return {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    error,
    volume,
    silenceDuration,
    analyserData,
    startRecording,
    stopRecording,
    stopRecordingAsync,
    pauseRecording,
    resumeRecording,
    resetRecording,
    getVolume,
    getSilenceDuration,
    finalizeRecording,
  };
}
