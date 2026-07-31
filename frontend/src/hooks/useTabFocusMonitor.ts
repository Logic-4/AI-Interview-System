import { useEffect, useRef, useCallback } from "react";

export type FocusViolationType = "tab_switch" | "window_blur";

export interface FocusViolation {
  type: FocusViolationType;
  timestamp: number;
  details: string;
}

export interface UseTabFocusMonitorOptions {
  enabled: boolean;
  onViolation: (violation: FocusViolation) => void;
}

/**
 * Monitors tab visibility and window focus. Fires onViolation when the candidate
 * switches tabs (visibilitychange) or leaves the window (blur). Stops when
 * enabled becomes false.
 */
export function useTabFocusMonitor({ enabled, onViolation }: UseTabFocusMonitorOptions) {
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const lastBlurAt = useRef<number>(0);
  // Deduplicate: visibilitychange and blur fire together on tab-switch.
  // Treat them as one event if they occur within 100ms of each other.
  const DEDUP_MS = 100;

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState !== "hidden") return;
    const now = Date.now();
    if (now - lastBlurAt.current < DEDUP_MS) return;
    lastBlurAt.current = now;
    onViolationRef.current({
      type: "tab_switch",
      timestamp: now,
      details: "Candidate switched to another tab or minimized the browser",
    });
  }, []);

  const handleWindowBlur = useCallback(() => {
    if (document.visibilityState === "hidden") return; // already caught by visibilitychange
    const now = Date.now();
    if (now - lastBlurAt.current < DEDUP_MS) return;
    lastBlurAt.current = now;
    onViolationRef.current({
      type: "window_blur",
      timestamp: now,
      details: "Candidate moved focus away from the interview window",
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [enabled, handleVisibilityChange, handleWindowBlur]);
}
