"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bot, Mail, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import api from "@/services/api";
import axios from "axios";
import ThemeToggle from "@/components/layout/ThemeToggle";

import { Badge } from "@/components/ui/Badge";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err: unknown) {
      const message =
        axios.isAxiosError(err) && typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : "Something went wrong. Please try again.";
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
              Access Restoration
            </Badge>
            <h2 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight mb-6">
              Reclaim Your <br />
              <span className="text-primary italic">Expert Identity</span>
            </h2>
            <p className="text-lg text-text-secondary font-medium max-w-sm leading-relaxed">
              Secure access management is fundamental to your professional growth roadmap.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10">
          <p className="text-xs font-bold text-text-muted opacity-60 uppercase tracking-[0.2em]">
            Enterprise-grade credential recovery.
          </p>
        </div>
      </div>

      {/* --- Right Column: Form --- */}
      <div className="flex-1 flex flex-col min-h-screen relative">
        <nav className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-border/40 bg-surface/60 backdrop-blur-md sticky top-0 z-50">
          <Link href="/" className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold tracking-tight uppercase">InterviewAI</span>
          </Link>
          <ThemeToggle />
        </nav>

        <div className="absolute top-8 right-8 z-50">
          <ThemeToggle />
        </div>

        <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[400px] space-y-10"
          >
            {sent ? (
              <div className="space-y-8">
                <div className="space-y-3">
                   <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center border border-success/20 mb-6">
                     <CheckCircle2 className="w-8 h-8 text-success" />
                   </div>
                   <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Check inbox</h1>
                   <p className="text-text-secondary font-medium text-base leading-relaxed">
                     A recovery link has been dispatched to <span className="text-text-primary font-bold">{email}</span>.
                   </p>
                </div>
                <Link href="/login" className="block">
                  <Button variant="outline" className="w-full h-14 font-black uppercase tracking-widest border-border/60">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <Link href="/login" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-all mb-4 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Sign In
                  </Link>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Reset Password</h1>
                  <p className="text-text-secondary font-medium text-base">Enter your credentials to receive a recovery link.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="flex items-start gap-3 p-4 rounded-2xl border border-danger/20 bg-danger/5 text-sm">
                      <AlertCircle className="w-5 h-5 shrink-0 text-danger" />
                      <span className="font-bold text-text-primary leading-relaxed">{error}</span>
                    </div>
                  )}
                  
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

                  <Button 
                    type="submit" 
                    size="xl"
                    className="w-full shadow-xl shadow-primary/20 text-white font-black uppercase tracking-widest h-14"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2 text-white">
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Processing...
                      </div>
                    ) : "Process Recovery"}
                  </Button>
                </form>
              </>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
