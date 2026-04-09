import React from "react";
import { Settings, HelpCircle, Bot } from "lucide-react";
import ThemeToggle from "@/components/layout/ThemeToggle";

export function PreparationHeader() {
  return (
      <header className="h-16 flex items-center justify-between px-6 border-b border-border/40 bg-surface/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-text-primary tracking-tight">InterviewAI</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button className="w-9 h-9 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors">
            <Settings className="w-4 h-4 text-text-muted" />
          </button>
          <button className="w-9 h-9 rounded-full bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center transition-colors">
            <HelpCircle className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </header>
  );
}
