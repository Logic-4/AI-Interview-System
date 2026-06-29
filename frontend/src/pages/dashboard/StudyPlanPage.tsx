import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Target,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  ArrowRight,
  BarChart3,
  Lightbulb,
  Play,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { Progress } from "../../components/ui/Progress";
import { cn } from "../../lib/utils";
import feedbackService from "../../services/feedbackService";
import type { UserProgress } from "../../types/feedback";

interface StudyArea {
  name: string;
  score: number;
  priority: "high" | "medium" | "low";
  tip: string;
}

function generateStudyPlan(progress: UserProgress): { areas: StudyArea[]; weeklyGoal: number; streakTarget: number } {
  const avg = progress.averages;
  const areas: StudyArea[] = [];

  const categories: { key: keyof typeof avg; label: string; tip: string }[] = [
    { key: "communication", label: "Communication", tip: "Practice explaining technical concepts in simple terms. Use the STAR method for behavioral questions." },
    { key: "technicalAccuracy", label: "Technical Accuracy", tip: "Review core fundamentals and common algorithms. Practice coding problems daily." },
    { key: "problemSolving", label: "Problem Solving", tip: "Break down complex problems into smaller steps. Think aloud during interviews." },
    { key: "codeQuality", label: "Code Quality", tip: "Focus on clean code principles, naming conventions, and edge case handling." },
    { key: "confidence", label: "Confidence", tip: "Record yourself answering questions and review. Practice with mock interviews regularly." },
  ];

  for (const cat of categories) {
    const score = avg[cat.key] ?? 0;
    const priority = score < 50 ? "high" : score < 70 ? "medium" : "low";
    areas.push({ name: cat.label, score, priority, tip: cat.tip });
  }

  areas.sort((a, b) => a.score - b.score);

  const weeklyGoal = progress.totalInterviewsReviewed < 5 ? 3 : progress.totalInterviewsReviewed < 20 ? 5 : 7;
  const streakTarget = 7;

  return { areas, weeklyGoal, streakTarget };
}

export default function StudyPlanPage() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    feedbackService.getUserProgress("30d")
      .then(setProgress)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const plan = progress ? generateStudyPlan(progress) : null;
  const overallAvg = progress ? Math.round(progress.averages.overall) : 0;

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6 animate-in fade-in duration-500 text-black dark:text-white-dark">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary dark:text-white">Study Plan</h1>
        <p className="text-sm text-text-muted font-semibold">Personalized recommendations based on your interview performance</p>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card hoverEffect={false} className="p-5 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black text-center">
          <Progress variant="circular" size="lg" value={overallAvg} showValue color={overallAvg >= 70 ? "success" : overallAvg >= 50 ? "warning" : "danger"} gradient={false} />
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-3">Overall Score</p>
        </Card>
        <Card hoverEffect={false} className="p-5 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black flex flex-col items-center justify-center">
          <BarChart3 className="w-6 h-6 text-primary mb-2" />
          <p className="text-lg font-bold text-text-primary dark:text-white">{progress?.totalInterviewsReviewed ?? 0}</p>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Interviews Reviewed</p>
        </Card>
        <Card hoverEffect={false} className="p-5 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black flex flex-col items-center justify-center">
          <Target className="w-6 h-6 text-primary mb-2" />
          <p className="text-lg font-bold text-text-primary dark:text-white">{plan?.weeklyGoal ?? 3}/week</p>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Recommended Goal</p>
        </Card>
      </div>

      {/* Focus Areas */}
      {plan && plan.areas.length > 0 && (
        <Card hoverEffect={false} className="p-6 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black">
          <h3 className="text-sm font-bold text-text-primary dark:text-white mb-5 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" /> Focus Areas
          </h3>
          <div className="space-y-4">
            {plan.areas.map((area, i) => (
              <motion.div
                key={area.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-4 rounded-md border border-white-light dark:border-[#1b2e4b] bg-white-light/30 dark:bg-[#1a2941]/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold",
                      area.priority === "high" ? "bg-danger/10 text-danger" :
                      area.priority === "medium" ? "bg-warning/10 text-warning" :
                      "bg-success/10 text-success"
                    )}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-text-primary dark:text-white">{area.name}</p>
                      <Badge className={cn(
                        "text-[8px] font-bold uppercase tracking-widest mt-0.5",
                        area.priority === "high" ? "bg-danger/10 text-danger border-danger/20" :
                        area.priority === "medium" ? "bg-warning/10 text-warning border-warning/20" :
                        "bg-success/10 text-success border-success/20"
                      )}>
                        {area.priority} priority
                      </Badge>
                    </div>
                  </div>
                  <span className={cn(
                    "text-sm font-bold",
                    area.score >= 70 ? "text-success" : area.score >= 50 ? "text-warning" : "text-danger"
                  )}>
                    {area.score}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white-light dark:bg-[#1b2e4b] rounded-full overflow-hidden">
                  <motion.div
                    className={cn(
                      "h-full rounded-full",
                      area.score >= 70 ? "bg-success" : area.score >= 50 ? "bg-warning" : "bg-danger"
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${area.score}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                  />
                </div>
                <p className="text-[11px] text-text-muted font-semibold leading-relaxed flex items-start gap-2">
                  <Zap className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                  {area.tip}
                </p>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      {/* Recommended Actions */}
      <Card hoverEffect={false} className="p-6 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black">
        <h3 className="text-sm font-bold text-text-primary dark:text-white mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" /> Recommended Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link to="/interviews/new" className="block">
            <div className="p-4 rounded-md border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors group">
              <div className="flex items-center gap-3">
                <Play className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-text-primary dark:text-white">Start a Practice Interview</p>
                  <p className="text-[10px] text-text-muted font-semibold mt-0.5">Focus on your weakest areas</p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
          <Link to="/questions" className="block">
            <div className="p-4 rounded-md border border-white-light dark:border-[#1b2e4b] bg-white-light/30 dark:bg-[#1a2941]/30 hover:bg-white-light/50 dark:hover:bg-[#1b2e4b]/50 transition-colors group">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-text-primary dark:text-white">Browse Practice Questions</p>
                  <p className="text-[10px] text-text-muted font-semibold mt-0.5">Study sample answers and tips</p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
          <Link to="/analytics" className="block">
            <div className="p-4 rounded-md border border-white-light dark:border-[#1b2e4b] bg-white-light/30 dark:bg-[#1a2941]/30 hover:bg-white-light/50 dark:hover:bg-[#1b2e4b]/50 transition-colors group">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-text-primary dark:text-white">View Progress Analytics</p>
                  <p className="text-[10px] text-text-muted font-semibold mt-0.5">Track your improvement over time</p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
          <Link to="/interviews" className="block">
            <div className="p-4 rounded-md border border-white-light dark:border-[#1b2e4b] bg-white-light/30 dark:bg-[#1a2941]/30 hover:bg-white-light/50 dark:hover:bg-[#1b2e4b]/50 transition-colors group">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-text-primary dark:text-white">Review Past Interviews</p>
                  <p className="text-[10px] text-text-muted font-semibold mt-0.5">Learn from your previous attempts</p>
                </div>
                <ArrowRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
        </div>
      </Card>

      {!progress && (
        <Card hoverEffect={false} className="p-8 border border-white-light dark:border-[#1b2e4b] bg-white dark:bg-black text-center">
          <AlertCircle className="w-10 h-10 text-text-muted/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-text-primary dark:text-white mb-1">No Data Yet</h3>
          <p className="text-xs text-text-muted font-semibold mb-4">Complete a few interviews to generate your personalized study plan.</p>
          <Link to="/interviews/new">
            <Button className="h-10 px-6 rounded-md text-xs font-bold text-white">
              <Play className="w-3.5 h-3.5 mr-2" /> Start Your First Interview
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
