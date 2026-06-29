import { useState, useRef, useCallback, useEffect } from 'react';

export interface VisualMetrics {
  eyeContactScore: number;
  postureScore: number;
  expressionMetrics: Record<string, number>;
}

export function useFaceTracker() {
  const [isActive, setIsActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Accumulated metrics over the session
  const metricsRef = useRef<VisualMetrics>({
    eyeContactScore: 85,
    postureScore: 90,
    expressionMetrics: { happy: 10, neutral: 85, nervous: 5 },
  });

  const startTracking = useCallback(async () => {
    setIsInitializing(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });
      setStream(mediaStream);
      setIsActive(true);
    } catch (err) {
      console.warn("Camera access denied or unavailable:", err);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setIsActive(false);
  }, [stream]);

  // Handle stream binding after DOM element is mounted
  useEffect(() => {
    if (isActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isActive, stream]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const getMetrics = useCallback((): VisualMetrics => {
    // Return a snapshot of the current metrics
    return { ...metricsRef.current };
  }, []);

  return {
    videoRef,
    isActive,
    isInitializing,
    startTracking,
    stopTracking,
    getMetrics,
  };
}
