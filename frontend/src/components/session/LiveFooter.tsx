"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MicOff, Mic, ChevronRight, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export function LiveFooter() {
  const router = useRouter();
  const [isMuted, setIsMuted] = useState(false);
  const [time, setTime] = useState(225);

  useEffect(() => {
    const timer = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
      <footer className="h-[100px] border-t border-border/40 bg-surface flex items-center justify-between px-6 lg:px-12 w-full mt-auto relative z-20 transition-colors duration-500">
         {/* Left: Recording Status & Waveform */}
         <div className="flex items-center gap-6 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-danger shadow-[0_0_8px_rgba(var(--danger-rgb),0.8)] animate-pulse" />
              <span className="text-xs font-semibold tracking-widest text-danger">REC</span>
            </div>
            
            <div className="hidden md:flex items-center gap-1 opacity-80">
              {/* User Voice Waveform */}
              {[1, 2, 4, 3, 5, 2, 1, 3, 2, 1, 4].map((h, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-1 rounded-full",
                    i < 5 ? "bg-primary" : "bg-foreground/10"
                  )}
                  style={{ height: `${h * 6}px` }} 
                />
              ))}
            </div>
         </div>

         {/* Center: Main Controls */}
         <div className="flex items-center gap-4 flex-none">
            <span className="text-lg font-bold text-text-primary tabular-nums tracking-widest font-mono mr-2">
              {formatTime(time)}
            </span>
            
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                "h-12 px-5 rounded-xl border flex items-center gap-2 transition-all font-bold text-sm shadow-sm",
                isMuted 
                  ? "bg-danger/10 border-danger/20 text-danger hover:bg-danger/20" 
                  : "bg-foreground/5 border-border/40 text-text-secondary hover:bg-foreground/10"
              )}
            >
              {isMuted ? (
                <>
                  <MicOff className="w-[18px] h-[18px] stroke-[2.5]" />
                  Muted
                </>
              ) : (
                <>
                  <Mic className="w-[18px] h-[18px] stroke-[2.5] text-danger" />
                  Mute
                </>
              )}
            </button>

            <button 
              onClick={() => router.push("/processing")}
              className="h-14 bg-primary hover:bg-primary/90 text-white rounded-xl px-8 flex items-center gap-3 shadow-[0_0_20px_rgba(var(--primary-rgb),0.25)] transition-all transform hover:scale-[1.02]"
            >
               <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-[2px]" />
               </div>
               <div className="flex flex-col items-start leading-none gap-1">
                 <span className="text-sm font-semibold tracking-tight">Stop &</span>
                 <span className="text-[11px] font-bold uppercase tracking-wider">Submit Answer</span>
               </div>
            </button>

            <button className="h-12 bg-foreground/5 hover:bg-foreground/10 border border-border/40 text-text-secondary rounded-xl px-6 flex items-center gap-2 transition-colors">
               <span className="text-sm font-bold">Next</span>
               <div className="flex flex-col items-start leading-none">
                 <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Question</span>
               </div>
               <ChevronRight className="w-4 h-4 ml-1" />
            </button>
         </div>

         {/* Right: Technical Stats */}
         <div className="flex flex-col items-end gap-1.5 flex-1 opacity-50 hover:opacity-100 transition-opacity cursor-default">
            <div className="flex items-center gap-1.5 text-text-primary">
               <Wifi className="w-[14px] h-[14px]" />
               <span className="text-[10px] font-semibold tracking-wider uppercase">Latency: 24ms</span>
            </div>
            <span className="text-[9px] font-medium tracking-wide text-text-muted">Camera & Mic Enabled</span>
         </div>
      </footer>
  );
}
