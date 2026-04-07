import React from "react";
import { LiveHeader } from "@/components/session/LiveHeader";
import { LiveVideoFeed } from "@/components/session/LiveVideoFeed";
import { QuestionDisplay } from "@/components/session/QuestionDisplay";
import { LiveFooter } from "@/components/session/LiveFooter";

export default function LiveSessionPage() {
  return (
    <div className="min-h-screen bg-[#0E1117] text-text-primary flex flex-col font-sans selection:bg-primary/30">
      <LiveHeader />
      <main className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 w-full max-w-5xl mx-auto py-8">
        <LiveVideoFeed />
        <QuestionDisplay />
      </main>
      <LiveFooter />
      <style dangerouslySetInnerHTML={{__html:`
        @keyframes pulse {
          0% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}} />
    </div>
  );
}
