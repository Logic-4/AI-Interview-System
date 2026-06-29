import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, X, Mic2, FileText, Smile } from "lucide-react";
import ThemeToggle from "../../components/layout/ThemeToggle";

export default function ProcessingPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          navigate("/interviews/demo/report");
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-text-primary dark:text-white flex flex-col font-sans selection:bg-primary transition-colors duration-500">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-white-light dark:border-[#1b2e4b] bg-white/60 dark:bg-black/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-1.5 rounded-md shadow-lg shadow-primary/20 flex items-center justify-center text-white">
            <Bot className="w-5 h-5" />
          </div>
          <span className="font-bold tracking-tight">AI Mock Interview</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Interview Session</span>
            <span className="text-sm font-semibold text-text-primary dark:text-white">Senior Product Manager</span>
          </div>
          <div className="w-px h-6 bg-white-light dark:bg-[#1b2e4b] mx-2" />
          <ThemeToggle />
          <button 
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-foreground/5 hover:bg-[#000]/[0.04] dark:hover:bg-[#1b2e4b] flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />

        <div className="w-full max-w-2xl z-10 flex flex-col items-center">
          {/* Spinner Circle */}
          <div className="relative w-24 h-24 mb-10">
            <div className="absolute inset-0 rounded-full border-2 border-white-light dark:border-[#1b2e4b]" />
            <div 
              className="absolute inset-0 rounded-full border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin"
              style={{ animationDuration: '1.5s' }}
            />
            <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
               <Bot className="w-8 h-8 text-primary" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-text-primary dark:text-white text-center mb-4 leading-tight">
            Analyzing responses and generating<br />feedback...
          </h1>
          <p className="text-text-muted font-semibold text-center max-w-lg mb-16 text-sm">
            Our AI is evaluating your communication, technical accuracy, and confidence.
          </p>

          {/* Progress Bar Area */}
          <div className="w-full max-w-xl space-y-3">
             <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                <span className="text-primary font-bold">Processing Module {progress < 40 ? "1" : progress < 70 ? "2" : progress < 90 ? "3" : "4"} of 4</span>
                <span className="text-text-primary dark:text-white tabular-nums">{progress}%</span>
             </div>
             <div className="h-2 w-full bg-white-light dark:bg-[#1b2e4b] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-200 ease-out shadow-[0_0_10px_rgba(67,97,238,0.6)]" 
                  style={{ width: `${progress}%` }}
                />
             </div>
             <p className="text-center text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] pt-2">
                Estimated Time Remaining: {Math.max(1, Math.ceil((100 - progress) / 20))} SECONDS
              </p>
          </div>

          {/* Cards below */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-20">
             <div className="bg-[#fafafa] dark:bg-[#060818] border border-white-light dark:border-[#1b2e4b] rounded-md p-6 flex flex-col items-center text-center justify-center gap-2">
                <div className="text-primary mb-1">
                   <Mic2 className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-text-primary dark:text-white">Voice Tone</h3>
                <p className="text-[10px] text-text-muted font-semibold">Analyzing inflection and clarity</p>
             </div>
             
             <div className="bg-[#fafafa] dark:bg-[#060818] border border-white-light dark:border-[#1b2e4b] rounded-md p-6 flex flex-col items-center text-center justify-center gap-2">
                <div className="text-primary mb-1">
                   <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-text-primary dark:text-white">Keywords</h3>
                <p className="text-[10px] text-text-muted font-semibold">Checking technical terminology</p>
             </div>

             <div className="bg-[#fafafa] dark:bg-[#060818] border border-white-light dark:border-[#1b2e4b] rounded-md p-6 flex flex-col items-center text-center justify-center gap-2">
                <div className="text-primary mb-1">
                   <Smile className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-text-primary dark:text-white">Sentiment</h3>
                <p className="text-[10px] text-text-muted font-semibold">Assessing confidence levels</p>
             </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 border-t border-white-light dark:border-[#1b2e4b] flex items-center justify-between px-8 text-[11px] font-bold tracking-wider">
         <div className="flex items-center gap-2 text-text-muted">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            AI Core Online
         </div>
         <div className="flex items-center gap-6 text-text-muted opacity-80">
            <span>Total Interview Duration: 14m 22s</span>
            <span>Questions Answered: 5</span>
         </div>
         <div className="text-primary font-bold">
            Secured by Enterprise Grade AI
         </div>
      </footer>
    </div>
  );
}
