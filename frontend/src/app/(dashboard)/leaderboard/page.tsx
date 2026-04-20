"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Trophy,
  Crown,
  Medal,
  Star,
  TrendingUp,
  Loader2,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import userService from "@/services/userService";
import type { DashboardStats } from "@/types/user";

export default function LeaderboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userService.getDashboard().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.name ?? "user")}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Leaderboard</h1>
        <p className="text-sm text-text-muted font-medium">See how you rank among other interviewees</p>
      </div>

      {/* Your Stats */}
      <Card hoverEffect={false} className="p-6 border-primary/20 bg-primary/5 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-primary/30 bg-foreground/5">
            <Image src={user?.avatar || fallbackAvatar} alt={user?.name ?? "You"} width={56} height={56} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">{user?.name ?? "You"}</p>
            <p className="text-xs text-text-muted font-medium">{user?.targetRole || "Interview Candidate"}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{stats?.scores.average ?? 0}%</p>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Avg Score</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5">
          {[
            { label: "Completed", value: stats?.overview.completedInterviews ?? 0, icon: Trophy },
            { label: "Best Score", value: stats?.scores.highest ? `${stats.scores.highest}%` : "—", icon: Star },
            { label: "Reviewed", value: stats?.scores.totalReviewed ?? 0, icon: TrendingUp },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="text-center p-3 rounded-xl bg-white/50 dark:bg-foreground/[0.03] border border-border/20">
                <Icon className="w-4 h-4 text-primary mx-auto mb-1.5" />
                <p className="text-sm font-bold text-text-primary">{s.value}</p>
                <p className="text-[8px] font-bold text-text-muted uppercase tracking-widest">{s.label}</p>
              </div>
            );
          })}
        </div>
        <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
      </Card>

      {/* Ranking Tiers */}
      <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30">
        <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
          <Medal className="w-4 h-4 text-primary" /> Performance Tiers
        </h3>
        <div className="space-y-3">
          {[
            { tier: "Diamond", range: "90-100%", icon: Crown, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
            { tier: "Gold", range: "80-89%", icon: Trophy, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
            { tier: "Silver", range: "70-79%", icon: Medal, color: "text-text-muted", bg: "bg-foreground/5", border: "border-border/40" },
            { tier: "Bronze", range: "60-69%", icon: Star, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
            { tier: "Beginner", range: "0-59%", icon: TrendingUp, color: "text-text-muted", bg: "bg-foreground/5", border: "border-border/40" },
          ].map((t, i) => {
            const Icon = t.icon;
            const avg = stats?.scores.average ?? 0;
            const isCurrentTier =
              (t.tier === "Diamond" && avg >= 90) ||
              (t.tier === "Gold" && avg >= 80 && avg < 90) ||
              (t.tier === "Silver" && avg >= 70 && avg < 80) ||
              (t.tier === "Bronze" && avg >= 60 && avg < 70) ||
              (t.tier === "Beginner" && avg < 60);

            return (
              <motion.div
                key={t.tier}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border transition-all",
                  isCurrentTier ? `${t.bg} ${t.border} ring-2 ring-primary/20` : "border-border/20 bg-foreground/[0.02]"
                )}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", t.bg)}>
                  <Icon className={cn("w-5 h-5", t.color)} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-text-primary">{t.tier}</p>
                  <p className="text-[10px] text-text-muted font-medium">{t.range}</p>
                </div>
                {isCurrentTier && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] font-bold uppercase tracking-widest">
                    Your Tier
                  </Badge>
                )}
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* Community Leaderboard Coming Soon */}
      <Card hoverEffect={false} className="p-8 border-border/40 bg-surface/30 text-center">
        <Users className="w-12 h-12 text-text-muted/20 mx-auto mb-4" />
        <h3 className="text-sm font-semibold text-text-primary mb-1">Community Leaderboard Coming Soon</h3>
        <p className="text-xs text-text-muted font-medium max-w-sm mx-auto">
          We&apos;re building a global leaderboard so you can compete with other candidates. Stay tuned!
        </p>
      </Card>
    </div>
  );
}
