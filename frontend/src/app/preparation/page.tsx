"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PreparationHeader } from "@/components/preparation/PreparationHeader";
import { PreSessionChecklist } from "@/components/preparation/PreSessionChecklist";
import { MicrophoneCheck } from "@/components/preparation/MicrophoneCheck";

export default function PreparationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [checks, setChecks] = useState({
    audio: true,
    environment: false,
    connectivity: false,
  });

  const handleStart = () => {
    setIsLoading(true);
    setTimeout(() => {
      router.push("/session");
    }, 1000);
  };

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-[#0E1117] text-text-primary flex flex-col font-sans">
      <PreparationHeader />

      <main className="flex-1 flex flex-col items-center pt-20 pb-12 px-6">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-semibold text-white tracking-tight mb-3">
            Interview Preparation
          </h1>
          <p className="text-text-muted text-[15px] max-w-md mx-auto">
            Let&apos;s ensure your environment is optimized for the best experience.
          </p>
        </div>

        <div className="w-full max-w-2xl space-y-6">
          <PreSessionChecklist checks={checks} toggleCheck={toggleCheck} />
          <MicrophoneCheck />

          <Button 
            size="xl" 
            onClick={handleStart}
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-14 rounded-xl text-base mt-2 shadow-[0_0_20px_rgba(41,98,255,0.2)]"
          >
            {isLoading ? (
               <LoadingSpinner size="sm" className="text-white" />
            ) : (
               <>Start Mock Interview <ArrowRight className="w-5 h-5 ml-2" /></>
            )}
          </Button>

          <p className="text-center text-[11px] font-bold tracking-widest text-text-muted uppercase mt-6">
            Estimated Duration: 25 Minutes
          </p>
        </div>
      </main>

      <footer className="py-8 text-center border-t border-white/5 bg-[#0A0C10]/50 mt-auto">
        <p className="text-[11px] text-text-muted">
          © {new Date().getFullYear()} AI Interview Pro. Professional Training Environment.
        </p>
      </footer>
    </div>
  );
}
