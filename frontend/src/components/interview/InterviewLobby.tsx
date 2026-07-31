import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  RefreshCw,
  UserX,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { cn } from "../../lib/utils";
import interviewService from "../../services/interviewService";
import type { IdentityVerificationStatus } from "../../types/interview";

type CamState = "idle" | "requesting" | "ready" | "denied" | "unsupported";
type CheckState = "idle" | "capturing" | "verifying" | "passed" | "retry" | "blocked";

interface InterviewLobbyProps {
  interviewId: string;
  candidateName?: string;
  /**
   * When true, the live camera stream is handed off (not stopped) to the
   * caller once verification passes, so the same stream can continue into a
   * full-session recording without re-requesting camera permission.
   */
  keepStreamForRecording?: boolean;
  /**
   * Called once the identity checkpoint has passed (or was not required).
   * Receives the live MediaStream when `keepStreamForRecording` is true and
   * a camera was actually opened — the caller becomes responsible for
   * stopping its tracks. Otherwise receives null.
   */
  onVerified: (stream: MediaStream | null) => void;
}

/**
 * Task 3.1 — Pre-Interview Checkpoint UI.
 * Initializes the webcam ahead of the live session and, when the interview
 * belongs to a company tenant, runs the Task 3.2/3.3 biometric gatekeeper
 * before letting the candidate proceed.
 */
export default function InterviewLobby({
  interviewId,
  candidateName,
  keepStreamForRecording = false,
  onVerified,
}: InterviewLobbyProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camState, setCamState] = useState<CamState>("idle");
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [verification, setVerification] = useState<IdentityVerificationStatus | null>(null);
  const [message, setMessage] = useState<string>("");
  const [statusLoading, setStatusLoading] = useState(true);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamState("unsupported");
      return;
    }
    setCamState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamState("ready");
    } catch {
      setCamState("denied");
    }
  }, []);

  // Load the checkpoint requirement once, then bring up the webcam.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await interviewService.getIdentityStatus(interviewId);
        if (cancelled) return;
        setVerification(status);
        if (status.status === "passed" || !status.required) {
          setCheckState("passed");
          setStatusLoading(false);
          onVerified(null);
          return;
        }
        if (status.status === "blocked") {
          setCheckState("blocked");
          setMessage("Identity verification failed too many times. This interview has been blocked. Contact the hiring team.");
        }
      } catch {
        // If the status check fails, fall back to letting the candidate through
        // rather than trapping them in the lobby indefinitely.
        setCheckState("passed");
        onVerified(null);
      } finally {
        setStatusLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  useEffect(() => {
    if (statusLoading) return;
    if (checkState === "passed" || checkState === "blocked") return;
    void startCamera();
    return () => stopStream();
  }, [statusLoading, checkState, startCamera, stopStream]);

  useEffect(() => () => stopStream(), [stopStream]);

  const captureAndVerify = useCallback(async () => {
    if (!videoRef.current || camState !== "ready") return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");

    // Task 3.2 — capture a high-resolution snapshot from the live feed.
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setCheckState("capturing");
    setMessage("");

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setCheckState("retry");
          setMessage("Could not capture a frame. Please try again.");
          return;
        }
        setCheckState("verifying");
        try {
          const result = await interviewService.verifyIdentity(interviewId, blob);
          setVerification(result.verification);
          setMessage(result.message);

          if (result.passed) {
            setCheckState("passed");
            if (keepStreamForRecording && streamRef.current) {
              // Hand off ownership of the live stream before React processes
              // this state update — otherwise the checkState-driven cleanup
              // effect below would stop it out from under the recorder.
              const handedOffStream = streamRef.current;
              streamRef.current = null;
              onVerified(handedOffStream);
            } else {
              stopStream();
              onVerified(null);
            }
          } else if (result.outcome === "attempts_exhausted" || result.verification.status === "blocked") {
            setCheckState("blocked");
            stopStream();
          } else {
            setCheckState("retry");
          }
        } catch {
          setCheckState("retry");
          setMessage("The verification service could not be reached. Please try again.");
        }
      },
      "image/jpeg",
      0.92
    );
  }, [camState, interviewId, keepStreamForRecording, onVerified, stopStream]);

  /* ── Not required / already passed — nothing to render ────────── */
  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (checkState === "passed") {
    return null;
  }

  const attemptsRemaining = verification?.attemptsRemaining ?? null;

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-6 animate-in fade-in duration-700">
      <Card hoverEffect={false} className="p-8 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black">
        <div className="text-center space-y-2 mb-6">
          <div className="w-16 h-16 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary dark:text-white">Identity Verification</h1>
          <p className="text-sm text-text-muted font-semibold">
            {candidateName ? `Hi ${candidateName}, before` : "Before"} you begin, we need to confirm it&apos;s really you on camera.
          </p>
        </div>

        {checkState === "blocked" ? (
          <div className="text-center space-y-4 py-6">
            <UserX className="w-12 h-12 text-danger mx-auto" />
            <p className="text-sm font-bold text-danger">{message || "Identity verification failed."}</p>
            <p className="text-xs text-text-muted">
              This attempt has been logged and flagged for the hiring team. Please reach out to them if you believe this is a mistake.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="relative aspect-video w-full rounded-md overflow-hidden bg-black/90 border border-white-light dark:border-[#1b2e4b]">
              {camState === "denied" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                  <CameraOff className="w-8 h-8 text-danger" />
                  <p className="text-xs font-semibold text-white">
                    Camera access was denied. Allow camera permissions in your browser and try again.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => void startCamera()} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
                    Retry Camera Access
                  </Button>
                </div>
              )}
              {camState === "unsupported" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                  <CameraOff className="w-8 h-8 text-danger" />
                  <p className="text-xs font-semibold text-white">Your browser does not support camera access.</p>
                </div>
              )}
              {camState === "requesting" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                  <p className="text-xs font-semibold text-white/80">Initializing webcam…</p>
                </div>
              )}
              <video
                ref={videoRef}
                muted
                playsInline
                className={cn("w-full h-full object-cover -scale-x-100", camState !== "ready" && "opacity-0")}
              />
              {(checkState === "capturing" || checkState === "verifying") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                  <p className="text-xs font-semibold text-white/90">
                    {checkState === "capturing" ? "Capturing frame…" : "Verifying identity…"}
                  </p>
                </div>
              )}
            </div>

            {message && checkState !== "capturing" && checkState !== "verifying" && (
              <div
                className={cn(
                  "flex items-start gap-2 p-3 rounded-md text-xs font-semibold",
                  checkState === "retry"
                    ? "bg-danger/10 text-danger border border-danger/20"
                    : "bg-primary/5 text-text-muted border border-primary/10"
                )}
              >
                <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )}

            {attemptsRemaining !== null && checkState === "retry" && (
              <p className="text-center text-[11px] text-text-muted font-medium">
                {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining
              </p>
            )}

            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={() => void captureAndVerify()}
                disabled={camState !== "ready" || checkState === "capturing" || checkState === "verifying"}
                isLoading={checkState === "capturing" || checkState === "verifying"}
                leftIcon={checkState === "retry" ? <RefreshCw className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              >
                {checkState === "retry" ? "Try Again" : "Verify My Identity"}
              </Button>
            </div>

            <p className="text-center text-[11px] text-text-muted opacity-70">
              Make sure you&apos;re alone, well-lit, and facing the camera directly.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
