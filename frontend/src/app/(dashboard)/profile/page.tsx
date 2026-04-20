"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Loader2,
  Briefcase,
  Target,
  Clock,
  Trophy,
  BarChart3,
  Calendar,
  Settings,
  Star,
  TrendingUp,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import userService from "@/services/userService";
import type { DashboardStats } from "@/types/user";

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userService.getDashboard().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.name ?? "user")}`;
  const avatarSrc = user?.avatar || fallbackAvatar;
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "N/A";

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6 animate-in fade-in duration-500">
      {/* Hero */}
      <Card hoverEffect={false} className="p-8 border-border/40 bg-surface/30 backdrop-blur-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary/20 bg-foreground/5 shadow-lg shadow-primary/10">
            <Image src={avatarSrc} alt={user?.name ?? "User"} width={96} height={96} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">{user?.name ?? "User"}</h1>
            <p className="text-sm text-text-muted font-medium mt-0.5">{user?.email}</p>
            {user?.bio && <p className="text-xs text-text-muted font-medium mt-2 leading-relaxed max-w-lg">{user.bio}</p>}
            <div className="flex items-center gap-2 mt-3 flex-wrap justify-center sm:justify-start">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold uppercase tracking-widest">
                {user?.subscription?.plan ?? "free"} plan
              </Badge>
              {user?.targetRole && (
                <Badge className="bg-foreground/5 text-text-muted border-border/40 text-[9px] font-bold uppercase tracking-widest">
                  <Briefcase className="w-2.5 h-2.5 mr-1" /> {user.targetRole}
                </Badge>
              )}
              {user?.experienceLevel && (
                <Badge className="bg-foreground/5 text-text-muted border-border/40 text-[9px] font-bold uppercase tracking-widest capitalize">
                  <TrendingUp className="w-2.5 h-2.5 mr-1" /> {user.experienceLevel}
                </Badge>
              )}
            </div>
          </div>
          <Link href="/settings">
            <Button variant="outline" className="h-9 px-4 rounded-lg text-xs font-bold text-text-primary border-border/40">
              <Settings className="w-3.5 h-3.5 mr-2" /> Edit Profile
            </Button>
          </Link>
        </div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      </Card>

      {/* Stats */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Interviews", value: stats.overview.totalInterviews, icon: BarChart3, color: "text-primary" },
              { label: "Completed", value: stats.overview.completedInterviews, icon: Trophy, color: "text-success" },
              { label: "Avg Score", value: stats.scores.average ? `${stats.scores.average}%` : "—", icon: Star, color: "text-warning" },
              { label: "Highest Score", value: stats.scores.highest ? `${stats.scores.highest}%` : "—", icon: Target, color: "text-primary" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label} hoverEffect={false} className="p-5 border-border/40 bg-surface/30 text-center">
                  <Icon className={cn("w-5 h-5 mx-auto mb-2", s.color)} />
                  <p className="text-lg font-bold text-text-primary">{s.value}</p>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">{s.label}</p>
                </Card>
              );
            })}
          </div>

          {/* Score Trend */}
          {stats.scoreTrend.length > 0 && (
            <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30">
              <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Score Trend
              </h3>
              <div className="flex items-end gap-1.5 h-32">
                {stats.scoreTrend.slice(-20).map((item, i) => {
                  const score = item.overallScore ?? 0;
                  return (
                    <motion.div
                      key={item._id}
                      className="flex-1 flex flex-col items-center gap-1"
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <span className="text-[8px] font-bold text-text-muted">{score}</span>
                      <div
                        className={cn(
                          "w-full rounded-t-sm min-h-[4px]",
                          score >= 80 ? "bg-success" : score >= 60 ? "bg-warning" : "bg-danger"
                        )}
                        style={{ height: `${Math.max(score, 5)}%` }}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      ) : null}

      {/* Skills */}
      {user?.skills && user.skills.length > 0 && (
        <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30">
          <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Skills
          </h3>
          <div className="flex flex-wrap gap-2">
            {user.skills.map((skill) => (
              <Badge key={skill} className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                {skill}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Member Info */}
      <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30">
        <div className="flex items-center gap-3 text-xs text-text-muted font-medium">
          <Calendar className="w-4 h-4" />
          Member since {memberSince}
          <span className="mx-2 text-border">•</span>
          <Clock className="w-4 h-4" />
          {user?.interviewCount ?? 0} interviews taken
        </div>
      </Card>
    </div>
  );
}
