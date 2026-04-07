"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Briefcase, 
  MessageSquare, 
  Clock, 
  Video, 
  Zap, 
  Info, 
  CheckCircle2, 
  ChevronDown,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/Select";
import { cn } from "@/lib/utils";

const difficultyLevels = [
  { id: "beginner", title: "Beginner" },
  { id: "mid", title: "Mid-Level" },
  { id: "senior", title: "Senior" },
  { id: "expert", title: "Expert" }
];

export default function InterviewSetupPage() {
  const router = useRouter();
  const [difficulty, setDifficulty] = React.useState("beginner");
  const [isLoading, setIsLoading] = React.useState(false);

  const handleGenerate = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.push("/preparation");
    }, 1500);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6 animate-in fade-in duration-700">
      {/* Title Section (Left Aligned) */}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight leading-tight">Configure Your Interview</h1>
        <p className="text-base text-text-muted font-medium opacity-70">Set the stage for your AI-powered mock interview session.</p>
      </div>

      <Card 
        hoverEffect={false}
        className="p-6 border-white/5 bg-surface/30 backdrop-blur-2xl relative overflow-hidden"
      >
        <form className="space-y-6 relative z-10">
          {/* Row 1: Role & Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] px-1">Job Role</label>
              <Select>
                <SelectTrigger className="h-12 bg-surface-2/50 border-white/5 rounded-xl px-5 text-sm font-semibold hover:border-primary/50 transition-colors">
                   <div className="flex items-center gap-3">
                      <Briefcase className="w-4 h-4 text-primary opacity-80" />
                      <SelectValue placeholder="Select your job role" />
                   </div>
                </SelectTrigger>
                <SelectContent className="bg-surface-2 border-white/10">
                  <SelectItem value="frontend">Frontend Developer</SelectItem>
                  <SelectItem value="backend">Backend Developer</SelectItem>
                  <SelectItem value="fullstack">Fullstack Engineer</SelectItem>
                  <SelectItem value="product">Product Manager</SelectItem>
                  <SelectItem value="design">Senior Product Designer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] px-1">Interview Type</label>
              <Select>
                <SelectTrigger className="h-12 bg-surface-2/50 border-white/5 rounded-xl px-5 text-sm font-semibold">
                   <div className="flex items-center gap-3">
                      <MessageSquare className="w-4 h-4 text-text-muted" />
                      <SelectValue placeholder="Select interview type" />
                   </div>
                </SelectTrigger>
                <SelectContent className="bg-surface-2 border-white/10">
                  <SelectItem value="behavioral">Behavioral</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="system-design">System Design</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Difficulty Level */}
          <div className="space-y-3">
             <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em] px-1">Difficulty Level</label>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {difficultyLevels.map((level) => {
                  const isActive = difficulty === level.id;
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setDifficulty(level.id)}
                      className={cn(
                        "h-12 rounded-xl border transition-all text-sm font-semibold tracking-tight relative overflow-hidden",
                        isActive 
                          ? "border-primary bg-primary/10 text-primary shadow-[0_0_20px_rgba(59,130,246,0.1)]" 
                          : "border-white/5 bg-white/[0.02] text-text-muted hover:bg-white/[0.05] hover:border-white/10"
                      )}
                    >
                      {level.title}
                      {isActive && (
                        <motion.div 
                          layoutId="diffActive"
                          className="absolute inset-x-0 bottom-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                        />
                      )}
                    </button>
                  );
                })}
             </div>
          </div>

          {/* Job Description */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-[0.2em]">Job Description (Optional)</label>
              <span className="text-[10px] font-bold text-text-muted italic opacity-60 px-1">Paste the JD for specific questions</span>
            </div>
            <textarea 
              placeholder="Paste the job description here..."
              className="w-full h-40 bg-surface-2/50 border border-white/5 rounded-2xl p-6 text-sm font-medium focus:outline-none focus:border-primary/50 focus:bg-surface-2 transition-all resize-none custom-scrollbar"
            />
          </div>

          {/* AI Notice */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-4">
             <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
             <p className="text-xs font-semibold text-text-muted leading-relaxed">
               Our AI will analyze the job description to tailor questions specifically to the tech stack and requirements mentioned.
             </p>
          </div>

          {/* Bottom Actions Row (Left/Right Centering) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6 border-t border-white/5">
             <div className="flex items-center gap-2 text-success">
                <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center border border-success/20">
                   <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest opacity-80">AI Engine Ready</span>
             </div>
             
             <Button 
               size="lg" 
               className="h-14 px-10 rounded-xl text-sm font-semibold uppercase tracking-wider shadow-xl shadow-primary/20 group relative overflow-hidden"
               onClick={handleGenerate}
               disabled={isLoading}
             >
                <div className="relative z-10 flex items-center gap-3">
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
        </form>
        {/* Static corner glow (removed hover) */}
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      </Card>

      {/* Feature Icons Footer (In a single row across) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
         <div className="flex items-center gap-4 group">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center text-text-muted group-hover:text-primary transition-all">
               <Clock className="w-5 h-5" />
            </div>
            <div>
               <p className="text-sm font-semibold tracking-tight leading-none mb-1">30-45 Minutes</p>
               <p className="text-[10px] font-bold text-text-muted opacity-60">Average session duration</p>
            </div>
         </div>
         <div className="flex items-center gap-4 group">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center text-text-muted group-hover:text-primary transition-all">
               <MessageSquare className="w-5 h-5" />
            </div>
            <div>
               <p className="text-sm font-semibold tracking-tight leading-none mb-1">Real-time Feedback</p>
               <p className="text-[10px] font-bold text-text-muted opacity-60">Get instant analysis</p>
            </div>
         </div>
         <div className="flex items-center gap-4 group">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center text-text-muted group-hover:text-primary transition-all">
               <Video className="w-5 h-5" />
            </div>
            <div>
               <p className="text-sm font-semibold tracking-tight leading-none mb-1">Video Optional</p>
               <p className="text-[10px] font-bold text-text-muted opacity-60">Voice or text also available</p>
            </div>
         </div>
      </div>

      <footer className="pt-12 pb-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 scale-90 opacity-40">
         <p className="text-[10px] font-semibold tracking-[0.3em]">
           © 2024 INTERVIEWAI. ALL RIGHTS RESERVED.
         </p>
         <div className="flex gap-8">
            <Link href="/support" className="text-[10px] font-semibold hover:text-text-primary transition-colors tracking-[0.3em]">SUPPORT</Link>
            <Link href="/privacy" className="text-[10px] font-semibold hover:text-text-primary transition-colors tracking-[0.3em]">PRIVACY</Link>
         </div>
      </footer>
    </div>
  );
}
