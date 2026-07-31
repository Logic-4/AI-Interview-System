import { useEffect, useRef, useCallback, useState } from "react";

export type GazeViolationType = "gaze_away" | "face_not_detected";

export interface GazeViolation {
  type: GazeViolationType;
  timestamp: number;
  details: string;
}

export interface UseGazeTrackingOptions {
  enabled: boolean;
  videoElement: HTMLVideoElement | null;
  onViolation: (violation: GazeViolation) => void;
  /** Yaw threshold in degrees before flagging a gaze-away event (default: 25) */
  yawThresholdDeg?: number;
  /** Pitch threshold in degrees before flagging a gaze-away event (default: 20) */
  pitchThresholdDeg?: number;
  /** Consecutive frames the head must be off-screen before triggering (default: 8) */
  offScreenFrames?: number;
  /** Consecutive frames where no face is detected before triggering (default: 15) */
  noFaceFrames?: number;
}

export interface GazeTrackingState {
  isLoaded: boolean;
  isTracking: boolean;
  error: string | null;
  /** Last measured yaw angle (positive = right) */
  yaw: number;
  /** Last measured pitch angle (positive = up) */
  pitch: number;
}

/* ── MediaPipe CDN loader ──────────────────────────────────────── */
type MediaPipeFaceLandmarker = {
  detectForVideo(video: HTMLVideoElement, ts: number): {
    faceLandmarks: Array<Array<{ x: number; y: number; z: number }>>;
  };
  close(): void;
};

let cachedLandmarker: MediaPipeFaceLandmarker | null = null;
let loadPromise: Promise<MediaPipeFaceLandmarker> | null = null;

async function loadFaceLandmarker(): Promise<MediaPipeFaceLandmarker> {
  if (cachedLandmarker) return cachedLandmarker;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Dynamic CDN import via Function constructor — TypeScript does not
    // resolve the URL so there are no module-not-found errors, and the WASM
    // bundle is never included in the application bundle.
    const cdnUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
    // eslint-disable-next-line no-new-func
    const { FaceLandmarker, FilesetResolver } = await (new Function(
      "u", "return import(u)"
    )(cdnUrl)) as { FaceLandmarker: any; FilesetResolver: any };

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );

    const landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
    });

    cachedLandmarker = landmarker as MediaPipeFaceLandmarker;
    return cachedLandmarker;
  })();

  return loadPromise;
}

/* ── Pose estimation from landmarks ────────────────────────────── */
// Using the relative position of key landmarks to estimate head direction.
// Landmark indices for FaceLandmarker 478-point model:
//   Nose tip: 1, Chin: 152, Left eye outer: 33, Right eye outer: 263,
//   Left mouth corner: 61, Right mouth corner: 291
const NOSE = 1;
const CHIN = 152;
const LEFT_EYE = 33;
const RIGHT_EYE = 263;

function estimatePose(landmarks: Array<{ x: number; y: number; z: number }>) {
  if (landmarks.length < 300) return { yaw: 0, pitch: 0 };

  const nose = landmarks[NOSE];
  const chin = landmarks[CHIN];
  const leftEye = landmarks[LEFT_EYE];
  const rightEye = landmarks[RIGHT_EYE];

  const faceWidth = Math.abs(rightEye.x - leftEye.x);
  if (faceWidth < 0.01) return { yaw: 0, pitch: 0 };

  const midEyeX = (leftEye.x + rightEye.x) / 2;
  const midEyeY = (leftEye.y + rightEye.y) / 2;

  // Yaw: horizontal offset of nose relative to eye midpoint, normalized by face width
  const yawRaw = (nose.x - midEyeX) / faceWidth;
  // Pitch: vertical offset of nose relative to midpoint between eyes and chin
  const midFaceY = (midEyeY + chin.y) / 2;
  const pitchRaw = (nose.y - midFaceY) / (chin.y - midEyeY + 0.001);

  const yawDeg = yawRaw * 90;
  const pitchDeg = pitchRaw * 60;

  return { yaw: yawDeg, pitch: pitchDeg };
}

/* ── Hook ───────────────────────────────────────────────────────── */
export function useGazeTracking({
  enabled,
  videoElement,
  onViolation,
  yawThresholdDeg = 25,
  pitchThresholdDeg = 20,
  offScreenFrames = 8,
  noFaceFrames = 15,
}: UseGazeTrackingOptions): GazeTrackingState {
  const [state, setState] = useState<GazeTrackingState>({
    isLoaded: false,
    isTracking: false,
    error: null,
    yaw: 0,
    pitch: 0,
  });

  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const rafRef = useRef<number>(0);
  const landmarkerRef = useRef<MediaPipeFaceLandmarker | null>(null);
  const offScreenCountRef = useRef(0);
  const noFaceCountRef = useRef(0);
  // Per-violation cooldowns to avoid flooding
  const gazeAwayCooldownRef = useRef(0);
  const noFaceCooldownRef = useRef(0);
  const COOLDOWN_MS = 8000;

  const runDetection = useCallback(() => {
    const video = videoElement;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(runDetection);
      return;
    }

    try {
      const results = landmarker.detectForVideo(video, performance.now());
      const faces = results.faceLandmarks;

      if (!faces || faces.length === 0) {
        offScreenCountRef.current = 0;
        noFaceCountRef.current += 1;

        if (noFaceCountRef.current >= noFaceFrames) {
          noFaceCountRef.current = 0;
          const now = Date.now();
          if (now - noFaceCooldownRef.current >= COOLDOWN_MS) {
            noFaceCooldownRef.current = now;
            onViolationRef.current({
              type: "face_not_detected",
              timestamp: now,
              details: "No face detected in camera feed",
            });
          }
        }

        setState((s) => ({ ...s, yaw: 0, pitch: 0 }));
      } else {
        noFaceCountRef.current = 0;
        const { yaw, pitch } = estimatePose(faces[0]);

        const isOffScreen =
          Math.abs(yaw) > yawThresholdDeg || Math.abs(pitch) > pitchThresholdDeg;

        if (isOffScreen) {
          offScreenCountRef.current += 1;
          if (offScreenCountRef.current >= offScreenFrames) {
            offScreenCountRef.current = 0;
            const now = Date.now();
            if (now - gazeAwayCooldownRef.current >= COOLDOWN_MS) {
              gazeAwayCooldownRef.current = now;
              const dir = Math.abs(yaw) > yawThresholdDeg
                ? yaw > 0 ? "right" : "left"
                : pitch > 0 ? "down" : "up";
              onViolationRef.current({
                type: "gaze_away",
                timestamp: now,
                details: `Head turned ${dir} (yaw ${yaw.toFixed(0)}°, pitch ${pitch.toFixed(0)}°)`,
              });
            }
          }
        } else {
          offScreenCountRef.current = 0;
        }

        setState((s) => ({ ...s, yaw, pitch }));
      }
    } catch {
      // Detection errors are silently swallowed — don't crash the interview
    }

    rafRef.current = requestAnimationFrame(runDetection);
  }, [videoElement, yawThresholdDeg, pitchThresholdDeg, offScreenFrames, noFaceFrames]);

  useEffect(() => {
    if (!enabled || !videoElement) return;

    let cancelled = false;

    setState((s) => ({ ...s, error: null }));

    loadFaceLandmarker()
      .then((landmarker) => {
        if (cancelled) return;
        landmarkerRef.current = landmarker;
        setState((s) => ({ ...s, isLoaded: true, isTracking: true }));
        rafRef.current = requestAnimationFrame(runDetection);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load face tracking";
        setState((s) => ({ ...s, error: msg, isLoaded: false, isTracking: false }));
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      landmarkerRef.current = null;
      setState((s) => ({ ...s, isTracking: false }));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, videoElement]);

  // Restart detection loop when videoElement changes while already loaded
  useEffect(() => {
    if (!state.isLoaded || !enabled || !videoElement || !landmarkerRef.current) return;
    cancelAnimationFrame(rafRef.current);
    setState((s) => ({ ...s, isTracking: true }));
    rafRef.current = requestAnimationFrame(runDetection);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoElement, state.isLoaded, enabled]);

  return state;
}
