"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Star, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import feedbackService from "@/services/feedbackService";
import { UserProgress, ProgressPeriod } from "@/types/feedback";
import { Button } from "@/components/ui/Button";
import { DOMAIN_LABELS } from "@/lib/constants";

const PERIOD_MAP: Record<string, ProgressPeriod> = { "1W": "7d", "1M": "30d", "1Y": "365d" };

function buildSvgPath(scores: number[]) {
  if (!scores.length) return { linePath: "", fillPath: "", points: [] as { x: number; y: number }[] };
  const N = scores.length;
  const points = scores.map((s, i) => ({
    x: N === 1 ? 500 : Math.round((i / (N - 1)) * 1000),
    y: Math.round(20 + (1 - s / 100) * 210),
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
  const fillPath = `${linePath} L ${points[points.length - 1].x},250 L 0,250 Z`;
  return { linePath, fillPath, points };
}

function getRadarPoints(avgs: UserProgress["averages"]) {
  const center = 100;
  const maxR = 80;
  const tech = (avgs.technicalAccuracy / 100) * maxR;
  const comm = (avgs.communication / 100) * maxR;
  const conf = (avgs.confidence / 100) * maxR;
  const prob = (avgs.problemSolving / 100) * maxR;
  return [
    `${center},${center - tech}`,
    `${center + conf},${center}`,
    `${center},${center + comm}`,
    `${center - prob},${center}`,
  ].join(" ");
}

function getScoreColor(score: number) {
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-warning";
  return "bg-danger";
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"1W" | "1M" | "1Y">("1M");
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    feedbackService
      .getUserProgress(PERIOD_MAP[timeRange])
      .then(setProgress)
      .catch(() => setError("Failed to load analytics data. Please try again."))
      .finally(() => setLoading(false));
  }, [timeRange]);

  const chart = useMemo(
    () => buildSvgPath(progress?.timeline.map((t) => t.overallScore) ?? []),
    [progress]
  );

  const domainBars = useMemo(() => {
    const items = progress?.domainActivity ?? [];
    if (!items.length) return [];
    const maxCount = Math.max(...items.map((d) => d.count), 1);
    return items.slice(0, 5).map((d) => ({
      label: DOMAIN_LABELS[d.domain] ?? d.domain,
      count: d.count,
      percent: Math.round((d.count / maxCount) * 100),
    }));
  }, [progress]);

  const xLabels = useMemo(() => {
    const items = progress?.timeline ?? [];
    if (!items.length) return [];
    const step = Math.max(1, Math.floor(items.length / 4));
    return items
      .filter((_, i) => i % step === 0 || i === items.length - 1)
      .map((t) =>
        new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      );
  }, [progress]);

  const statCards = [
    {
      icon: Star,
      label: "Average Score",
      value: progress ? `${progress.averages.overall}%` : "--",
      iconColor: "text-primary",
    },
    {
      icon: CheckCircle2,
      label: "Interviews Reviewed",
      value: progress ? String(progress.totalInterviewsReviewed) : "--",
      iconColor: "text-success",
    },
    {
      icon: Star,
      label: "Technical Accuracy",
      value: progress ? `${progress.averages.technicalAccuracy}%` : "--",
      iconColor: "text-purple-400",
    },
    {
      icon: Star,
      label: "Communication",
      value: progress ? `${progress.averages.communication}%` : "--",
      iconColor: "text-orange-400",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1 text-text-primary">Progress Analytics</h1>
          <p className="text-[13px] font-medium text-text-muted">Track your performance and skill evolution</p>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="p-5 border-border/40 bg-surface/30 hover:bg-surface/50 transition-colors cursor-default">
            <div className="flex justify-between items-start mb-4">
              <div className={cn("w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center border border-border/40", stat.iconColor)}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-1">{stat.label}</p>
              <div className="text-2xl font-black text-text-primary">
                {loading ? <span className="text-text-muted text-lg">—</span> : stat.value}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Score Improvement Chart */}
      <Card className="p-6 border-border/40 bg-surface/30">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-sm font-bold text-text-primary mb-1">Score Improvement Over Time</h3>
            <p className="text-[11px] font-medium text-text-muted">
              {progress?.timeline.length
                ? `${progress.timeline.length} data points in selected period`
                : "Performance trend across all sessions"}
            </p>
          </div>
          <div className="flex items-center bg-foreground/5 p-1 rounded-lg border border-border/40">
            {(["1W", "1M", "1Y"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-3 py-1 text-[11px] font-bold rounded-md transition-all",
                  timeRange === range ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text-primary"
                )}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-[250px] relative">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="md" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <p className="text-danger text-sm font-semibold">{error}</p>
              <Button variant="outline" onClick={() => setTimeRange(timeRange)} className="text-xs text-text-primary border-border/40">Retry</Button>
            </div>
          ) : !chart.points.length ? (
            <div className="flex items-center justify-center h-full text-sm font-medium text-text-muted">
              No data for this period. Complete interviews to see your progress.
            </div>
          ) : (
            <>
              <svg className="w-full h-full" viewBox="0 0 1000 250" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 50, 100, 150, 200, 250].map((y) => (
                  <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="currentColor" className="text-foreground/10" strokeWidth="1" />
                ))}
                <path
                  d={chart.linePath}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)]"
                />
                <path d={chart.fillPath} fill="url(#chartGradient)" />
                {chart.points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="4" className="fill-surface stroke-primary" strokeWidth="2" />
                ))}
              </svg>
              {xLabels.length > 0 && (
                <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  {xLabels.map((l, i) => <span key={i}>{l}</span>)}
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
        {/* Skill Proficiency Radar */}
        <Card className="p-6 border-border/40 bg-surface/30 flex flex-col items-center">
          <div className="w-full text-left mb-6">
            <h3 className="text-sm font-bold text-text-primary mb-1">Skill Proficiency</h3>
            <p className="text-[11px] font-medium text-text-muted">Technical vs. Soft Skills balance</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <LoadingSpinner size="md" />
            </div>
          ) : !progress ? (
            <div className="flex items-center justify-center h-48 text-sm text-text-muted">No data available</div>
          ) : (
            <>
              <div className="relative w-full max-w-[260px] aspect-square flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                  <polygon points="100,20 180,100 100,180 20,100" fill="none" stroke="currentColor" className="text-foreground/5" strokeWidth="1" />
                  <polygon points="100,40 160,100 100,160 40,100" fill="none" stroke="currentColor" className="text-foreground/5" strokeWidth="1" />
                  <polygon points="100,60 140,100 100,140 60,100" fill="none" stroke="currentColor" className="text-foreground/5" strokeWidth="1" />
                  <polygon points="100,80 120,100 100,120 80,100" fill="none" stroke="currentColor" className="text-foreground/5" strokeWidth="1" />
                  <line x1="100" y1="20" x2="100" y2="180" stroke="currentColor" className="text-foreground/5" strokeWidth="1" />
                  <line x1="20" y1="100" x2="180" y2="100" stroke="currentColor" className="text-foreground/5" strokeWidth="1" />
                  <polygon
                    points={getRadarPoints(progress.averages)}
                    fill="rgba(var(--primary-rgb),0.2)"
                    stroke="var(--primary)"
                    strokeWidth="2"
                    className="drop-shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                  />
                  {getRadarPoints(progress.averages).split(" ").map((pt, i) => {
                    const [cx, cy] = pt.split(",").map(Number);
                    return <circle key={i} cx={cx} cy={cy} r="3" className="fill-primary" />;
                  })}
                </svg>
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-text-muted uppercase tracking-widest">Technical</span>
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-text-muted uppercase tracking-widest">Communication</span>
                <span className="absolute -right-12 top-1/2 -translate-y-1/2 text-[9px] font-bold text-text-muted uppercase tracking-widest">Confidence</span>
                <span className="absolute -left-[60px] top-1/2 -translate-y-1/2 text-[9px] font-bold text-text-muted uppercase tracking-widest">Prob Solving</span>
              </div>

              <div className="w-full grid grid-cols-2 gap-3 mt-8">
                {[
                  { label: "Technical", value: progress.averages.technicalAccuracy },
                  { label: "Communication", value: progress.averages.communication },
                  { label: "Problem Solving", value: progress.averages.problemSolving },
                  { label: "Confidence", value: progress.averages.confidence },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] font-semibold">
                    <span className="text-text-muted">{s.label}</span>
                    <span className="text-text-primary">{s.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Interview Activity by Domain */}
        <Card className="p-6 border-border/40 bg-surface/30">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-1">Interview Activity</h3>
              <p className="text-[11px] font-medium text-text-muted">Volume by job category (all-time)</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <LoadingSpinner size="md" />
            </div>
          ) : !domainBars.length ? (
            <div className="flex items-center justify-center h-32 text-sm text-text-muted">
              No interview activity yet.
            </div>
          ) : (
            <div className="space-y-6">
              {domainBars.map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-text-primary">{item.label}</span>
                    <span className="text-text-muted">{item.count} Session{item.count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-2 w-full bg-foreground/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percent}%` }}
                      transition={{ duration: 1, delay: 0.1 * i }}
                      className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)]"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Detailed Insights Table */}
      <Card className="p-1 border-border/40 bg-surface/30 mt-4 overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-border/40">
          <h3 className="text-sm font-bold text-text-primary">Recent Detailed Insights</h3>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="md" />
            </div>
          ) : !progress?.recentInsights?.length ? (
            <div className="py-12 text-center text-sm font-medium text-text-muted">
              Complete interviews and generate feedback to see insights here.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-foreground/[0.02] border-b border-border/40">
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Role</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Date</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Core Strength</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Improvement Area</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-text-muted">Overall Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 whitespace-nowrap">
                {progress.recentInsights.map((row) => {
                  const strength = row.strengths?.[0] ?? "—";
                  const improvement = row.improvements?.[0] ?? "—";
                  const scoreColor = getScoreColor(row.overallScore);
                  return (
                    <tr key={row._id} className="hover:bg-foreground/[0.02] transition-colors group">
                      <td className="px-6 py-5">
                        <span className="text-sm font-bold text-text-primary">{row.interview?.title ?? "Untitled"}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-xs font-semibold text-text-muted">
                          {new Date(row.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase text-success bg-success/10 max-w-[160px] truncate inline-block">
                          {strength}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase text-warning bg-warning/10 max-w-[160px] truncate inline-block">
                          {improvement}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                            <div className={cn("h-full rounded-full", scoreColor)} style={{ width: `${row.overallScore}%` }} />
                          </div>
                          <span className="text-xs font-bold text-text-primary tabular-nums">{row.overallScore}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
