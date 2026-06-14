"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function StudyPlanDetailPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/study-plan");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-text-muted font-medium animate-pulse">Redirecting to study plan...</p>
      </div>
    </div>
  );
}
