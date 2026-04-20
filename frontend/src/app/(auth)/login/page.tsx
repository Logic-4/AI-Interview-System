"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, Mail, Lock, Eye, EyeOff, Github } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import authService from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";
import { sanitizeRedirectPath } from "@/lib/authRedirect";
import toast from "react-hot-toast";
import axios from "axios";
import ThemeToggle from "@/components/layout/ThemeToggle";

import { Badge } from "@/components/ui/Badge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(false);
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

  React.useEffect(() => {
    const errorMsg = searchParams.get("error");
    if (errorMsg) {
      toast.error(errorMsg);
      const cleaned = new URLSearchParams(searchParams.toString());
      cleaned.delete("error");
      const query = cleaned.toString();
      router.replace(query ? `/login?${query}` : "/login");
    }
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { user, accessToken } = await authService.login({ email, password, rememberMe });
      login(user, accessToken);
      router.replace(redirectPath);
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : "Invalid email or password. Please try again.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row transition-colors duration-500 overflow-hidden text-text-primary">
      {/* --- Left Column: Branding --- */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-2 flex-col justify-between p-12 overflow-hidden border-r border-border/40">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        
        <Link href="/" className="flex items-center gap-2 group relative z-10 w-fit">
          <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight uppercase">
            Interview<span className="text-primary">AI</span>
          </span>
        </Link>

        <div className="relative z-10 space-y-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Badge variant="soft" color="primary" className="mb-6 bg-primary/10 text-primary border-primary/20 px-3 py-1 font-bold tracking-widest uppercase text-[10px]">
              Premium Practice Environment
            </Badge>
            <h2 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight mb-6">
              Refine Your <br />
              <span className="text-primary italic">Executive Voice</span>
            </h2>
            <p className="text-lg text-text-secondary font-medium max-w-sm leading-relaxed">
              Sign in to access your personalized dashboard, track progress, and continue your path to mastery.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-text-muted">
            <span>© 2024 INTERVIEWAI</span>
            <span className="opacity-20">|</span>
            <span>PRIVACY</span>
            <span className="opacity-20">|</span>
            <span>TERMS</span>
          </div>
        </div>
      </div>

      {/* --- Right Column: Auth Form --- */}
      <div className="flex-1 flex flex-col min-h-screen relative">
        <nav className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-border/40 bg-surface/60 backdrop-blur-md sticky top-0 z-50">
          <Link href="/" className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold tracking-tight uppercase">InterviewAI</span>
          </Link>
          <ThemeToggle />
        </nav>

        <div className="absolute top-8 right-8 z-50 flex items-center gap-4">
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <Link 
            href="/help" 
            className="text-xs font-bold uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors border border-border/60 px-4 py-2 rounded-full hover:bg-surface-2"
          >
            Get Help
          </Link>
        </div>

        <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[400px] space-y-10"
          >
            <div className="space-y-3 text-center lg:text-left">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Welcome back</h1>
              <p className="text-text-secondary font-medium text-base">
                Continue your journey toward career excellence.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-5">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="name@nexus.com"
                  leftIcon={<Mail className="w-4 h-4 text-text-muted" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-surface/50 border-border/60 focus:bg-surface transition-all h-12"
                  required
                />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">Password</label>
                    <Link 
                      href="/forgot-password" 
                      className="text-xs font-black text-primary hover:underline underline-offset-4 decoration-primary/30"
                    >
                      Forgot?
                    </Link>
                  </div>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-surface/50 border-border/60 focus:bg-surface transition-all h-12"
                    rightIcon={
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="hover:text-text-primary transition-colors p-2"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="w-4 h-4 rounded border-border bg-surface-3 text-primary focus:ring-primary focus:ring-offset-0 transition-all cursor-pointer accent-primary"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <label htmlFor="remember-me" className="text-xs font-medium text-text-secondary cursor-pointer">
                    Remember me for a longer session
                  </label>
                </div>
              </div>

              <Button 
                type="submit" 
                size="xl"
                className="w-full shadow-xl shadow-primary/20 text-white font-black uppercase tracking-widest h-14"
                disabled={isLoading || isCheckingSession}
                noMotion
              >
                {isLoading || isCheckingSession ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    {isCheckingSession ? "Checking..." : "Signing in..."}
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-text-muted">
                <span className="bg-background px-4">Social Access</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-12 border-border/60 font-bold uppercase tracking-tighter text-xs"
                onClick={() => { window.location.href = `${API_BASE}/auth/google`; }}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" />
                </svg>
                Google
              </Button>
              <Button
                variant="outline"
                className="h-12 border-border/60 font-bold uppercase tracking-tighter text-xs"
                onClick={() => { window.location.href = `${API_BASE}/auth/github`; }}
              >
                <Github className="w-4 h-4 mr-2" />
                GitHub
              </Button>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm font-medium text-text-secondary">
                New to the platform?{" "}
                <Link 
                  href="/register" 
                  className="text-primary font-bold hover:underline underline-offset-4 decoration-primary/40"
                >
                  Create an account
                </Link>
              </p>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
