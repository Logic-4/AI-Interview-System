import React from "react";
import { MessageCircle, Settings, HelpCircle } from "lucide-react";

export function LiveHeader() {
  return (
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-[#12151C]/80 relative z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#182038] flex items-center justify-center border border-[#232F4D]">
            <MessageCircle className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-white tracking-tight">AI Interviewer</span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              Session Progress <span className="text-primary tracking-normal">3 / 10</span>
            </span>
            <div className="w-24 h-1 bg-[#1A1F2E] rounded-full overflow-hidden">
               <div className="h-full bg-primary rounded-full w-[30%]" />
            </div>
          </div>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors">
              <Settings className="w-[18px] h-[18px] text-text-muted" />
            </button>
            <button className="w-9 h-9 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors">
              <HelpCircle className="w-[18px] h-[18px] text-text-muted" />
            </button>
          </div>
        </div>
      </header>
  );
}
