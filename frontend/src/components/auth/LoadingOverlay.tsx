"use client";

import { Bot } from "lucide-react";

export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-xl">
      {/* Outer pulsing ring */}
      <div className="relative flex items-center justify-center">
        <div className="absolute w-24 h-24 rounded-full bg-primary/10 animate-ping" />
        <div className="absolute w-20 h-20 rounded-full animate-spin-slow" style={{ border: '2px solid transparent', borderTopColor: 'hsl(var(--primary))', borderBottomColor: 'hsl(var(--primary))' }} />
        <div className="absolute w-16 h-16 rounded-full animate-spin-slow-reverse" style={{ border: '1.5px solid transparent', borderTopColor: 'hsl(var(--primary) / 0.5)' }} />
        {/* Center icon */}
        <div className="relative z-10 bg-gradient-to-br from-primary to-primary/70 p-3.5 rounded-2xl shadow-2xl shadow-primary/30">
          <Bot className="w-7 h-7 text-white" />
        </div>
      </div>

      {/* Loading dots */}
      <div className="mt-8 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-loading-dot-1" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-loading-dot-2" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-loading-dot-3" />
      </div>
      <p className="mt-3 text-sm font-semibold text-text-muted tracking-wide">Preparing your experience</p>
    </div>
  );
}
