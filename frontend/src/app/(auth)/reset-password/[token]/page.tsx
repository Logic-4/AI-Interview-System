"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import { Bot, Lock, ShieldCheck, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import api from "@/services/api";
import axios from "axios";
import ThemeToggle from "@/components/layout/ThemeToggle";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setIsLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setDone(true);
      setTimeout(() => router.replace("/login"), 3000);
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : "Reset failed. The recovery link may have expired.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row transition-colors duration-500 overflow-hidden text-text-primary">
      {/* --- Left Column: Branding --- */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-surface-2 flex-col justify-between p-12 overflow-hidden border-r border-border/40">
        <div className="absolute top-[-15%] right-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
        
        <Link href="/" className="flex items-center gap-2 group relative z-10 w-fit">
          <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tighter uppercase">
            Interview<span className="text-primary">AI</span>
          </span>
        </Link>

        <div className="relative z-10 space-y-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Badge variant="soft" color="primary" className="mb-6 bg-primary/10 text-primary border-primary/20 px-3 py-1 font-bold tracking-widest uppercase text-[10px]">
              Security Protocol
            </Badge>
            <h2 className="text-6xl font-black tracking-tighter leading-[0.9] uppercase mb-6">
              Secure Your <br />
              <span className="text-primary italic">Expert Identity</span>
            </h2>
            <p className="text-xl text-text-secondary font-medium max-w-sm leading-relaxed">
              Your professional credentials are being restored. Choose a strong new security key to continue.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 text-xs font-bold text-text-muted opacity-60 uppercase tracking-[0.2em]">
            <span>Encrypted Session</span>
            <div className="w-1 h-1 bg-text-muted rounded-full" />
            <span>Biometric Ready</span>
          </div>
        </div>
      </div>

      {/* --- Right Column: Form --- */}
      <div className="flex-1 flex flex-col min-h-screen relative">
        <nav className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-border/40 bg-surface/60 backdrop-blur-md sticky top-0 z-50">
          <Link href="/" className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <span className="text-lg font-black tracking-tighter uppercase">InterviewAI</span>
          </Link>
          <ThemeToggle />
        </nav>

        <div className="absolute top-8 right-8 z-50 hidden lg:block">
          <ThemeToggle />
        </div>

        <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-y-auto">
          {/* Decorative background for mobile */}
          <div className="lg:hidden absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-secondary/[0.02] -z-10" />

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[400px] space-y-10 py-12"
          >
            <AnimatePresence mode="wait">
              {done ? (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <div className="space-y-3">
                     <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center border border-success/20 mb-6 scale-in">
                       <CheckCircle2 className="w-8 h-8 text-success" />
                     </div>
                     <h1 className="text-4xl font-black tracking-tighter uppercase">Key Updated</h1>
                     <p className="text-text-secondary font-medium text-base leading-relaxed">
                       Your security credentials have been successfully restored. We are redirecting you to the portal.
                     </p>
                  </div>
                  <div className="p-4 rounded-xl bg-foreground/[0.03] border border-border/40 flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Redirecting to login...</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="form"
                  initial={false}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-10"
                >
                  <div className="space-y-3">
                    <Badge variant="soft" color="success" className="mb-2 bg-success/10 text-success border-success/20 font-bold tracking-widest uppercase text-[10px]">
                      RESTORE ACCESS
                    </Badge>
                    <h1 className="text-4xl font-black tracking-tighter uppercase">Set New Password</h1>
                    <p className="text-text-secondary font-medium text-base">Initialize your new account security key.</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                      <div className="flex items-start gap-3 p-4 rounded-2xl border border-danger/20 bg-danger/5 text-sm">
                        <AlertCircle className="w-5 h-5 shrink-0 text-danger" />
                        <span className="font-bold text-text-primary leading-relaxed">{error}</span>
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      <Input
                        label="New Password"
                        type="password"
                        placeholder="••••••••"
                        leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-surface/50 border-border/60 focus:bg-surface transition-all h-14"
                        required
                      />

                      <Input
                        label="Confirm New Password"
                        type="password"
                        placeholder="••••••••"
                        leftIcon={<ShieldCheck className="w-4 h-4 text-text-muted" />}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-surface/50 border-border/60 focus:bg-surface transition-all h-14"
                        required
                      />
                    </div>

                    <Button 
                      type="submit" 
                      size="xl"
                      className="w-full shadow-xl shadow-primary/20 text-white font-black uppercase tracking-widest h-14 mt-4"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2 text-white">
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Restoring...
                        </div>
                      ) : "Confirm Restoration"}
                    </Button>
                  </form>

                  <div className="pt-8 border-t border-border/40">
                    <Link href="/login" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-all group">
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                      Back to Sign In
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
