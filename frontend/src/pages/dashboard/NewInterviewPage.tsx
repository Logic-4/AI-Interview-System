import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import toast from "react-hot-toast";

import { TECHNOLOGY_SPECIALIZATIONS } from "../../lib/constants";
import { estimateQuestionCount } from "../../lib/interviewHelpers";
import interviewService from "../../services/interviewService";
import { useInterviewStore } from "../../stores/interviewStore";
import type { InterviewType, InterviewDifficulty, InterviewLanguage, CreateInterviewPayload, InterviewWarmupStatus } from "../../types/interview";

import { Code, User, Settings, Zap, Clock, MessageSquare, Video, Plus, X, ArrowLeft, AlertCircle, CheckCheck, Upload, FileText, CheckSquare, Square } from "lucide-react";
import { parseResumeFile } from "../../lib/fileParser";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";

const DIFFICULTY_LEVELS: { value: InterviewDifficulty; label: string; desc: string }[] = [
  { value: "junior", label: "Junior", desc: "Entry-level" },
  { value: "mid", label: "Mid-Level", desc: "2-5 years exp" },
  { value: "senior", label: "Senior", desc: "5-10 years exp" },
  { value: "lead", label: "Lead / Expert", desc: "10+ years exp" },
];


const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60];

const MAX_SPECIALIZATIONS = 3;

export default function NewInterviewPage() {
  const navigate = useNavigate();
  const setActiveInterview = useInterviewStore((s) => s.setActiveInterview);

  const [step, setStep] = React.useState(1);

  // Specialization multi-select (replaces single jobRole dropdown + domain dropdown)
  const [selectedSpecializations, setSelectedSpecializations] = React.useState<string[]>([]);

  // Session configuration
  const [interviewType, setInterviewType] = React.useState<InterviewType>("technical");
  const [difficulty, setDifficulty] = React.useState<InterviewDifficulty>("junior");
  const [language, setLanguage] = React.useState<InterviewLanguage>("english");
  const [duration, setDuration] = React.useState(30);

  // Tailoring details
  const [resumeText, setResumeText] = React.useState("");
  const [focusSkills, setFocusSkills] = React.useState<string[]>([]);
  const [skillInput, setSkillInput] = React.useState("");

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warmup, setWarmup] = React.useState<InterviewWarmupStatus | null>(null);
  const [warmupRequestError, setWarmupRequestError] = React.useState<string | null>(null);
  const warmupPollCountRef = React.useRef(0);
  const submittingRef = React.useRef(false);
  const generationKeyRef = React.useRef<string | null>(null);
  const [isUploadingResume, setIsUploadingResume] = React.useState(false);
  const [resumeFileName, setResumeFileName] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // The combined jobRole string sent to the model (e.g. "Frontend Development & Backend Development")
  const jobRole = selectedSpecializations.join(" & ");
  const generationFocusSkills = focusSkills.length > 0 ? focusSkills : selectedSpecializations;

  const toggleSpecialization = (spec: string) => {
    setSelectedSpecializations((prev) => {
      if (prev.includes(spec)) return prev.filter((s) => s !== spec);
      if (prev.length >= MAX_SPECIALIZATIONS) return prev;
      return [...prev, spec];
    });
  };

  const getRequestError = React.useCallback((err: unknown) => {
    const responseMessage = (err as { response?: { data?: { message?: string; error?: string } } })
      ?.response?.data;
    return responseMessage?.message || responseMessage?.error ||
      (err instanceof Error ? err.message : "Unable to warm AI services");
  }, []);

  const triggerWarmup = React.useCallback(async (force = false) => {
    try {
      warmupPollCountRef.current = 0;
      setWarmupRequestError(null);
      const status = await interviewService.startInterviewWarmup(force, language);
      setWarmup(status);
    } catch (err) {
      setWarmupRequestError(getRequestError(err));
    }
  }, [getRequestError, language]);

  React.useEffect(() => {
    void triggerWarmup(language === "somali");
  }, [triggerWarmup, language]);

  React.useEffect(() => {
    if (step === 3) void triggerWarmup(true);
  }, [step, triggerWarmup]);

  React.useEffect(() => {
    if (warmup?.status !== "warming" || warmupPollCountRef.current >= 48) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      warmupPollCountRef.current += 1;
      try {
        const status = await interviewService.getInterviewWarmupStatus(controller.signal);
        setWarmupRequestError(null);
        setWarmup(status);
      } catch (err) {
        if (!controller.signal.aborted) setWarmupRequestError(getRequestError(err));
      }
    }, 2500);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [warmup, getRequestError]);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingResume(true);
      setError(null);
      const extractedText = await parseResumeFile(file);
      setResumeText(extractedText);
      setResumeFileName(file.name);
    } catch (err: any) {
      setError(err.message || "Failed to extract text from file.");
      setResumeFileName(null);
    } finally {
      setIsUploadingResume(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeResume = () => {
    setResumeText("");
    setResumeFileName(null);
  };

  // Step validation
  const isStep1Valid = selectedSpecializations.length > 0;
  const isStep2Valid = !!difficulty && !!duration;
  const isFormValid = isStep1Valid && isStep2Valid;

  const autoTitle = jobRole ? `${jobRole} — Technical Practice` : "";


  const handleGenerate = async () => {
    if (selectedSpecializations.length === 0) {
      toast.error('Please select at least one specialization in Step 1');
      setStep(1);
      return;
    }

    if (!duration || duration < 5 || duration > 120) {
      toast.error('Please select a valid session duration in Step 2');
      setStep(2);
      return;
    }

    if (!isFormValid || submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    setError(null);
    void triggerWarmup();

    try {
      const payload: CreateInterviewPayload = {
        title: autoTitle,
        type: interviewType,
        difficulty,
        domain: "technology",
        language,
        duration,
        jobRole,
        focusSkills: generationFocusSkills,
        resumeText: resumeText.trim() || undefined,
      };

      generationKeyRef.current ||= typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `interview-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const interview = await interviewService.createInterview(payload, generationKeyRef.current);
      setActiveInterview(interview);
      navigate(`/interviews/${interview._id}`, {
        state: { fromCreate: true, interview },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create interview. Please try again.";
      setError(msg);
      setIsLoading(false);
      submittingRef.current = false;
    }
  };

  const questionEstimate = estimateQuestionCount(duration);
  const providerWarmupError = warmup?.services.speech.error || warmup?.services.gemma.error;
  const warmupFailure = providerWarmupError || warmupRequestError;

  /* ─── Fullscreen Loading Overlay ─────────────────────── */
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center text-text-primary dark:text-white">
        <div className="max-w-md w-full text-center space-y-6 px-6">
          <LoadingSpinner size="lg" className="mx-auto text-primary" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground dark:text-white">Creating your interview…</h2>
            <p className="text-sm font-medium text-text-muted">
              Generating your first question. Remaining questions will load in the background.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6 animate-in fade-in duration-700 text-black dark:text-white-dark">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/interviews">
          <button className="w-10 h-10 rounded-md border border-[#ebedf2] dark:border-[#1b2e4b] flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-[#000]/[0.04] dark:hover:bg-[#1b2e4b] transition-all bg-white dark:bg-[#121e32]">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight leading-tight text-text-primary dark:text-white">
            Configure Your Interview
          </h1>
          <p className="text-sm text-text-muted font-medium opacity-70">
            Set up your personal mock interview session step-by-step.
          </p>
        </div>
      </div>

      {/* AI Warmup Status Banner */}
      <AnimatePresence mode="wait">
        {(warmup?.status === "warming" || warmup?.status === "ready" || warmupFailure) && (
          <motion.div
            key={warmupFailure ? "failed" : warmup?.status}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "p-3.5 rounded-md border flex items-center gap-3",
              warmupFailure
                ? "bg-danger/5 border-danger/20"
                : warmup?.status === "ready"
                ? "bg-success/5 border-success/20"
                : "bg-primary/5 border-primary/20"
            )}
          >
            {warmupFailure ? (
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
            ) : warmup?.status === "ready" ? (
              <CheckCheck className="w-4 h-4 text-success flex-shrink-0" />
            ) : (
              <LoadingSpinner size="sm" className="text-primary flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary dark:text-white">
                {warmupFailure
                  ? "AI service warmup needs attention"
                  : warmup?.status === "ready"
                  ? "AI services are ready"
                  : "AI services are warming up"}
              </p>
              <p className={cn("text-xs mt-0.5 break-words", warmupFailure ? "text-danger" : "text-text-muted")}>
                {warmupFailure ||
                  (warmup?.status === "ready"
                    ? "Gemma and the selected speech services are ready."
                    : "You can continue configuring the interview while models load in the background.")}
              </p>
            </div>
            {warmupFailure && (
              <button
                type="button"
                onClick={() => void triggerWarmup(true)}
                className="text-xs font-semibold text-danger hover:underline flex-shrink-0"
              >
                Retry
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-md bg-danger/5 border border-danger/20 flex items-start gap-3"
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

      {/* Main Wizard Panel */}
      <div className="panel lg:col-span-2 p-6 md:p-10 min-h-[72vh]">
        <div className="mb-5 max-w-4xl mx-auto">
          <div className="inline-block w-full">

            {/* Stepper */}
            <div className="relative z-[1] max-w-2xl mx-auto w-full py-4 mb-8">
              <div className="absolute left-[16.6%] top-[48px] w-[66.6%] h-1 bg-[#f3f2ee] dark:bg-[#1b2e4b] -z-[1] rounded-full"></div>
              <div
                className={cn(
                  "bg-primary h-1 absolute left-[16.6%] top-[48px] -z-[1] transition-[width] duration-300 rounded-full",
                  step === 1 ? "w-0" : step === 2 ? "w-[33.3%]" : "w-[66.6%]"
                )}
              ></div>
              <ul className="grid grid-cols-3 text-center">
                <li>
                  <button
                    type="button"
                    className={cn(
                      "mx-auto flex justify-center items-center w-16 h-16 rounded-full border-[3px] transition-all duration-300",
                      step === 1
                        ? "!border-primary !bg-primary text-white shadow-md shadow-primary/20"
                        : "border-[#f3f2ee] dark:border-[#1b2e4b] bg-white dark:bg-[#253b5c] text-[#506690]"
                    )}
                    onClick={() => setStep(1)}
                  >
                    <Code className="w-6 h-6" />
                  </button>
                  <span className={cn("text-xs font-semibold block mt-2", step === 1 ? "text-primary dark:text-white" : "text-text-muted")}>
                    Specialization
                  </span>
                </li>
                <li>
                  <button
                    type="button"
                    disabled={!isStep1Valid}
                    className={cn(
                      "mx-auto flex justify-center items-center w-16 h-16 rounded-full border-[3px] transition-all duration-300",
                      step === 2
                        ? "!border-primary !bg-primary text-white shadow-md shadow-primary/20"
                        : "border-[#f3f2ee] dark:border-[#1b2e4b] bg-white dark:bg-[#253b5c] text-[#506690] disabled:opacity-50"
                    )}
                    onClick={() => setStep(2)}
                  >
                    <Settings className="w-6 h-6" />
                  </button>
                  <span className={cn("text-xs font-semibold block mt-2", step === 2 ? "text-primary dark:text-white" : "text-text-muted")}>
                    Session Setup
                  </span>
                </li>
                <li>
                  <button
                    type="button"
                    disabled={!isStep1Valid || !isStep2Valid}
                    className={cn(
                      "mx-auto flex justify-center items-center w-16 h-16 rounded-full border-[3px] transition-all duration-300",
                      step === 3
                        ? "!border-primary !bg-primary text-white shadow-md shadow-primary/20"
                        : "border-[#f3f2ee] dark:border-[#1b2e4b] bg-white dark:bg-[#253b5c] text-[#506690] disabled:opacity-50"
                    )}
                    onClick={() => setStep(3)}
                  >
                    <CheckCheck className="w-6 h-6" />
                  </button>
                  <span className={cn("text-xs font-semibold block mt-2", step === 3 ? "text-primary dark:text-white" : "text-text-muted")}>
                    Personalise
                  </span>
                </li>
              </ul>
            </div>

            {/* Step Content */}
            <div className="py-4">
              <AnimatePresence mode="wait">

                {/* ── STEP 1: Specialization Multi-Select ── */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 15 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6 flex-1"
                  >
                    <div className="border-b border-[#ebedf2] dark:border-[#1b2e4b] pb-4 mb-4">
                      <h4 className="text-lg font-bold text-black dark:text-white-light">Step 1: Choose Your Specialization</h4>
                      <p className="text-xs text-text-muted opacity-70 mt-1">
                        Select up to <strong>{MAX_SPECIALIZATIONS}</strong> areas to practice. The AI will generate questions covering all selected areas.
                        For Full Stack, pick <em>Frontend Development</em> + <em>Backend Development</em>.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {TECHNOLOGY_SPECIALIZATIONS.map((spec) => {
                        const isSelected = selectedSpecializations.includes(spec);
                        const isDisabled = !isSelected && selectedSpecializations.length >= MAX_SPECIALIZATIONS;
                        return (
                          <button
                            key={spec}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => toggleSpecialization(spec)}
                            className={cn(
                              "relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200 text-center gap-2 min-h-[90px] group",
                              isSelected
                                ? "border-primary bg-primary/8 text-primary shadow-md shadow-primary/10"
                                : isDisabled
                                ? "border-[#ebedf2] dark:border-[#1b2e4b] bg-white-light/20 dark:bg-[#253b5c]/20 text-text-muted opacity-40 cursor-not-allowed"
                                : "border-[#ebedf2] dark:border-[#1b2e4b] bg-white-light/30 dark:bg-[#253b5c]/30 text-text-muted hover:border-primary/60 hover:bg-primary/[0.04] hover:text-primary"
                            )}
                          >
                            {/* Checkmark indicator */}
                            <div className="absolute top-2 right-2">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-primary" />
                              ) : (
                                <Square className="w-4 h-4 text-text-muted opacity-30" />
                              )}
                            </div>
                            <Code className={cn("w-5 h-5", isSelected ? "text-primary" : "text-text-muted")} />
                            <span className="text-[11px] font-bold leading-tight">{spec}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selection preview */}
                    <div className="pt-2">
                      {selectedSpecializations.length > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Selected:</span>
                          {selectedSpecializations.map((spec) => (
                            <span
                              key={spec}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-xs font-semibold"
                            >
                              {spec}
                              <button onClick={() => toggleSpecialization(spec)} className="hover:text-danger transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          <span className="text-[10px] font-semibold text-text-muted opacity-60 ml-1">
                            ({selectedSpecializations.length}/{MAX_SPECIALIZATIONS} selected)
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-text-muted italic opacity-60">
                          No specialization selected yet. Pick at least one to continue.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── STEP 2: Session Configuration ── */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 15 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-8 flex-1"
                  >
                    <div className="border-b border-[#ebedf2] dark:border-[#1b2e4b] pb-4 mb-4">
                      <h4 className="text-lg font-bold text-black dark:text-white-light">Step 2: Session Setup</h4>
                      <p className="text-xs text-text-muted opacity-70">Customize the interview language, difficulty, and duration.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Language */}
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-[0.2em] px-1 dark:text-white">Interview Language</label>
                        <div className="flex items-center gap-3">
                          {(["english", "somali"] as const).map((lang) => (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => setLanguage(lang)}
                              className={cn(
                                "flex-1 h-12 rounded-md border transition-all text-center flex items-center justify-center font-bold text-sm",
                                language === lang
                                  ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(67,97,238,0.15)]"
                                  : "border-[#ebedf2] dark:border-[#1b2e4b] bg-white-light/30 dark:bg-[#1a2941]/50 text-text-muted hover:bg-[#ebedf2] dark:hover:bg-[#1b2e4b]"
                              )}
                            >
                              <span className="capitalize">{lang}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-xs font-bold text-text-secondary uppercase tracking-[0.2em] dark:text-white">Session Duration</label>
                          <span className="text-[10px] font-bold text-text-muted opacity-60">~{questionEstimate} questions</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {DURATION_OPTIONS.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDuration(d)}
                              className={cn(
                                "h-12 rounded-md border text-xs font-semibold transition-all flex items-center justify-center",
                                duration === d
                                  ? "border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(67,97,238,0.15)]"
                                  : "border-[#ebedf2] dark:border-[#1b2e4b] bg-white-light/30 dark:bg-[#1a2941]/50 text-text-muted hover:bg-[#ebedf2] dark:hover:bg-[#1b2e4b]"
                              )}
                            >
                              {d} min
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Experience Level */}
                    <div className="space-y-3 pt-2 border-t border-[#ebedf2] dark:border-[#1b2e4b] mt-4">
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-[0.2em] px-1 dark:text-white">Experience Level</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {DIFFICULTY_LEVELS.map((level) => {
                          const isActive = difficulty === level.value;
                          return (
                            <button
                              key={level.value}
                              type="button"
                              onClick={() => setDifficulty(level.value)}
                              className={cn(
                                "flex flex-col items-center justify-center p-4 rounded-lg border transition-all duration-200 text-center gap-1 min-h-[80px]",
                                isActive
                                  ? "border-primary bg-primary/5 text-primary shadow-md shadow-primary/5"
                                  : "border-[#ebedf2] dark:border-[#1b2e4b] bg-white-light/30 dark:bg-[#253b5c]/30 text-text-muted hover:border-primary/50 hover:bg-primary/[0.02]"
                              )}
                            >
                              <span className="text-sm font-bold tracking-tight">{level.label}</span>
                              <span className="text-[10px] opacity-75 font-medium">{level.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </motion.div>
                )}

                {/* ── STEP 3: Personalise (Self-Training only) ── */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 15 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6 flex-1"
                  >
                    <div className="border-b border-[#ebedf2] dark:border-[#1b2e4b] pb-4 mb-4">
                      <h4 className="text-lg font-bold text-black dark:text-white-light">Step 3: Personalise Your Session</h4>
                      <p className="text-xs text-text-muted opacity-70 mt-1">
                        Upload your resume and add skills so the AI tailors questions directly to your background. Both fields are optional.
                      </p>
                    </div>

                    <div className="space-y-6">
                      {/* Resume Upload */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-xs font-bold text-text-secondary uppercase tracking-[0.2em] dark:text-white block">
                            Upload Your Resume / CV
                            <span className="ml-2 text-[10px] font-semibold text-text-muted normal-case tracking-normal opacity-60">(optional — personalises questions to your background)</span>
                          </label>
                        </div>
                        <div className="relative">
                          <input
                            type="file"
                            accept=".txt,.pdf,.docx"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                          />
                          {resumeFileName ? (
                            <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-primary/30 border-dashed rounded-lg bg-primary/5">
                              <FileText className="w-8 h-8 text-primary mb-2" />
                              <p className="text-sm font-semibold text-text-primary dark:text-white">{resumeFileName}</p>
                              <button
                                type="button"
                                onClick={removeResume}
                                className="mt-2 text-xs font-bold text-danger hover:underline"
                              >
                                Remove File
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploadingResume}
                              className="flex flex-col items-center justify-center w-full h-32 border-2 border-[#ebedf2] dark:border-[#1b2e4b] border-dashed rounded-lg hover:border-primary hover:bg-primary/5 transition-all bg-white dark:bg-[#121e32]"
                            >
                              {isUploadingResume ? (
                                <div className="flex flex-col items-center gap-2">
                                  <LoadingSpinner size="sm" className="h-6 w-6" />
                                  <span className="text-xs font-semibold text-primary">Parsing file...</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <Upload className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <span className="text-sm font-bold text-text-primary dark:text-white">Click to upload your Resume</span>
                                    <p className="text-[10px] font-semibold text-text-muted mt-1">Supports PDF, DOCX, TXT</p>
                                  </div>
                                </div>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Focus Skills */}
                      <div className="space-y-3 pt-2 border-t border-[#ebedf2] dark:border-[#1b2e4b] mt-4">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-xs font-bold text-text-secondary uppercase tracking-[0.2em] dark:text-white">
                            Focus Skills
                            <span className="ml-2 text-[10px] font-semibold text-text-muted normal-case tracking-normal opacity-60">(optional — e.g. React, Docker, SQL)</span>
                          </label>
                          <span className="text-[10px] font-bold text-text-muted opacity-60">{focusSkills.length}/10</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={skillInput}
                            onChange={(e) => setSkillInput(e.target.value)}
                            onKeyDown={handleSkillKeyDown}
                            placeholder="e.g. React, Node.js, Docker..."
                            className="form-input flex-1 h-11"
                          />
                          <button
                            type="button"
                            onClick={addSkill}
                            disabled={!skillInput.trim() || focusSkills.length >= 10}
                            className="h-11 w-11 rounded-md border border-[#ebedf2] dark:border-[#1b2e4b] flex items-center justify-center text-text-muted hover:text-primary hover:border-primary/40 disabled:opacity-30 transition-all bg-[#f3f2ee] dark:bg-[#253b5c]"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        {focusSkills.length > 0 ? (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {focusSkills.map((skill) => (
                              <span
                                key={skill}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md text-xs font-semibold"
                              >
                                {skill}
                                <button onClick={() => removeSkill(skill)} className="hover:text-danger transition-colors">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-text-muted italic px-1 pt-1 opacity-60">
                            No custom skills added. Standard {jobRole || "technology"} skills will be assessed.
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation Controls */}
            <div className="flex justify-between items-center pt-6 mt-8 border-t border-[#ebedf2] dark:border-[#1b2e4b]">
              <div>
                <button
                  type="button"
                  className={cn("btn btn-outline-primary px-10 py-3 text-sm font-semibold uppercase tracking-wider", step === 1 ? "invisible" : "")}
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
              </div>
              <div>
                {step < 3 ? (
                  <button
                    type="button"
                    disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
                    className="btn btn-primary px-10 py-3 text-sm font-semibold uppercase tracking-wider"
                    onClick={() => setStep(step + 1)}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary px-10 py-3 text-sm font-semibold uppercase tracking-wider flex items-center gap-2"
                    onClick={handleGenerate}
                    disabled={isLoading || !isFormValid}
                  >
                    {isLoading ? "Generating..." : "Generate Interview"}
                    <Zap className="w-4 h-4 fill-white" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
        <div className="flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-md bg-white-light/30 dark:bg-[#1a2941]/50 border border-[#ebedf2] dark:border-[#1b2e4b] flex items-center justify-center text-text-muted group-hover:text-primary transition-all">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight leading-none mb-1 text-text-primary dark:text-white">{duration} Minutes</p>
            <p className="text-[10px] font-semibold text-text-muted opacity-60">~{questionEstimate} questions generated</p>
          </div>
        </div>
        <div className="flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-md bg-white-light/30 dark:bg-[#1a2941]/50 border border-[#ebedf2] dark:border-[#1b2e4b] flex items-center justify-center text-text-muted group-hover:text-primary transition-all">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight leading-none mb-1 text-text-primary dark:text-white">Real-time Feedback</p>
            <p className="text-[10px] font-semibold text-text-muted opacity-60">Get instant AI analysis per answer</p>
          </div>
        </div>
        <div className="flex items-center gap-4 group">
          <div className="w-10 h-10 rounded-md bg-white-light/30 dark:bg-[#1a2941]/50 border border-[#ebedf2] dark:border-[#1b2e4b] flex items-center justify-center text-text-muted group-hover:text-primary transition-all">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight leading-none mb-1 text-text-primary dark:text-white">Voice or Text</p>
            <p className="text-[10px] font-semibold text-text-muted opacity-60">Answer in any mode you prefer</p>
          </div>
        </div>
      </div>
    </div>
  );
}
