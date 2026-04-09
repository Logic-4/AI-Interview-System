"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import authService from "@/services/authService";
import toast from "react-hot-toast";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    const handle = async () => {
      const accessToken = searchParams.get("accessToken");
      if (!accessToken) {
        toast.error("Authentication failed. No token received.");
        router.replace("/login");
        return;
      }

      localStorage.setItem("accessToken", accessToken);

      try {
        const user = await authService.getMe();
        login(user, accessToken);
        toast.success("Signed in successfully!");
        router.replace("/dashboard");
      } catch {
        localStorage.removeItem("accessToken");
        toast.error("Failed to load user profile.");
        router.replace("/login");
      }
    };

    handle();
  }, [searchParams, login, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center transition-colors duration-500">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-text-muted text-sm font-medium">Signing you in...</p>
      </div>
    </div>
  );
}
