import { useEffect, useMemo, useState } from "react";
import { Clock, Hourglass } from "lucide-react";
import { Card } from "../ui/Card";

interface InterviewWaitingRoomProps {
  scheduledAt: string;
  /** Milliseconds before scheduledAt the room automatically unlocks. Must match the backend's EARLY_JOIN_WINDOW_MS. */
  earlyJoinWindowMs: number;
  interviewTitle?: string;
  onWindowOpen: () => void;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Shown when a company-scheduled interview exists but its start window
 * (scheduledAt - earlyJoinWindowMs) hasn't opened yet. Automatically hands
 * off to the caller once the window opens — no manual refresh needed.
 */
export default function InterviewWaitingRoom({
  scheduledAt,
  earlyJoinWindowMs,
  interviewTitle,
  onWindowOpen,
}: InterviewWaitingRoomProps) {
  const opensAt = useMemo(() => new Date(scheduledAt).getTime() - earlyJoinWindowMs, [scheduledAt, earlyJoinWindowMs]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (now >= opensAt) {
      onWindowOpen();
    }
  }, [now, opensAt, onWindowOpen]);

  const remainingMs = opensAt - now;
  const scheduledDisplay = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(scheduledAt));

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-8 animate-in fade-in duration-700 text-black dark:text-white-dark">
      <Card hoverEffect={false} className="p-8 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black text-center space-y-6">
        <div className="w-16 h-16 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <Hourglass className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary dark:text-white">
            {interviewTitle || "Your interview"} isn&apos;t open yet
          </h1>
          <p className="text-sm text-text-muted font-semibold">
            This page will unlock automatically — no need to refresh.
          </p>
        </div>

        <div className="py-4">
          <p className="text-5xl font-mono font-bold text-primary tabular-nums">{formatCountdown(remainingMs)}</p>
          <p className="text-xs text-text-muted font-semibold uppercase tracking-widest mt-2">until this interview opens</p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-text-muted bg-primary/5 border border-primary/10 rounded-md py-3 px-4">
          <Clock className="w-4 h-4 text-primary flex-shrink-0" />
          <span>Scheduled for {scheduledDisplay}</span>
        </div>
      </Card>
    </div>
  );
}
