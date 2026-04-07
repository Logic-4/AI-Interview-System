"use client";

import React, { useState } from "react";
import { 
  Download, 
  Play, 
  ChevronDown, 
  ChevronUp, 
  AlignLeft, 
  Sparkles, 
  Lightbulb
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface QuestionData {
  id: number;
  score: number;
  question: string;
  transcript: string;
  feedback: React.ReactNode;
  suggestedAnswer: string;
}

const questionsData: QuestionData[] = [
  {
    id: 1,
    score: 8.5,
    question: "Tell me about yourself.",
    transcript: "\"I have been working as a software engineer for 5 years. I love coding and solving complex problems. In my last role, I led a team of three where we built a new microservice architecture using Node.js and AWS...\"",
    feedback: (
      <>
        Your response is structured well using the <span className="text-primary font-bold">Present-Past-Future</span> model. You clearly stated your experience and leadership. To improve, emphasize the <span className="text-primary font-bold">specific business impact</span> of your leadership role with more concrete metrics.
      </>
    ),
    suggestedAnswer: "\"Currently, I'm a Senior Dev at X, where I've spent 5 years honing my skills in high-scale React systems. Previously, I led a team that reduced latency by 30% and improved deployment frequency by 2x. I'm now looking to apply this experience to help your team optimize its core infrastructure...\""
  },
  {
    id: 2,
    score: 4.2,
    question: "Why do you want to work at this company?",
    transcript: "\"I heard you guys have a good culture and pay well. Plus the tech stack is what I use.\"",
    feedback: (
      <>
        This response is too generic and lacks depth. You missed the opportunity to show you researched the company's recent products or mission.
      </>
    ),
    suggestedAnswer: "\"I'm drawn to your recent shift towards edge computing. I read the engineering blog post about your new caching layer, and as someone who's spent the last 2 years working on similar distributed challenges, I would love to contribute to that architecture.\""
  },
  {
    id: 3,
    score: 7.0,
    question: "Describe a difficult situation you handled.",
    transcript: "\"Once our database went down during a launch. Everyone panicked, but I found the bad query, killed it, and wrote a post-mortem so it wouldn't happen again.\"",
    feedback: (
      <>
        Good use of a real-world high-stakes scenario. However, the <span className="text-primary font-bold">Action</span> and <span className="text-primary font-bold">Result</span> parts of your STAR method were rushed. Detail *how* you identified the query and the exact outcome of the post-mortem.
      </>
    ),
    suggestedAnswer: "\"During a V2 launch, our primary database locked up. I took the lead, rallied the team, and identified an unindexed query causing a table scan. I immediately killed the PID, applied a hotfix index, and restored service in 8 minutes. We then established a new query review policy.\""
  },
  {
    id: 4,
    score: 9.2,
    question: "What are your greatest strengths?",
    transcript: "\"My biggest strength is debugging complex race conditions and my ability to mentor junior engineers to become productive very quickly.\"",
    feedback: (
      <>
        Excellent self-awareness highlighted by two highly valuable, distinct strengths. Very concise and confident.
      </>
    ),
    suggestedAnswer: "\"My biggest strength is debugging complex race conditions—which saved us from a major production bug last month—along with my ability to mentor junior engineers to achieve complete independence within their first 30 days.\""
  }
];

export default function QuestionFeedbackPage() {
  const [expandedId, setExpandedId] = useState<number | null>(1);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
         <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Interview Feedback</h1>
            <p className="text-[13px] font-medium text-text-muted leading-relaxed">
              Detailed analysis of your "Senior Software Engineer" mock interview session with AI-driven suggestions for improvement.
            </p>
         </div>
         <div className="flex items-center gap-3">
            <Button variant="outline" className="h-10 px-4 border-white/10 hover:bg-white/5 bg-surface/50 text-xs font-bold gap-2 rounded-xl">
               <Download className="w-4 h-4" />
               Download Report
            </Button>
            <Button className="h-10 px-5 bg-primary hover:bg-primary-light text-white text-xs font-bold gap-2 rounded-xl shadow-[0_0_15px_rgba(41,98,255,0.3)]">
               <Play className="w-4 h-4 fill-white flex-shrink-0" />
               New Session
            </Button>
         </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Overall Score */}
         <Card className="p-6 border-white/5 bg-surface/40 hover:-translate-y-1 transition-transform duration-300">
            <div className="flex items-center justify-between mb-4">
               <span className="text-xs font-bold text-text-muted tracking-wide">Overall Score</span>
               <div className="px-2 py-0.5 rounded flex items-center justify-center bg-success/10 text-success text-[10px] font-bold tracking-widest">
                  +1.2%
               </div>
            </div>
            <div className="flex items-baseline gap-2 mb-4">
               <span className="text-3xl font-black tabular-nums">7.8</span>
               <span className="text-sm font-bold text-text-muted">/ 10</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
               <div className="h-full w-[78%] bg-primary shadow-[0_0_10px_rgba(41,98,255,0.5)]" />
            </div>
         </Card>

         {/* Confidence Level */}
         <Card className="p-6 border-white/5 bg-surface/40 hover:-translate-y-1 transition-transform duration-300">
            <div className="flex items-center justify-between mb-4">
               <span className="text-xs font-bold text-text-muted tracking-wide">Confidence Level</span>
               <div className="px-2 py-0.5 rounded flex items-center justify-center bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase">
                  Stable
               </div>
            </div>
            <div className="mb-2">
               <span className="text-2xl font-black">High</span>
            </div>
            <p className="text-[11px] font-medium text-text-muted">
               Based on vocal analysis and pacing.
            </p>
         </Card>

         {/* Critical Gaps */}
         <Card className="p-6 border-white/5 bg-surface/40 hover:-translate-y-1 transition-transform duration-300">
            <div className="flex items-center justify-between mb-4">
               <span className="text-xs font-bold text-text-muted tracking-wide">Critical Gaps</span>
               <div className="px-2 py-0.5 rounded flex items-center justify-center bg-danger/10 text-danger text-[10px] font-bold tracking-widest uppercase">
                  Action Required
               </div>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
               <span className="text-2xl font-black tabular-nums">3</span>
               <span className="text-sm font-bold text-text-muted">Areas</span>
            </div>
            <p className="text-[11px] font-medium text-text-muted truncate">
               Technical depth, Metrics, Negotiation.
            </p>
         </Card>
      </div>

      {/* Question Analysis List */}
      <div>
         <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Question-by-Question Analysis</h2>
            <div className="flex items-center gap-4 text-[11px] font-bold text-text-muted">
               <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-success" /> Strong
               </div>
               <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-warning" /> Needs Work
               </div>
            </div>
         </div>

         <div className="space-y-4">
            {questionsData.map((q) => {
               const isExpanded = expandedId === q.id;
               const scoreColor = q.score >= 7.0 ? "text-success bg-success/10 border-success/20" : "text-warning bg-warning/10 border-warning/20";
               
               return (
                 <Card 
                   key={q.id} 
                   className={cn(
                     "border transition-all duration-300 overflow-hidden",
                     isExpanded ? "border-white/10 bg-surface/60" : "border-white/5 bg-surface/20 hover:bg-surface/40 hover:border-white/10 cursor-pointer"
                   )}
                 >
                   {/* Collapsed Header */}
                   <div 
                     className="px-6 py-5 flex items-center gap-4 select-none cursor-pointer"
                     onClick={() => toggleExpand(q.id)}
                   >
                      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-black border flex-shrink-0 tabular-nums", scoreColor)}>
                         {q.score.toFixed(1)}
                      </div>
                      <h3 className="text-sm font-bold flex-1">{q.question}</h3>
                      <div className="text-text-muted">
                         {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                   </div>

                   {/* Expanded Details */}
                   <AnimatePresence>
                      {isExpanded && (
                         <motion.div
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: "auto", opacity: 1 }}
                           exit={{ height: 0, opacity: 0 }}
                           transition={{ duration: 0.3, ease: "easeInOut" }}
                         >
                            <div className="px-6 pb-6 pt-2 border-t border-white/5 space-y-6">
                               {/* Row 1: Transcript & Feedback */}
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Transcript */}
                                  <div className="space-y-3">
                                     <div className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-widest">
                                        <AlignLeft className="w-3.5 h-3.5" />
                                        Candidate Transcript
                                     </div>
                                     <div className="p-4 rounded-xl bg-[#0D1117] border border-white/5 text-[13px] font-medium leading-relaxed opacity-80 text-text-secondary">
                                        {q.transcript}
                                     </div>
                                  </div>

                                  {/* Feedback */}
                                  <div className="space-y-3">
                                     <div className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-widest">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        AI Feedback
                                     </div>
                                     <div className="p-4 rounded-xl pb-1 text-[13px] font-medium leading-relaxed text-text-secondary">
                                        {q.feedback}
                                     </div>
                                  </div>
                               </div>

                               {/* Row 2: Suggested Better Answer */}
                               <div className="p-5 rounded-xl bg-primary/5 border border-primary/10">
                                  <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest mb-3">
                                     <Lightbulb className="w-3.5 h-3.5" />
                                     Suggested Better Answer
                                  </div>
                                  <p className="text-[13px] font-medium leading-relaxed opacity-90 text-text-primary">
                                     {q.suggestedAnswer}
                                  </p>
                               </div>
                            </div>
                         </motion.div>
                      )}
                   </AnimatePresence>
                 </Card>
               );
            })}
         </div>
      </div>
    </div>
  );
}
