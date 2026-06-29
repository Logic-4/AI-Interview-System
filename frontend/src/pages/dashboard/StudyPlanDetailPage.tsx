import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";

export default function StudyPlanDetailPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/study-plan", { replace: true });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-text-muted font-semibold animate-pulse">Redirecting to study plan...</p>
      </div>
    </div>
  );
}
