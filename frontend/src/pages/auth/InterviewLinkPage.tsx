import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import authService from "../../services/authService";
import toast from "react-hot-toast";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";

export default function InterviewLinkPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuthStore();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const interviewId = searchParams.get("id");
    const token = searchParams.get("token");

    if (!token || !interviewId) {
      toast.error("Invalid interview link.");
      navigate("/login", { replace: true });
      return;
    }

    // If already authenticated, go straight to the interview
    if (isAuthenticated) {
      navigate(`/interviews/${interviewId}`, { replace: true });
      return;
    }

    const handle = async () => {
      try {
        const { accessToken, user } = await authService.redeemInterviewLink(token);
        login(user, accessToken);
        navigate(`/interviews/${interviewId}`, { replace: true });
      } catch {
        toast.error("This interview link has expired or is invalid. Please sign in.");
        navigate("/login", { replace: true });
      }
    };

    handle();
  }, [searchParams, login, isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center transition-colors duration-500">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="md" />
        <p className="text-text-muted text-sm font-semibold">Opening your interview...</p>
      </div>
    </div>
  );
}
