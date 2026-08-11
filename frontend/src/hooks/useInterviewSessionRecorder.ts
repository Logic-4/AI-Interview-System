import { useCallback, useEffect, useRef, useState } from "react";
import interviewService from "../services/interviewService";

type RecorderStatus = "idle" | "recording" | "stopped" | "error";

// How often MediaRecorder flushes a chunk via ondataavailable. Each chunk is
// uploaded once, immediately, and never re-sent — see backend/services/recordingService.js
// for why simple byte-concatenation of these chunks reconstructs a valid file.
const CHUNK_INTERVAL_MS = 60_000;

function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";
}

/**
 * Records the live interview session (video + audio) for company-scheduled
 * interviews the candidate has consented to. Does not manage camera
 * permission itself — call `attachStream` with a MediaStream obtained
 * elsewhere (the identity-verification lobby hands one off once the
 * candidate passes the face check).
 *
 * Recording failures are non-fatal by design: a candidate's interview must
 * never be blocked or interrupted because a webcam recording upload failed.
 */
export function useInterviewSessionRecorder(interviewId: string) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIndexRef = useRef(0);
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const attachStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
  }, []);

  const queueChunkUpload = useCallback(
    (blob: Blob) => {
      if (!blob.size) return;
      const index = chunkIndexRef.current++;
      uploadQueueRef.current = uploadQueueRef.current
        .then(() => interviewService.uploadRecordingChunk(interviewId, index, blob))
        .catch(() => {
          setError("Part of the session recording could not be uploaded.");
        });
    },
    [interviewId]
  );

  const start = useCallback(() => {
    if (recorderRef.current || !streamRef.current) return;
    try {
      const recorder = new MediaRecorder(streamRef.current, {
        mimeType: pickMimeType(),
        videoBitsPerSecond: 250_000,
        audioBitsPerSecond: 64_000,
      });
      recorder.ondataavailable = (event) => queueChunkUpload(event.data);
      recorder.onerror = () => setError("Session recording stopped unexpectedly.");
      recorder.start(CHUNK_INTERVAL_MS);
      recorderRef.current = recorder;
      setStatus("recording");
    } catch {
      setError("Could not start session recording.");
      setStatus("error");
    }
  }, [queueChunkUpload]);

  /** Stops recording, flushes the final chunk, and waits for all uploads to finish. */
  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;

    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
        try {
          recorder.stop();
        } catch {
          resolve();
        }
      });
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    // ponytail: 15s timeout so recorder.stop() can never hang wrapUp indefinitely
    await Promise.race([
      uploadQueueRef.current.catch(() => {}),
      new Promise<void>((resolve) => setTimeout(resolve, 15_000)),
    ]);
    setStatus("stopped");
  }, []);

  // Safety net — release the camera if the page unmounts mid-session
  // (navigation away, error boundary, etc.) without an explicit stop().
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  /** Returns the attached MediaStream so callers can use it for gaze tracking etc. */
  const getStream = useCallback(() => streamRef.current, []);

  return { attachStream, start, stop, status, error, getStream };
}
