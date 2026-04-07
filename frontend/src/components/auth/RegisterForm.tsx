"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

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
                  <div className="flex items-center justify-center gap-2">
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
  );
}
