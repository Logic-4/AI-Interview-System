"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, User, Mail, Lock, ShieldCheck, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import authService from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";
import { sanitizeRedirectPath } from "@/lib/authRedirect";
import toast from "react-hot-toast";
import axios from "axios";
import ThemeToggle from "@/components/layout/ThemeToggle";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
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
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const { user, accessToken } = await authService.register({ name, email, password, rememberMe });
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
    <div className="min-h-screen bg-background flex flex-col lg:flex-row transition-colors duration-500 overflow-hidden">
      {/* --- Left Column: Branding & Decorative --- */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-2 flex-col justify-between p-12 overflow-hidden border-r border-border/40">
        {/* Abstract Background Elements */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] bg-info/5 rounded-full blur-[80px]" />
        
        <Link href="/" className="flex items-center gap-2 group relative z-10 w-fit">
          <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight uppercase text-text-primary">
            Interview<span className="text-primary">AI</span>
          </span>
        </Link>

        <div className="relative z-10 space-y-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Badge variant="soft" color="primary" className="mb-6 bg-primary/10 text-primary border-primary/20 px-3 py-1 font-bold tracking-widest uppercase text-[10px]">
              The Industry Standard
            </Badge>
            <h2 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight text-text-primary mb-6">
              Accelerate Your <br />
              <span className="text-primary italic">Career Path</span>
            </h2>
            <p className="text-lg text-text-secondary font-medium max-w-md leading-relaxed">
              Experience the next generation of interview preparation powered by proprietary AI models and real-time behavioral analytics.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-8 pt-12">
            <div>
              <p className="text-3xl font-black tracking-tight text-text-primary">95%</p>
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted mt-1">Success Rate</p>
            </div>
            <div>
              <p className="text-3xl font-black tracking-tight text-text-primary">12M+</p>
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted mt-1">Questions Analyzed</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs font-bold text-text-muted opacity-60 uppercase tracking-[0.2em]">
            Trusted by candidates at leading technology firms globally.
          </p>
        </div>
      </div>

      {/* --- Right Column: Auth Form --- */}
      <div className="flex-1 flex flex-col min-h-screen relative">
        {/* Mobile Nav Only */}
        <nav className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-border/40 bg-surface/60 backdrop-blur-md sticky top-0 z-50">
          <Link href="/" className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold tracking-tight uppercase">InterviewAI</span>
          </Link>
          <ThemeToggle />
        </nav>

        {/* Global Floating Actions */}
        <div className="absolute top-8 right-8 z-50 flex items-center gap-4">
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
         
        </div>

        <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-[440px] space-y-10"
          >
            {/* Header */}
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text-primary">Create your account</h1>
              <p className="text-text-secondary font-medium text-base">
                Join 10,000+ professionals mastering their interviews.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-5">
                <Input
                  label="Full Name"
                  placeholder="e.g. Alexander Hamilton"
                  leftIcon={<User className="w-4 h-4 text-text-muted" />}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-surface/50 border-border/60 focus:bg-surface transition-all h-12"
                  required
                />
                
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="name@company.com"
                  leftIcon={<Mail className="w-4 h-4 text-text-muted" />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-surface/50 border-border/60 focus:bg-surface transition-all h-12"
                  required
                />
                
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-surface/50 border-border/60 focus:bg-surface transition-all h-12"
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="hover:text-text-primary transition-colors p-2"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  required
                />
                <Input
                  label="Confirm"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  leftIcon={<ShieldCheck className="w-4 h-4 text-text-muted" />}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-surface/50 border-border/60 focus:bg-surface transition-all h-12"
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="hover:text-text-primary transition-colors p-2"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  required
                />
              </div>

              {/* Remember Me */}
              <div className="flex items-start gap-3 bg-surface-2/50 p-4 rounded-2xl border border-border/40">
                <div className="pt-0.5">
                   <input 
                     type="checkbox" 
                     id="remember-me"
                     className="w-4 h-4 rounded border-border bg-surface-3 text-primary focus:ring-primary focus:ring-offset-0 transition-all cursor-pointer accent-primary"
                     checked={rememberMe}
                     onChange={(e) => setRememberMe(e.target.checked)}
                   />
                </div>
                <label htmlFor="remember-me" className="text-xs text-text-secondary font-medium leading-relaxed cursor-pointer select-none">
                  Remember me on this device for a longer session.
                </label>
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
                    {isCheckingSession ? "Synchronizing..." : "In Progress..."}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    Create Account
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </Button>
            </form>

            <div className="text-center">
              <p className="text-sm font-medium text-text-secondary">
                Already have an account?{" "}
                <Link 
                  href="/login" 
                  className="text-primary font-bold hover:underline underline-offset-4 decoration-primary/30"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
