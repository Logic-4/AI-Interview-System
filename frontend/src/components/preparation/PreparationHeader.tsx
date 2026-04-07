import React from "react";
import { Settings, HelpCircle } from "lucide-react";

export function PreparationHeader() {
  return (
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#12151C]/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            {/* Logo placeholder */}
            <div className="w-4 h-4 border-2 border-white rounded-[4px] relative">
              <div className="w-1.5 h-1.5 bg-white rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
          <span className="font-bold text-white tracking-tight">AI Interview Pro</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <Settings className="w-4 h-4 text-text-muted" />
          </button>
          <button className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <HelpCircle className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </header>
  );
}
