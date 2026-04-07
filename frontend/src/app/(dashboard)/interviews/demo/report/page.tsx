"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  Trophy, 
  ThumbsUp, 
  AlertTriangle, 
  Play, 
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export default function InterviewResultPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <div className="flex items-center gap-2 mb-2">
               <span className="text-xs font-bold text-text-muted uppercase tracking-widest">Interview Analysis</span>
               <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold text-text-muted">
                  SESSION #W-1924
               </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Software Engineer Role</h1>
            <p className="text-[13px] font-medium text-text-muted mt-1">
              Mock Interview completed on Oct 24, 2023 • 45 minutes duration
            </p>
         </div>
         <Button className="bg-primary hover:bg-primary-light text-white shadow-lg shadow-primary/20 h-10 px-5 text-sm font-semibold gap-2 rounded-xl">
            <Trophy className="w-4 h-4" />
            View Detailed Feedback
         </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Overall Score Card */}
         <Card className="col-span-1 p-6 border-white/5 bg-surface/40 flex flex-col items-center justify-center relative overflow-hidden">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] mb-8">Overall Score</h3>
            
            <div className="relative w-40 h-40 flex items-center justify-center mb-8">
               {/* Circular Progress Background */}
               <svg className="absolute inset-0 w-full h-full -rotate-90">
                 <circle cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
                 <circle 
                   cx="80" cy="80" r="70" fill="none" stroke="currentColor" strokeWidth="6" 
                   strokeDasharray="439.8" strokeDashoffset={439.8 - (439.8 * 82) / 100}
                   className="text-primary transition-all duration-1000 ease-out drop-shadow-[0_0_10px_rgba(41,98,255,0.5)]" 
                   strokeLinecap="round"
                 />
               </svg>
               <div className="flex flex-col items-center justify-center text-center mt-2">
                  <span className="text-5xl font-black text-white tracking-tighter tabular-nums leading-none">82</span>
                  <span className="text-sm font-bold text-text-muted">/ 100</span>
               </div>
            </div>

            <div className="px-4 py-1.5 rounded-full bg-success/10 border border-success/20 text-success text-[11px] font-bold tracking-wider flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
               +5% from last session
            </div>
         </Card>

         {/* Competency Breakdown */}
         <Card className="col-span-1 lg:col-span-2 p-6 border-white/5 bg-surface/40">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-sm font-bold text-white tracking-wide">Competency Breakdown</h3>
               <div className="flex items-center gap-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Current
                  </div>
                  <div className="flex items-center gap-1.5 opacity-60">
                    <span className="w-2 h-2 rounded-full bg-white/10" /> Target
                  </div>
               </div>
            </div>

            <div className="space-y-6">
               {[
                 { label: "Communication", score: 75 },
                 { label: "Technical Knowledge", score: 92 },
                 { label: "Clarity", score: 78 },
                 { label: "Confidence", score: 84 },
               ].map((item, idx) => (
                 <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                       <span>{item.label}</span>
                       <span>{item.score}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${item.score}%` }}
                         transition={{ duration: 1, delay: 0.2 + idx * 0.1 }}
                         className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(41,98,255,0.3)]" 
                       />
                    </div>
                 </div>
               ))}
            </div>
         </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Key Strengths */}
         <Card className="p-6 border-white/5 bg-[#121922]">
            <div className="flex items-center gap-2 mb-6 text-success">
               <ThumbsUp className="w-4 h-4" />
               <h3 className="text-sm font-bold">Key Strengths</h3>
            </div>
            <div className="space-y-5">
               {[
                 { title: "Strong Algorithm Knowledge", desc: "Demonstrated deep understanding of time complexity and data structure optimization during the coding task." },
                 { title: "Calm Under Pressure", desc: "Maintained composure when asked difficult follow-up questions about system scalability." },
                 { title: "Concise Explanations", desc: "Able to summarize complex technical concepts into easily understandable business value." },
               ].map((item, idx) => (
                 <div key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <div>
                       <h4 className="text-[13px] font-bold text-white mb-1">{item.title}</h4>
                       <p className="text-[11px] font-medium text-text-secondary leading-relaxed">{item.desc}</p>
                    </div>
                 </div>
               ))}
            </div>
         </Card>

         {/* Areas to Improve */}
         <Card className="p-6 border-white/5 bg-[#1A1612]">
            <div className="flex items-center gap-2 mb-6 text-warning">
               <AlertTriangle className="w-4 h-4" />
               <h3 className="text-sm font-bold">Areas to Improve</h3>
            </div>
            <div className="space-y-5">
               {[
                 { title: "Structured Communication", desc: "Try using the STAR method (Situation, Task, Action, Result) more consistently for behavioral questions." },
                 { title: "Project Specifics", desc: "Provide more concrete metrics when discussing past project impacts (e.g., % improvement, revenue growth)." },
                 { title: "Eye Contact", desc: "Slightly more engagement with the camera would enhance perceived confidence levels." },
               ].map((item, idx) => (
                 <div key={idx} className="flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                    <div>
                       <h4 className="text-[13px] font-bold text-white mb-1">{item.title}</h4>
                       <p className="text-[11px] font-medium text-text-secondary leading-relaxed">{item.desc}</p>
                    </div>
                 </div>
               ))}
            </div>
         </Card>
      </div>

      {/* Review Recording */}
      <Card className="p-1 border-white/5 bg-surface/30 overflow-hidden relative group">
         <div className="w-full aspect-video bg-[#0A0A0F] rounded-xl flex items-center justify-center relative overflow-hidden">
            {/* Simulated background heatmap / video thumbnail */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-[#0A0A0F] to-secondary/10" />
            
            <div className="z-10 flex flex-col items-center">
               <button className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 transition-all shadow-xl group-hover:scale-110">
                  <Play className="w-6 h-6 text-white ml-1 fill-white" />
               </button>
               <h3 className="text-base font-bold text-white tracking-tight">Review Interview Recording</h3>
               <p className="text-xs font-medium text-text-muted mt-2 max-w-sm text-center">
                  Watch your session back with AI-generated heatmaps and transcript synchronization.
               </p>
            </div>
         </div>
      </Card>
    </div>
  );
}
