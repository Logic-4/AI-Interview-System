import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, Eye, X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ProctoringAlert } from "../../hooks/useProctoring";

interface Props {
  alert: ProctoringAlert | null;
  strikes: number;
  onDismiss: () => void;
}

export function ProctoringOverlay({ alert, strikes, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={cn(
            "fixed top-4 left-1/2 -translate-x-1/2 z-[10100]",
            "w-full max-w-md mx-auto px-4"
          )}
          role="alert"
          aria-live="assertive"
        >
          <div
            className={cn(
              "rounded-xl border shadow-2xl px-5 py-4 flex items-start gap-4",
              alert.severity === "final"
                ? "bg-danger/10 border-danger/40 text-danger"
                : "bg-warning/10 border-warning/40 text-warning"
            )}
          >
            <div className="flex-shrink-0 mt-0.5">
              {alert.severity === "final" ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-widest",
                    alert.severity === "final" ? "text-danger" : "text-warning"
                  )}
                >
                  {alert.severity === "final" ? "Session Flagged" : `Warning — Strike ${alert.strikeNumber}/3`}
                </span>
                <StrikeIndicator total={3} filled={strikes} severe={alert.severity === "final"} />
              </div>
              <p
                className={cn(
                  "text-sm font-semibold leading-snug",
                  alert.severity === "final"
                    ? "text-danger"
                    : "text-foreground dark:text-white"
                )}
              >
                {alert.message}
              </p>
            </div>

            <button
              onClick={onDismiss}
              className={cn(
                "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors opacity-60 hover:opacity-100",
                alert.severity === "final"
                  ? "hover:bg-danger/20"
                  : "hover:bg-warning/20"
              )}
              aria-label="Dismiss alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Strike indicator dots ────────────────────────────────────────── */
function StrikeIndicator({
  total,
  filled,
  severe,
}: {
  total: number;
  filled: number;
  severe: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full transition-all",
            i < filled
              ? severe
                ? "bg-danger"
                : "bg-warning"
              : "bg-foreground/20"
          )}
        />
      ))}
    </div>
  );
}

/* ── Compact proctoring status badge (for the top bar) ────────────── */
interface StatusBadgeProps {
  strikes: number;
  integrityScore: number;
  flaggedForReview: boolean;
  gazeActive: boolean;
}

export function ProctoringStatusBadge({
  strikes,
  integrityScore,
  flaggedForReview,
  gazeActive,
}: StatusBadgeProps) {
  if (strikes === 0 && !flaggedForReview) return null;

  return (
    <div
      title={`Integrity score: ${integrityScore}% — ${flaggedForReview ? "Flagged for review" : `${strikes} strike${strikes !== 1 ? "s" : ""}`}`}
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-widest",
        flaggedForReview
          ? "bg-danger/10 border-danger/30 text-danger"
          : "bg-warning/10 border-warning/30 text-warning"
      )}
    >
      {flaggedForReview ? (
        <ShieldAlert className="w-3 h-3" />
      ) : (
        <Eye className="w-3 h-3" />
      )}
      <span>
        {flaggedForReview ? "Flagged" : `${strikes} Strike${strikes !== 1 ? "s" : ""}`}
      </span>
    </div>
  );
}
