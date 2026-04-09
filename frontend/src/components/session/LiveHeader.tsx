import React from "react";
import { Settings, HelpCircle, Bot } from "lucide-react";

export function LiveHeader() {
  return (
      <header className="h-16 flex items-center justify-between px-6 border-b border-border/40 bg-surface/80 backdrop-blur-md relative z-20 transition-colors duration-500">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center border border-border/40">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-text-primary tracking-tight">AI Interviewer</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              Session Progress <span className="text-primary tracking-normal font-bold">3 / 10</span>
            </span>
            <div className="w-24 h-1 bg-foreground/10 rounded-full overflow-hidden">
               <div className="h-full bg-primary rounded-full w-[30%] shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" />
            </div>
          </div>
          <div className="w-px h-6 bg-border/40" />
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-full hover:bg-foreground/5 flex items-center justify-center transition-colors">
              <Settings className="w-[18px] h-[18px] text-text-muted hover:text-text-primary transition-colors" />
            </button>
            <button className="w-9 h-9 rounded-full hover:bg-foreground/5 flex items-center justify-center transition-colors">
              <HelpCircle className="w-[18px] h-[18px] text-text-muted hover:text-text-primary transition-colors" />
            </button>
          </div>
        </div>
      </header>
  );
}
