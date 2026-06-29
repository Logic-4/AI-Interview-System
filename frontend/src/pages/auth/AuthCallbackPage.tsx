import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import authService from "../../services/authService";
import toast from "react-hot-toast";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const handle = async () => {
      const accessToken = searchParams.get("accessToken");
      if (!accessToken) {
        toast.error("Authentication failed. No token received.");
        navigate("/login", { replace: true });
        return;
      }

      localStorage.setItem("accessToken", accessToken);

      try {
        const user = await authService.getMe();
        login(user, accessToken);
        toast.success("Signed in successfully!");
        navigate("/dashboard", { replace: true });
      } catch {
        localStorage.removeItem("accessToken");
        toast.error("Failed to load user profile.");
        navigate("/login", { replace: true });
      }
    };

    handle();
  }, [searchParams, login, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center transition-colors duration-500">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-text-muted text-sm font-semibold">Signing you in...</p>
      </div>
    </div>
  );
}
