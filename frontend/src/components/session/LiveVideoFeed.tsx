import React from "react";

export function LiveVideoFeed() {
  return (
        <div className="w-full max-w-[800px] h-[400px] bg-[#090C15] rounded-3xl border border-white/5 relative overflow-hidden shadow-2xl flex flex-col items-center justify-center mb-12">
          
          {/* Top Left Tag */}
          <div className="absolute top-5 left-5 bg-[#0E1320] border border-[#1A2234] rounded-full px-3 py-1.5 flex items-center gap-2 shadow-lg">
            <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            <span className="text-[11px] font-semibold tracking-wider text-white">AI Listening</span>
          </div>

          {/* AI Avatar */}
          <div className="w-48 h-48 rounded-full border-4 border-[#1A2234]/50 overflow-hidden relative shadow-[0_0_40px_rgba(59,130,246,0.1)]">
             <img 
               src="/ai-avatar.png" 
               alt="AI Interviewer" 
               className="w-full h-full object-cover" 
             />
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#090C15]/40 mix-blend-overlay" />
          </div>

          {/* AI Voice Waveform */}
          <div className="absolute bottom-10 flex items-end gap-1.5">
             {[3, 5, 8, 4, 6].map((h, i) => (
                <div 
                  key={i} 
                  className="w-1.5 bg-primary/60 rounded-t-full" 
                  style={{ 
                    height: `${h * 4}px`,
                    animation: `pulse ${1 + Math.random() * 0.5}s infinite alternate`
                  }} 
                />
             ))}
          </div>
        </div>
  );
}
