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
  Loader2,
  AlertCircle,
  Code2,
  Stethoscope,
  DollarSign,
  Megaphone,
  GraduationCap,
  Scale,
  Wrench,
  Palette,
  Settings2,
  HeadphonesIcon,
  Users,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import interviewService from "@/services/interviewService";
import type { InterviewType, InterviewDifficulty, InterviewDomain, CreateInterviewPayload } from "@/types/interview";

/* ─── Department → Job Roles mapping ──────────────────────────── */
const DEPARTMENTS: {
  id: string;
  label: string;
  icon: React.ElementType;
  domains: { value: InterviewDomain; label: string }[];
  roles: string[];
}[] = [
  {
    id: "technology",
    label: "Technology",
    icon: Code2,
    domains: [
      { value: "frontend", label: "Frontend" },
      { value: "backend", label: "Backend" },
      { value: "fullstack", label: "Full Stack" },
      { value: "devops", label: "DevOps" },
      { value: "data-science", label: "Data Science" },
      { value: "mobile", label: "Mobile" },
      { value: "cloud", label: "Cloud" },
      { value: "security", label: "Security" },
      { value: "qa-testing", label: "QA / Testing" },
      { value: "ai-ml", label: "AI / ML" },
    ],
    roles: [
      "Frontend Developer",
      "Backend Developer",
      "Full Stack Engineer",
      "DevOps Engineer",
      "Data Scientist",
      "Data Analyst",
      "Mobile Developer (iOS)",
      "Mobile Developer (Android)",
      "Cloud Architect",
      "Security Engineer",
      "QA Engineer",
      "Machine Learning Engineer",
      "Software Architect",
      "Site Reliability Engineer",
      "Database Administrator",
      "Systems Administrator",
      "Technical Lead",
      "CTO",
      "Blockchain Developer",
      "Embedded Systems Engineer",
    ],
  },
  {
    id: "healthcare",
    label: "Healthcare",
    icon: Stethoscope,
    domains: [{ value: "healthcare", label: "Healthcare" }],
    roles: [
      "Registered Nurse",
      "Medical Doctor",
      "Pharmacist",
      "Healthcare Administrator",
      "Medical Technician",
      "Physical Therapist",
      "Dentist",
      "Medical Lab Scientist",
      "Radiologist",
      "Clinical Research Coordinator",
    ],
  },
  {
    id: "finance",
    label: "Finance & Accounting",
    icon: DollarSign,
    domains: [{ value: "finance", label: "Finance" }],
    roles: [
      "Financial Analyst",
      "Accountant",
      "Investment Banker",
      "Insurance Underwriter",
      "Auditor",
      "Tax Consultant",
      "Risk Analyst",
      "Portfolio Manager",
      "CFO",
      "Loan Officer",
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    domains: [{ value: "marketing", label: "Marketing" }],
    roles: [
      "Digital Marketing Manager",
      "Content Strategist",
      "SEO Specialist",
      "Brand Manager",
      "Social Media Manager",
      "Growth Hacker",
      "Marketing Analyst",
      "Email Marketing Specialist",
      "CMO",
      "Product Marketing Manager",
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: BarChart3,
    domains: [{ value: "sales", label: "Sales" }],
    roles: [
      "Sales Representative",
      "Account Executive",
      "Business Development Manager",
      "Sales Manager",
      "VP of Sales",
      "Inside Sales Rep",
      "Key Account Manager",
      "Sales Engineer",
    ],
  },
  {
    id: "human-resources",
    label: "Human Resources",
    icon: Users,
    domains: [{ value: "human-resources", label: "Human Resources" }],
    roles: [
      "HR Manager",
      "Recruiter",
      "Talent Acquisition Specialist",
      "Training & Development Manager",
      "Compensation Analyst",
      "HR Business Partner",
      "CHRO",
      "Diversity & Inclusion Manager",
    ],
  },
  {
    id: "education",
    label: "Education",
    icon: GraduationCap,
    domains: [{ value: "education", label: "Education" }],
    roles: [
      "Teacher",
      "Professor",
      "School Administrator",
      "Instructional Designer",
      "Curriculum Developer",
      "Academic Advisor",
      "Education Consultant",
      "Tutor",
    ],
  },
  {
    id: "legal",
    label: "Legal",
    icon: Scale,
    domains: [{ value: "legal", label: "Legal" }],
    roles: [
      "Lawyer",
      "Paralegal",
      "Compliance Officer",
      "Legal Analyst",
      "Corporate Counsel",
      "Contract Manager",
      "Legal Secretary",
      "Judge Clerk",
    ],
  },
  {
    id: "engineering",
    label: "Engineering (Non-Software)",
    icon: Wrench,
    domains: [{ value: "engineering", label: "Engineering" }],
    roles: [
      "Mechanical Engineer",
      "Civil Engineer",
      "Electrical Engineer",
      "Chemical Engineer",
      "Environmental Engineer",
      "Industrial Engineer",
      "Structural Engineer",
      "Aerospace Engineer",
    ],
  },
  {
    id: "creative",
    label: "Creative & Design",
    icon: Palette,
    domains: [{ value: "creative", label: "Creative" }],
    roles: [
      "Graphic Designer",
      "UX/UI Designer",
      "Product Designer",
      "Copywriter",
      "Art Director",
      "Video Producer",
      "Animator",
      "Creative Director",
    ],
  },
  {
    id: "operations",
    label: "Operations & Management",
    icon: Settings2,
    domains: [
      { value: "operations", label: "Operations" },
      { value: "management", label: "Management" },
    ],
    roles: [
      "Project Manager",
      "Operations Manager",
      "Supply Chain Manager",
      "Logistics Coordinator",
      "Business Analyst",
      "Product Manager",
      "Scrum Master",
      "COO",
    ],
  },
  {
    id: "customer-service",
    label: "Customer Service",
    icon: HeadphonesIcon,
    domains: [{ value: "customer-service", label: "Customer Service" }],
    roles: [
      "Customer Support Specialist",
      "Help Desk Technician",
      "Client Success Manager",
      "Technical Support Engineer",
      "Call Center Manager",
      "Customer Experience Manager",
    ],
  },
];

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

  // Form state
  const [department, setDepartment] = React.useState("");
  const [domain, setDomain] = React.useState<InterviewDomain | "">("");
  const [jobRole, setJobRole] = React.useState("");
  const [interviewType, setInterviewType] = React.useState<InterviewType>("technical");
  const [difficulty, setDifficulty] = React.useState<InterviewDifficulty>("junior");
  const [duration, setDuration] = React.useState(30);
  const [jobDescription, setJobDescription] = React.useState("");
  const [focusSkills, setFocusSkills] = React.useState<string[]>([]);
  const [skillInput, setSkillInput] = React.useState("");

  // UI state
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Derived
  const activeDepartment = DEPARTMENTS.find((d) => d.id === department);
  const allRolesForDept = activeDepartment?.roles ?? [];

  // Auto-set domain when department has only one
  React.useEffect(() => {
    if (activeDepartment) {
      if (activeDepartment.domains.length === 1) {
        setDomain(activeDepartment.domains[0].value);
      } else {
        setDomain("");
      }
      setJobRole("");
    }
  }, [department, activeDepartment]);

  // Skills management
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

  // Validation
  const isFormValid = department && domain && jobRole && interviewType && difficulty && duration;

  // Auto-generate title
  const autoTitle = jobRole ? `${jobRole} — ${INTERVIEW_TYPES.find((t) => t.value === interviewType)?.label ?? "Interview"}` : "";

  // Submit
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
      {/* Header */}
      <div className="flex items-center gap-4">
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

      {/* Error banner */}
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
          {/* Row 1: Department & Domain */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] px-1">Department</label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="h-12 bg-foreground/5 border-border/40 rounded-xl px-5 text-sm font-semibold hover:border-primary/50 transition-colors text-text-primary">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4 text-primary opacity-80" />
                    <SelectValue placeholder="Choose a department" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-surface border-border/40 max-h-80">
                  {DEPARTMENTS.map((dept) => {
                    const Icon = dept.icon;
                    return (
                      <SelectItem key={dept.id} value={dept.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-text-muted" />
                          {dept.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Domain (only for multi-domain depts like Technology) */}
            {activeDepartment && activeDepartment.domains.length > 1 && (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] px-1">Specialty</label>
                <Select value={domain} onValueChange={(v) => setDomain(v as InterviewDomain)}>
                  <SelectTrigger className="h-12 bg-foreground/5 border-border/40 rounded-xl px-5 text-sm font-semibold hover:border-primary/50 transition-colors text-text-primary">
                    <div className="flex items-center gap-3">
                      <Settings2 className="w-4 h-4 text-text-muted" />
                      <SelectValue placeholder="Select specialty" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border/40">
                    {activeDepartment.domains.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Row 2: Job Role */}
          {activeDepartment && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] px-1">Job Role</label>
              <Select value={jobRole} onValueChange={setJobRole}>
                <SelectTrigger className="h-12 bg-foreground/5 border-border/40 rounded-xl px-5 text-sm font-semibold hover:border-primary/50 transition-colors text-text-primary">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4 text-primary opacity-80" />
                    <SelectValue placeholder="Select your target role" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-surface border-border/40 max-h-72">
                  <SelectGroup>
                    <SelectLabel>{activeDepartment.label} Roles</SelectLabel>
                    {allRolesForDept.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Interview Type */}
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

          {/* Difficulty Level */}
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

          {/* Duration Selector */}
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

          {/* Focus Skills */}
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

          {/* Job Description */}
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

          {/* AI Notice */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-4">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-text-muted leading-relaxed">
              Our AI will analyze the job description, role, and focus skills to generate realistic, industry-specific interview questions tailored to your experience level.
            </p>
          </div>

          {/* Bottom Actions */}
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
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Questions...
                  </>
                ) : (
                  <>
                    Generate Interview
                    <Zap className="w-4 h-4 fill-white group-hover:scale-125 transition-transform duration-300" />
                  </>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-blue-400 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer pointer-events-none" />
            </Button>
          </div>
        </div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      </Card>

      {/* Feature Icons Footer */}
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
