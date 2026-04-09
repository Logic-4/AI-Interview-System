"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  ChevronRight,
  Lightbulb,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuthStore } from "@/stores/authStore";
import userService from "@/services/userService";
import { DashboardStats, ScoreTrendItem } from "@/types/user";

const DAILY_TIPS = [
  { title: "STAR Method", body: "When answering behavioral questions, use the STAR method: Situation, Task, Action, and Result. This gives interviewers a clear and structured narrative." },
  { title: "Think Out Loud", body: "During technical interviews, narrate your thought process. Interviewers value your problem-solving approach as much as the final answer." },
  { title: "Ask Clarifying Questions", body: "Before diving into a solution, ask clarifying questions. This demonstrates critical thinking and ensures you're solving the right problem." },
  { title: "Prepare Your Stories", body: "Have 5–7 concrete stories from your experience ready, each demonstrating skills like leadership, conflict resolution, or technical excellence." },
  { title: "Research the Company", body: "Spend time understanding the company's tech stack, culture, and recent news. Tailored answers show genuine interest and improve your chances." },
  { title: "Practice Conciseness", body: "Aim to answer within 2 minutes unless asked to elaborate. Clear, concise answers signal strong communication skills to interviewers." },
  { title: "Follow-Up Questions", body: "End interviews by asking thoughtful questions about the team and tech challenges. It signals initiative and genuine interest in the role." },
];

function getDailyTip() {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % DAILY_TIPS.length;
  return DAILY_TIPS[dayIndex];
}

function computeScoreTrend(scoreTrend: ScoreTrendItem[]): { pct: number; positive: boolean } | null {
  if (scoreTrend.length < 2) return null;
  const mid = Math.floor(scoreTrend.length / 2);
  const older = scoreTrend.slice(0, mid);
  const newer = scoreTrend.slice(mid);
  const avgOlder = older.reduce((s, t) => s + t.overallScore, 0) / older.length;
  const avgNewer = newer.reduce((s, t) => s + t.overallScore, 0) / newer.length;
  if (avgOlder === 0) return null;
  const pct = Math.round(((avgNewer - avgOlder) / avgOlder) * 100);
  return { pct: Math.abs(pct), positive: pct >= 0 };
}

function getStatusBadge(status: string, score: number | null) {
  if (status === "completed") {
    if (score !== null && score >= 70) return { label: "Passed", className: "bg-success/10 text-success border-success/20" };
    if (score !== null) return { label: "Needs Practice", className: "bg-warning/10 text-warning border-warning/20" };
    return { label: "Completed", className: "bg-success/10 text-success border-success/20" };
  }
  if (status === "in-progress") return { label: "In Progress", className: "bg-primary/10 text-primary border-primary/20" };
  if (status === "scheduled") return { label: "Scheduled", className: "bg-foreground/5 text-text-muted border-border/40" };
  return { label: "Incomplete", className: "bg-foreground/5 text-text-muted border-border/40" };
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [dashData, setDashData] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    userService
      .getDashboard()
      .then(setDashData)
      .catch(() => setError("Failed to load dashboard data. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const tip = getDailyTip();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const scoreTrend = React.useMemo(() => computeScoreTrend(dashData?.scoreTrend ?? []), [dashData]);

  const chartBars = React.useMemo(() => {
    if (!dashData?.scoreTrend?.length) return [];
    const items = dashData.scoreTrend.slice(-6);
    const maxScore = Math.max(...items.map((t) => t.overallScore), 1);
    return items.map((t, i) => ({
      height: `${Math.round((t.overallScore / maxScore) * 100)}%`,
      isLast: i === items.length - 1,
      score: t.overallScore,
    }));
  }, [dashData]);

  const categoryAvgs = React.useMemo(() => {
    if (!dashData?.scoreTrend?.length) return { communication: null, technical: null };
    let commSum = 0, techSum = 0, count = 0;
    dashData.scoreTrend.forEach((t) => {
      if (t.categories?.communication?.score !== undefined) {
        commSum += t.categories.communication.score;
        techSum += t.categories.technicalAccuracy?.score ?? 0;
        count++;
      }
    });
    if (!count) return { communication: null, technical: null };
    return {
      communication: Math.round(commSum / count),
      technical: Math.round(techSum / count),
    };
  }, [dashData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-danger text-sm font-semibold">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()} className="text-xs">
          Retry
        </Button>
      </div>
    );
  }

  const statCards = [
    {
      id: 1,
      label: "Total Interviews",
      icon: Briefcase,
      value: String(dashData?.overview.totalInterviews ?? 0),
      trend: scoreTrend ? `${scoreTrend.positive ? "+" : "-"}${scoreTrend.pct}%` : null,
      trendPositive: scoreTrend?.positive ?? true,
    },
    {
      id: 2,
      label: "Avg Score",
      icon: Star,
      value: `${dashData?.scores.average ?? 0}/100`,
      trend: dashData?.scores.highest ? `Best: ${dashData.scores.highest}` : null,
      trendPositive: true,
    },
    {
      id: 3,
      label: "Completed",
      icon: CheckCircle2,
      value: String(dashData?.overview.completedInterviews ?? 0),
      subValue: dashData?.overview.inProgressInterviews
        ? `${dashData.overview.inProgressInterviews} active`
        : undefined,
      trend: null,
      trendPositive: true,
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-1 text-text-primary">Welcome back, {firstName}!</h1>
          <p className="text-text-muted font-medium">
            {(dashData?.overview.completedInterviews ?? 0) > 0
              ? `You've completed ${dashData!.overview.completedInterviews} interview${dashData!.overview.completedInterviews !== 1 ? "s" : ""}. Keep the momentum going!`
              : "Start your first interview to track your progress!"}
          </p>
        </div>
        <Link href="/interviews/new">
          <Button size="lg" className="h-12 rounded-xl px-6 font-bold shadow-lg shadow-primary/20 group">
            <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
            Start New Interview
          </Button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.id} className="p-6 border-border/40 bg-surface/30 backdrop-blur-xl relative group overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center text-text-muted group-hover:text-primary transition-colors">
                <stat.icon className="w-5 h-5" />
              </div>
              {stat.trend && (
                <div
                  className={`flex items-center text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-widest ${
                    stat.trendPositive ? "text-success bg-success/10" : "text-danger bg-danger/10"
                  }`}
                >
                  {stat.trendPositive ? (
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  )}
                  {stat.trend}
                </div>
              )}
            </div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-[0.2em] mb-1">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-semibold text-text-primary">{stat.value}</h3>
              {"subValue" in stat && stat.subValue && (
                <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">
                  {stat.subValue}
                </span>
              )}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent group-hover:via-primary/50 transition-all duration-500" />
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Results Table */}
        <Card className="lg:col-span-2 border-border/40 bg-surface/30 backdrop-blur-xl overflow-hidden">
          <div className="p-6 border-b border-border/40 flex items-center justify-between">
            <h3 className="text-lg font-semibold tracking-tight text-text-primary">Recent Interview Results</h3>
            <Link href="/interviews" className="text-primary text-xs font-semibold uppercase tracking-widest hover:underline">
              View All
            </Link>
          </div>
          {!dashData?.recentInterviews?.length ? (
            <div className="px-6 py-12 text-center text-sm font-medium text-text-muted">
              No interviews yet. Start your first one!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-foreground/[0.02]">
                    <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Date</th>
                    <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Title</th>
                    <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Status</th>
                    <th className="px-6 py-4 text-[10px] font-semibold text-text-muted uppercase tracking-[0.2em]">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {dashData.recentInterviews.map((iv) => {
                    const badge = getStatusBadge(iv.status, iv.overallScore);
                    return (
                      <tr key={iv._id} className="group hover:bg-foreground/[0.02] transition-colors cursor-pointer">
                        <td className="px-6 py-5 text-sm font-bold text-text-muted group-hover:text-text-secondary transition-colors">
                          {new Date(iv.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-5 text-sm font-semibold tracking-tight text-text-primary">{iv.title}</td>
                        <td className="px-6 py-5">
                          <Badge className={`font-semibold uppercase tracking-widest text-[9px] ${badge.className}`}>
                            {badge.label}
                          </Badge>
                        </td>
                        <td className="px-6 py-5 text-sm font-semibold tracking-tighter text-text-primary">
                          {iv.overallScore !== null ? `${iv.overallScore}/100` : "--"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Score Progress Chart */}
        <Card className="border-border/40 bg-surface/30 backdrop-blur-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold tracking-tight text-text-primary">Score Progress</h3>
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
              Last {dashData?.scoreTrend?.length ?? 0} Reviews
            </span>
          </div>

          {!chartBars.length ? (
            <div className="h-48 flex items-center justify-center text-sm font-medium text-text-muted">
              No score data yet
            </div>
          ) : (
            <div className="h-48 flex items-end justify-between gap-3 px-2">
              {chartBars.map((bar, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-3 h-full justify-end group"
                  title={`Score: ${bar.score}/100`}
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: bar.height }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                    className="w-full bg-primary/20 rounded-t-lg group-hover:bg-primary/40 transition-colors relative"
                  >
                    {bar.isLast && (
                      <div className="absolute -top-1 w-full h-1 bg-primary rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)]" />
                    )}
                  </motion.div>
                </div>
              ))}
            </div>
          )}

          {(categoryAvgs.technical !== null || categoryAvgs.communication !== null) && (
            <div className="space-y-4 pt-4 border-t border-border/40">
              {categoryAvgs.technical !== null && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <span className="text-xs font-bold text-text-muted">Technical Accuracy</span>
                  </div>
                  <span className="text-xs font-semibold text-text-primary">{categoryAvgs.technical}%</span>
                </div>
              )}
              {categoryAvgs.communication !== null && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-success" />
                    <span className="text-xs font-bold text-text-muted">Communication</span>
                  </div>
                  <span className="text-xs font-semibold text-text-primary">{categoryAvgs.communication}%</span>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Tip of the Day Card */}
      <Card className="p-8 border-border/40 bg-gradient-to-r from-primary/10 via-surface/30 to-secondary/5 backdrop-blur-xl relative overflow-hidden group">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start md:items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white shadow-2xl shadow-primary/40 group-hover:scale-110 transition-transform duration-500">
              <Lightbulb className="w-8 h-8 fill-white/20" />
            </div>
            <div className="space-y-1 max-w-2xl">
              <h4 className="text-xl font-semibold tracking-tight text-text-primary">Tip of the day: {tip.title}</h4>
              <p className="text-sm font-medium text-text-muted leading-relaxed">{tip.body}</p>
            </div>
          </div>
          <Link href="/questions">
            <Button
              variant="outline"
              className="h-12 rounded-xl group px-6 border-border/40 hover:bg-foreground/5 font-semibold uppercase tracking-widest text-xs"
            >
              Practice Now
              <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
        <div className="absolute top-0 right-0 w-64 h-full bg-primary/5 blur-[80px] -rotate-45 translate-x-1/2 pointer-events-none" />
      </Card>
    </div>
  );
}
