"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudyPlanDetailPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/study-plan");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-text-muted font-medium">Redirecting to study plan...</p>
    </div>
  );
}
