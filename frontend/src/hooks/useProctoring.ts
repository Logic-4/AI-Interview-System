import { useState, useRef, useCallback, useEffect } from "react";
import { useTabFocusMonitor, type FocusViolation } from "./useTabFocusMonitor";
import { useGazeTracking, type GazeViolation, type GazeTrackingState } from "./useGazeTracking";
import interviewService from "../services/interviewService";

export type ProctoringViolationType =
  | "tab_switch"
  | "window_blur"
  | "gaze_away"
  | "face_not_detected";

export interface ProctoringViolation {
  type: ProctoringViolationType;
  timestamp: number;
  details: string;
  strike: number | null;
}

export interface ProctoringAlert {
  id: string;
  message: string;
  severity: "warning" | "final";
  strikeNumber: number;
}

export interface ProctoringState {
  strikes: number;
  integrityScore: number;
  flaggedForReview: boolean;
  violations: ProctoringViolation[];
  currentAlert: ProctoringAlert | null;
  gazeTracking: GazeTrackingState;
}

export interface UseProctoringOptions {
  /** Only proctors company interviews */
  enabled: boolean;
  interviewId: string;
  /** Feed from the webcam stream used for recording — reused for gaze tracking */
  videoElement: HTMLVideoElement | null;
  /** Whether gaze tracking should run (requires videoElement) */
  gazeEnabled?: boolean;
}

const ALERT_MESSAGES: Record<number, string> = {
  1: "Please keep your eyes on the screen. This has been logged.",
  2: "Second warning: maintain eye contact with the screen. One more violation will flag this session for review.",
  3: "Your session has been flagged for review due to repeated off-screen activity.",
};

/* ── Helper: generate a stable alert id ─────────────────────────── */
let alertCounter = 0;
function nextAlertId() {
  return `proctor-alert-${++alertCounter}`;
}

export function useProctoring({
  enabled,
  interviewId,
  videoElement,
  gazeEnabled = true,
}: UseProctoringOptions): ProctoringState & {
  dismissAlert: () => void;
} {
  const [strikes, setStrikes] = useState(0);
  const [integrityScore, setIntegrityScore] = useState(100);
  const [flaggedForReview, setFlaggedForReview] = useState(false);
  const [violations, setViolations] = useState<ProctoringViolation[]>([]);
  const [currentAlert, setCurrentAlert] = useState<ProctoringAlert | null>(null);

  const strikesRef = useRef(0);
  const reportQueue = useRef<ProctoringViolation[]>([]);
  const isFlushing = useRef(false);

  /* ── Flush violation queue to backend ──────────────────────────── */
  const flushQueue = useCallback(async () => {
    if (isFlushing.current || reportQueue.current.length === 0) return;
    isFlushing.current = true;

    while (reportQueue.current.length > 0) {
      const violation = reportQueue.current.shift()!;
      try {
        const result = await interviewService.reportProctoringEvent(interviewId, {
          type: violation.type,
          details: violation.details,
          strike: violation.strike ?? undefined,
        });
        if (result) {
          setIntegrityScore(result.integrityScore);
          setFlaggedForReview(result.flaggedForReview);
        }
      } catch {
        // Non-fatal — proctoring failures never block the interview
      }
    }

    isFlushing.current = false;
  }, [interviewId]);

  /* ── Core violation handler ─────────────────────────────────────── */
  const handleViolation = useCallback(
    (violation: FocusViolation | GazeViolation) => {
      if (!enabled) return;

      const newStrikeCount = strikesRef.current + 1;
      const isStrikeWorthy =
        violation.type === "tab_switch" ||
        violation.type === "gaze_away" ||
        violation.type === "face_not_detected";

      let strike: number | null = null;
      if (isStrikeWorthy && newStrikeCount <= 3) {
        strikesRef.current = newStrikeCount;
        setStrikes(newStrikeCount);
        strike = newStrikeCount;

        const alertMessage = ALERT_MESSAGES[newStrikeCount];
        setCurrentAlert({
          id: nextAlertId(),
          message: alertMessage,
          severity: newStrikeCount >= 3 ? "final" : "warning",
          strikeNumber: newStrikeCount,
        });

        if (newStrikeCount >= 3) {
          setFlaggedForReview(true);
        }
      }

      const proctoringViolation: ProctoringViolation = {
        type: violation.type as ProctoringViolationType,
        timestamp: violation.timestamp,
        details: violation.details,
        strike,
      };

      setViolations((prev) => [...prev, proctoringViolation]);
      reportQueue.current.push(proctoringViolation);
      void flushQueue();
    },
    [enabled, flushQueue]
  );

  /* ── window_blur is non-strike but still logged ─────────────────── */
  const handleFocusViolation = useCallback(
    (v: FocusViolation) => {
      // Tab switch gets a strike; plain window blur (alt-tab quick) is logged only
      if (v.type === "tab_switch") {
        handleViolation(v);
      } else {
        // Log to backend without incrementing the local strike counter
        const pv: ProctoringViolation = {
          type: v.type,
          timestamp: v.timestamp,
          details: v.details,
          strike: null,
        };
        setViolations((prev) => [...prev, pv]);
        reportQueue.current.push(pv);
        void flushQueue();
      }
    },
    [handleViolation, flushQueue]
  );

  /* ── Tab/focus monitoring ───────────────────────────────────────── */
  useTabFocusMonitor({ enabled, onViolation: handleFocusViolation });

  /* ── Gaze tracking ──────────────────────────────────────────────── */
  const gazeTracking = useGazeTracking({
    enabled: enabled && gazeEnabled && Boolean(videoElement),
    videoElement,
    onViolation: handleViolation,
  });

  /* ── Auto-dismiss warning alerts after 6s, final after 10s ─────── */
  useEffect(() => {
    if (!currentAlert) return;
    const duration = currentAlert.severity === "final" ? 10_000 : 6_000;
    const t = setTimeout(() => setCurrentAlert(null), duration);
    return () => clearTimeout(t);
  }, [currentAlert]);

  const dismissAlert = useCallback(() => setCurrentAlert(null), []);

  return {
    strikes,
    integrityScore,
    flaggedForReview,
    violations,
    currentAlert,
    gazeTracking,
    dismissAlert,
  };
}
