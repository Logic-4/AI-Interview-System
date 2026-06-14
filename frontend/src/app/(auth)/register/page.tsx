"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, User, Mail, Lock, Eye, EyeOff, Github } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import authService from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";
import { sanitizeRedirectPath } from "@/lib/authRedirect";
import toast from "react-hot-toast";
import axios from "axios";
import ThemeToggle from "@/components/layout/ThemeToggle";
import LoadingOverlay from "@/components/auth/LoadingOverlay";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCheckingSession, setIsCheckingSession] = React.useState(true);

  const redirectPath = React.useMemo(
    () => sanitizeRedirectPath(searchParams.get("from")),
    [searchParams]
  );

  React.useEffect(() => {
    let active = true;

    const syncSession = async () => {
      try {
        const hasSession = await authService.validateSession();
        if (!active) return;

        if (!hasSession) {
          logout();
          return;
        }

        const user = await authService.getMe();
        if (!active) return;

        setUser(user);
        router.replace(redirectPath);
      } catch {
        if (!active) return;
        logout();
      } finally {
        if (active) setIsCheckingSession(false);
      }
    };

    syncSession();

    return () => {
      active = false;
    };
  }, [logout, redirectPath, router, setUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const { user, accessToken } = await authService.register({ name, email, password });
      login(user, accessToken);
      router.replace(redirectPath);
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : "Registration failed. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {isLoading && <LoadingOverlay />}
      <nav className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border/40 bg-surface/60 backdrop-blur-md shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary p-1.5 rounded-lg">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight uppercase text-text-primary">
            Interview<span className="text-primary">AI</span>
          </span>
        </Link>
        <ThemeToggle />
      </nav>

      <main className="flex-1 flex items-center justify-center px-4 md:px-6 py-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[380px] bg-surface border border-border/40 rounded-2xl p-6 md:p-7 flex flex-col gap-4 shadow-lg"
        >
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary">Create your account</h1>
            <p className="text-text-secondary text-sm mt-1">
              Join 10,000+ professionals mastering their interviews.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Input
              label="Full Name"
              placeholder="e.g. Alexander Hamilton"
              leftIcon={<User className="w-4 h-4 text-text-muted" />}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-surface/50 border-border/60 h-11"
              required
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="name@company.com"
              leftIcon={<Mail className="w-4 h-4 text-text-muted" />}
              value={email}
              onChange={(e) => setEmail(e.target.value.replace(/\s/g, ""))}
              className="bg-surface/50 border-border/60 h-11"
              required
            />

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Password</label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\s/g, ""))}
                className="bg-surface/50 border-border/60 h-11"
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="hover:text-text-primary transition-colors p-1.5"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                required
              />
            </div>



            <Button
              type="submit"
              size="xl"
              className="w-full shadow-xl shadow-primary/20 text-white font-black uppercase tracking-widest h-12 text-sm"
              disabled={isLoading || isCheckingSession}
              noMotion
            >
              {isLoading || isCheckingSession ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  {isCheckingSession ? "Synchronizing..." : "In Progress..."}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  Create Account
                </div>
              )}
            </Button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-border/60" />
            <span className="text-[9px] uppercase font-black tracking-widest text-text-muted shrink-0">Or continue with</span>
            <div className="flex-1 border-t border-border/60" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-10 border-border/60 font-bold uppercase tracking-tighter text-[11px]"
              onClick={() => { window.location.href = `${API_BASE}/auth/google`; }}
            >
              <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" />
              </svg>
              Google
            </Button>
            <Button
              variant="outline"
              className="h-10 border-border/60 font-bold uppercase tracking-tighter text-[11px]"
              onClick={() => { window.location.href = `${API_BASE}/auth/github`; }}
            >
              <Github className="w-3.5 h-3.5 mr-1.5" />
              GitHub
            </Button>
          </div>

          <p className="text-center text-sm font-medium text-text-secondary">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary font-bold hover:underline"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
