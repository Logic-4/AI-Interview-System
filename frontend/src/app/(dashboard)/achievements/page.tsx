"use client";

import React, { useState, useEffect } from "react";
import {
  Trophy,
  Star,
  Zap,
  Target,
  Award,
  Flame,
  Crown,
  Shield,
  Loader2,
  Lock,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import userService from "@/services/userService";
import type { DashboardStats } from "@/types/user";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  requirement: (stats: DashboardStats) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first-interview", title: "First Steps", description: "Complete your first interview",
    icon: Zap, color: "text-primary", bgColor: "bg-primary/10",
    requirement: (s) => s.overview.completedInterviews >= 1,
  },
  {
    id: "five-interviews", title: "Getting Started", description: "Complete 5 interviews",
    icon: Star, color: "text-warning", bgColor: "bg-warning/10",
    requirement: (s) => s.overview.completedInterviews >= 5,
  },
  {
    id: "ten-interviews", title: "Dedicated Learner", description: "Complete 10 interviews",
    icon: Award, color: "text-primary", bgColor: "bg-primary/10",
    requirement: (s) => s.overview.completedInterviews >= 10,
  },
  {
    id: "twenty-five-interviews", title: "Interview Veteran", description: "Complete 25 interviews",
    icon: Shield, color: "text-success", bgColor: "bg-success/10",
    requirement: (s) => s.overview.completedInterviews >= 25,
  },
  {
    id: "fifty-interviews", title: "Master Interviewer", description: "Complete 50 interviews",
    icon: Crown, color: "text-warning", bgColor: "bg-warning/10",
    requirement: (s) => s.overview.completedInterviews >= 50,
  },
  {
    id: "score-70", title: "Above Average", description: "Achieve an average score of 70%+",
    icon: Target, color: "text-success", bgColor: "bg-success/10",
    requirement: (s) => s.scores.average >= 70,
  },
  {
    id: "score-80", title: "High Performer", description: "Achieve an average score of 80%+",
    icon: Trophy, color: "text-warning", bgColor: "bg-warning/10",
    requirement: (s) => s.scores.average >= 80,
  },
  {
    id: "score-90", title: "Top Talent", description: "Achieve an average score of 90%+",
    icon: Crown, color: "text-primary", bgColor: "bg-primary/10",
    requirement: (s) => s.scores.average >= 90,
  },
  {
    id: "perfect-score", title: "Perfect Score", description: "Score 100 on any interview",
    icon: Flame, color: "text-danger", bgColor: "bg-danger/10",
    requirement: (s) => s.scores.highest >= 100,
  },
  {
    id: "high-score-95", title: "Near Perfect", description: "Score 95+ on any interview",
    icon: Star, color: "text-primary", bgColor: "bg-primary/10",
    requirement: (s) => s.scores.highest >= 95,
  },
  {
    id: "high-score-85", title: "Strong Finish", description: "Score 85+ on any interview",
    icon: Target, color: "text-success", bgColor: "bg-success/10",
    requirement: (s) => s.scores.highest >= 85,
  },
  {
    id: "reviewed-all", title: "Thorough Reviewer", description: "Have at least 5 reviewed interviews",
    icon: Award, color: "text-primary", bgColor: "bg-primary/10",
    requirement: (s) => s.scores.totalReviewed >= 5,
  },
];

export default function AchievementsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userService.getDashboard().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const unlocked = stats ? ACHIEVEMENTS.filter((a) => a.requirement(stats)) : [];
  const locked = stats ? ACHIEVEMENTS.filter((a) => !a.requirement(stats)) : ACHIEVEMENTS;

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Achievements</h1>
        <p className="text-sm text-text-muted font-medium">
          {unlocked.length}/{ACHIEVEMENTS.length} unlocked
        </p>
      </div>

      {/* Progress */}
      <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text-primary">{unlocked.length} of {ACHIEVEMENTS.length} Achievements</p>
            <div className="h-2 w-full bg-foreground/10 rounded-full overflow-hidden mt-2">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(unlocked.length / ACHIEVEMENTS.length) * 100}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Unlocked</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unlocked.map((a, i) => {
              const Icon = a.icon;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card hoverEffect className="p-4 border-primary/20 bg-surface/30">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", a.bgColor)}>
                        <Icon className={cn("w-5 h-5", a.color)} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-text-primary">{a.title}</p>
                        <p className="text-[10px] text-text-muted font-medium mt-0.5">{a.description}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Locked</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {locked.map((a) => (
              <Card key={a.id} hoverEffect={false} className="p-4 border-border/40 bg-surface/30 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-text-muted" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-muted">{a.title}</p>
                    <p className="text-[10px] text-text-muted font-medium mt-0.5">{a.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
