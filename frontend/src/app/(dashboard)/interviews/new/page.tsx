"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  MessageSquare,
  Clock,
  Video,
  Zap,
  Info,
  CheckCircle2,
  X,
  Plus,
  ArrowLeft,
  AlertCircle,
  Code2,
  Stethoscope,
  DollarSign,
  GraduationCap,
  Scale,
  Wrench,
  Settings2,
  HeadphonesIcon,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import LoadingOverlay from "@/components/auth/LoadingOverlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import { DOMAIN_ROLES, DOMAIN_LABELS } from "@/lib/constants";
import interviewService from "@/services/interviewService";
import type { InterviewType, InterviewDifficulty, InterviewDomain, InterviewLanguage, CreateInterviewPayload } from "@/types/interview";

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  technology: Code2,
  healthcare: Stethoscope,
  finance: DollarSign,
  engineering: Wrench,
  education: GraduationCap,
  legal: Scale,
};

const INTERVIEW_TYPES: { value: InterviewType; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "technical", label: "Technical", desc: "Skills & knowledge deep-dive", icon: Code2 },
  { value: "behavioral", label: "Behavioral", desc: "STAR-method situational questions", icon: Users },
  { value: "hr", label: "HR Screening", desc: "Motivation, culture fit, goals", icon: HeadphonesIcon },
  { value: "system-design", label: "System Design", desc: "Architecture & design thinking", icon: Settings2 },
  { value: "mixed", label: "Mixed", desc: "Balanced blend of all types", icon: Zap },
];

const DIFFICULTY_LEVELS: { value: InterviewDifficulty; label: string; desc: string }[] = [
  { value: "junior", label: "Junior", desc: "Entry-level / Intern" },
  { value: "mid", label: "Mid-Level", desc: "2-5 years experience" },
  { value: "senior", label: "Senior", desc: "5-10 years experience" },
  { value: "lead", label: "Lead / Expert", desc: "10+ years / leadership" },
];

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60];

export default function InterviewSetupPage() {
  const router = useRouter();

  const [domain, setDomain] = React.useState<InterviewDomain | "">("");
  const [jobRole, setJobRole] = React.useState("");
  const [interviewType, setInterviewType] = React.useState<InterviewType>("technical");
  const [difficulty, setDifficulty] = React.useState<InterviewDifficulty>("junior");
  const [language, setLanguage] = React.useState<InterviewLanguage>("english");
  const [duration, setDuration] = React.useState(30);
  const [jobDescription, setJobDescription] = React.useState("");
  const [focusSkills, setFocusSkills] = React.useState<string[]>([]);
  const [skillInput, setSkillInput] = React.useState("");

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const currentRoles = domain ? DOMAIN_ROLES[domain] : [];
  const DomainIcon = domain ? DOMAIN_ICONS[domain] : Briefcase;

  React.useEffect(() => {
    setJobRole("");
  }, [domain]);

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !focusSkills.includes(trimmed) && focusSkills.length < 10) {
      setFocusSkills([...focusSkills, trimmed]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setFocusSkills(focusSkills.filter((s) => s !== skill));
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  const isFormValid = domain && jobRole && interviewType && difficulty && duration;

  const autoTitle = jobRole ? `${jobRole} — ${INTERVIEW_TYPES.find((t) => t.value === interviewType)?.label ?? "Interview"}` : "";

  const handleGenerate = async () => {
    if (!isFormValid) return;
    setIsLoading(true);
    setError(null);

    try {
      const payload: CreateInterviewPayload = {
        title: autoTitle,
        type: interviewType,
        difficulty,
        domain: domain as InterviewDomain,
        language,
        duration,
        jobRole,
        focusSkills: focusSkills.length > 0 ? focusSkills : undefined,
        jobDescription: jobDescription.trim() || undefined,
      };

      const interview = await interviewService.createInterview(payload);
      router.push(`/interviews/${interview._id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create interview. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const questionEstimate = Math.min(Math.floor(duration / 5), 10);

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6 animate-in fade-in duration-700">
      <div className="flex items-center gap-4">
        {isLoading && <LoadingOverlay />}
      <Link href="/interviews">
          <button className="w-10 h-10 rounded-xl border border-border/40 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-foreground/[0.04] transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight leading-tight text-text-primary">Configure Your Interview</h1>
          <p className="text-base text-text-muted font-medium opacity-70">Set the stage for your AI-powered mock interview session.</p>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-danger/5 border border-danger/20 flex items-start gap-3"
          >
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-danger">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-danger/60 hover:text-danger">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Card hoverEffect={false} className="p-6 border-border/40 bg-surface/30 backdrop-blur-2xl relative overflow-hidden">
        <div className="space-y-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] px-1">Domain</label>
              <Select value={domain} onValueChange={(v) => setDomain(v as InterviewDomain)}>
                <SelectTrigger className="h-12 bg-foreground/5 border-border/40 rounded-xl px-5 text-sm font-semibold hover:border-primary/50 transition-colors text-text-primary">
                  <div className="flex items-center gap-3">
                    <DomainIcon className="w-4 h-4 text-primary opacity-80" />
                    <SelectValue placeholder="Choose a domain" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-surface border-border/40">
                  {Object.entries(DOMAIN_LABELS).map(([key, label]) => {
                    const Icon = DOMAIN_ICONS[key];
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-text-muted" />
                          {label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] px-1">Role</label>
              <Select value={jobRole} onValueChange={setJobRole} disabled={!domain}>
                <SelectTrigger className="h-12 bg-foreground/5 border-border/40 rounded-xl px-5 text-sm font-semibold hover:border-primary/50 transition-colors text-text-primary">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4 text-primary opacity-80" />
                    <SelectValue placeholder={domain ? "Select role" : "Select domain first"} />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-surface border-border/40">
                  {currentRoles.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] px-1">Language</label>
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              {(['english', 'somali'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={cn(
                    "h-12 rounded-xl border transition-all text-center flex items-center justify-center",
                    language === lang
                      ? "border-primary bg-primary/10 text-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]"
                      : "border-border/40 bg-foreground/5 text-text-muted hover:bg-foreground/10 hover:border-border/60"
                  )}
                >
                  <span className="text-sm font-semibold capitalize">{lang}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] px-1">Interview Type</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {INTERVIEW_TYPES.map((t) => {
                const isActive = interviewType === t.value;
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setInterviewType(t.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center",
                      isActive
                        ? "border-primary bg-primary/10 text-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]"
                        : "border-border/40 bg-foreground/5 text-text-muted hover:bg-foreground/10 hover:border-border/60"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-bold tracking-tight">{t.label}</span>
                    <span className="text-[9px] font-medium opacity-60 leading-tight">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] px-1">Experience Level</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {DIFFICULTY_LEVELS.map((level) => {
                const isActive = difficulty === level.value;
                return (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setDifficulty(level.value)}
                    className={cn(
                      "h-14 rounded-xl border transition-all text-center relative overflow-hidden flex flex-col items-center justify-center",
                      isActive
                        ? "border-primary bg-primary/10 text-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]"
                        : "border-border/40 bg-foreground/5 text-text-muted hover:bg-foreground/10 hover:border-border/60"
                    )}
                  >
                    <span className="text-sm font-semibold tracking-tight">{level.label}</span>
                    <span className="text-[9px] font-medium opacity-60">{level.desc}</span>
                    {isActive && (
                      <motion.div
                        layoutId="diffActive"
                        className="absolute inset-x-0 bottom-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em]">Session Duration</label>
              <span className="text-[10px] font-bold text-text-muted opacity-60">~{questionEstimate} questions</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn(
                    "h-10 px-5 rounded-lg border text-sm font-semibold transition-all",
                    duration === d
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/40 bg-foreground/5 text-text-muted hover:bg-foreground/10 hover:border-border/60"
                  )}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em]">Focus Skills (Optional)</label>
              <span className="text-[10px] font-bold text-text-muted opacity-60">{focusSkills.length}/10</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder="e.g. React, Leadership, SQL..."
                className="flex-1 h-10 bg-foreground/5 border border-border/40 rounded-lg px-4 text-sm font-medium focus:outline-none focus:border-primary/50 focus:bg-foreground/[0.06] transition-all text-text-primary placeholder:text-text-muted"
              />
              <button
                type="button"
                onClick={addSkill}
                disabled={!skillInput.trim() || focusSkills.length >= 10}
                className="h-10 w-10 rounded-lg border border-border/40 flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/40 disabled:opacity-30 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {focusSkills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {focusSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-semibold"
                  >
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="hover:text-danger transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em]">Job Description (Optional)</label>
              <span className="text-[10px] font-bold text-text-muted italic opacity-60 px-1">Paste the JD for tailored questions</span>
            </div>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job description here for AI to generate highly targeted questions..."
              className="w-full h-36 bg-foreground/5 border border-border/40 rounded-2xl p-5 text-sm font-medium focus:outline-none focus:border-primary/50 focus:bg-foreground/[0.06] transition-all resize-none custom-scrollbar text-text-primary placeholder:text-text-muted"
            />
          </div>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-4">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-text-muted leading-relaxed">
              Our AI will analyze the job description, role, and focus skills to generate realistic, industry-specific interview questions tailored to your experience level.
            </p>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6 border-t border-border/40">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-success">
                <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center border border-success/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest opacity-80">AI Engine Ready</span>
              </div>
              {autoTitle && (
                <span className="text-xs text-text-muted font-medium hidden md:inline truncate max-w-[200px]">
                  {autoTitle}
                </span>
              )}
            </div>

            <Button
              size="lg"
              className="h-14 px-10 rounded-xl text-sm font-semibold uppercase tracking-wider shadow-xl shadow-primary/20 group relative overflow-hidden"
              onClick={handleGenerate}
              disabled={isLoading || !isFormValid}
            >
              <div className="relative z-10 flex items-center gap-3">
                Generate Interview
                <Zap className="w-4 h-4 fill-white group-hover:scale-125 transition-transform duration-300" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-blue-400 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer pointer-events-none" />
            </Button>
          </div>
        </div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
        <div className="flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 border border-border/40 flex items-center justify-center text-text-muted group-hover:text-primary transition-all">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight leading-none mb-1 text-text-primary">{duration} Minutes</p>
            <p className="text-[10px] font-bold text-text-muted opacity-60">~{questionEstimate} questions generated</p>
          </div>
        </div>
        <div className="flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 border border-border/40 flex items-center justify-center text-text-muted group-hover:text-primary transition-all">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight leading-none mb-1 text-text-primary">Real-time Feedback</p>
            <p className="text-[10px] font-bold text-text-muted opacity-60">Get instant AI analysis per answer</p>
          </div>
        </div>
        <div className="flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 border border-border/40 flex items-center justify-center text-text-muted group-hover:text-primary transition-all">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight leading-none mb-1 text-text-primary">Voice or Text</p>
            <p className="text-[10px] font-bold text-text-muted opacity-60">Answer in any mode you prefer</p>
          </div>
        </div>
      </div>
    </div>
  );
}
