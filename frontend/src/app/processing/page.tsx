"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, X, Mic2, FileText, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProcessingPage() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          router.push("/interviews/demo/report");
          return 100;
        }
        return prev + 2; // Increase by 2% every ~100ms = 5 seconds total
      });
    }, 100);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-text-primary flex flex-col font-sans selection:bg-primary selection:text-white">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#12151C]/80">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">AI Mock Interview</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Interview Session</span>
            <span className="text-sm font-semibold text-white">Senior Product Manager</span>
          </div>
          <button className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative Background Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />

        <div className="w-full max-w-2xl z-10 flex flex-col items-center">
          {/* Spinner Circle */}
          <div className="relative w-24 h-24 mb-10">
            {/* Outer spinning ring */}
            <div className="absolute inset-0 rounded-full border-2 border-white/5" />
            <div 
              className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"
              style={{ animationDuration: '1.5s' }}
            />
            {/* Inner pulsing circle */}
            <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
               <Bot className="w-8 h-8 text-primary shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white text-center mb-4 leading-tight">
            Analyzing responses and generating<br />feedback...
          </h1>
          <p className="text-text-muted font-medium text-center max-w-lg mb-16 text-sm">
            Our AI is evaluating your communication, technical accuracy, and confidence.
          </p>

          {/* Progress Bar Area */}
          <div className="w-full max-w-xl space-y-3">
             <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                <span className="text-primary">Processing Module {progress < 40 ? "1" : progress < 70 ? "2" : progress < 90 ? "3" : "4"} of 4</span>
                <span className="text-white">{progress}%</span>
             </div>
             <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-200 ease-out shadow-[0_0_10px_rgba(59,130,246,0.6)]" 
                  style={{ width: `${progress}%` }}
                />
             </div>
             <p className="text-center text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] pt-2">
                Estimated Time Remaining: {Math.max(1, Math.ceil((100 - progress) / 20))} SECONDS
             </p>
          </div>

          {/* Cards below */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-20">
             <div className="bg-surface/50 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center justify-center gap-2">
                <div className="text-primary mb-1">
                   <Mic2 className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Voice Tone</h3>
                <p className="text-[10px] text-text-muted font-medium">Analyzing inflection and clarity</p>
             </div>
             
             <div className="bg-surface/50 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center justify-center gap-2">
                <div className="text-primary mb-1">
                   <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Keywords</h3>
                <p className="text-[10px] text-text-muted font-medium">Checking technical terminology</p>
             </div>

             <div className="bg-surface/50 border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center justify-center gap-2">
                <div className="text-primary mb-1">
                   <Smile className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">Sentiment</h3>
                <p className="text-[10px] text-text-muted font-medium">Assessing confidence levels</p>
             </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 border-t border-white/5 flex items-center justify-between px-8 text-[11px] font-bold tracking-wider">
         <div className="flex items-center gap-2 text-text-muted">
            <div className="w-2 h-2 rounded-full bg-success" />
            AI Core Online
         </div>
         <div className="flex items-center gap-6 text-text-muted opacity-80">
            <span>Total Interview Duration: 14m 22s</span>
            <span>Questions Answered: 5</span>
         </div>
         <div className="text-primary">
            Secured by Enterprise Grade AI
         </div>
      </footer>
    </div>
  );
}
