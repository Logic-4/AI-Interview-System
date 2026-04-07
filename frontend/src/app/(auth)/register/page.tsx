"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Bot, User, Mail, Lock, ShieldCheck, ArrowRight, Shield, Cpu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate registration
    setTimeout(() => {
      setIsLoading(false);
      router.push("/dashboard");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-text-primary selection:bg-primary selection:text-white flex flex-col">
      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-gradient-primary p-1.5 rounded-lg shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold tracking-tighter uppercase">
            Interview<span className="text-primary">AI</span>
          </span>
        </Link>
        <Link 
          href="/support" 
          className="text-sm font-semibold text-text-muted hover:text-text-primary transition-colors"
        >
          Support
        </Link>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative Background Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[480px] z-10"
        >
          <Card className="p-8 border-white/5 bg-surface/40 backdrop-blur-2xl shadow-2xl space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">Create Account</h1>
              <p className="text-text-muted font-medium text-sm">
                Join 10,000+ professionals mastering <br /> their interviews with AI.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <Input
                  label="Full Name"
                  placeholder="John Doe"
                  leftIcon={<User className="w-4 h-4" />}
                  required
                />
                
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="name@company.com"
                  leftIcon={<Mail className="w-4 h-4" />}
                  required
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    leftIcon={<Lock className="w-4 h-4" />}
                    required
                  />
                  <Input
                    label="Confirm"
                    type="password"
                    placeholder="••••••••"
                    leftIcon={<ShieldCheck className="w-4 h-4" />}
                    required
                  />
                </div>
              </div>

              {/* Agreement */}
              <div className="flex items-start gap-3">
                <div className="pt-1">
                   <input 
                     type="checkbox" 
                     id="terms"
                     className="w-4 h-4 rounded border-border bg-surface-3 text-primary focus:ring-primary focus:ring-offset-0 transition-all cursor-pointer accent-primary"
                     required
                   />
                </div>
                <label htmlFor="terms" className="text-xs text-text-muted font-medium leading-relaxed cursor-pointer select-none">
                  I agree to the{" "}
                  <Link href="/terms" className="text-primary hover:text-primary-light transition-colors font-bold">Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="/privacy" className="text-primary hover:text-primary-light transition-colors font-bold">Privacy Policy</Link>
                </label>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-sm font-bold uppercase tracking-wider shadow-lg shadow-primary/30 active:scale-95 transition-all text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Creating...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    Create Account
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </form>

            {/* Footer */}
            <div className="text-center pt-4 border-t border-white/5">
              <p className="text-sm text-text-muted font-medium">
                Already have an account?{" "}
                <Link 
                  href="/login" 
                  className="text-primary font-bold hover:text-primary-light transition-colors"
                >
                  Log in
                </Link>
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Bottom Trust Indicators */}
        <div className="mt-8 flex items-center justify-center gap-6 z-10">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted opacity-60">
            <Shield className="w-3.5 h-3.5" />
            Secure SSL
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted opacity-60">
            <Cpu className="w-3.5 h-3.5" />
            AI Powered
          </div>
        </div>

        {/* Brand Footer */}
        <p className="mt-12 text-[10px] font-bold text-text-muted opacity-40 uppercase tracking-widest">
          © 2024 InterviewAI System. All rights reserved.
        </p>
      </main>
    </div>
  );
}
