"use client";

import Link from "next/link";
import { Bot, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ThemeToggle from "@/components/layout/ThemeToggle";

const Navbar = () => {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-gradient-primary p-2 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.2)] group-hover:scale-110 transition-transform">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tighter text-text-primary">
              Interview<span className="text-primary">AI</span>
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-text-muted transition-colors">
            <Link href="#features" className="hover:text-text-primary">Features</Link>
            <Link href="#pricing" className="hover:text-text-primary">Pricing</Link>
            <div className="flex items-center gap-1 cursor-pointer hover:text-text-primary group/nav">
              <span>Solutions</span>
              <ChevronDown className="w-4 h-4 group-hover/nav:translate-y-0.5 transition-transform" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/login" className="hidden sm:block text-sm font-bold text-text-secondary hover:text-text-primary transition-colors">
            Log In
          </Link>
          <Button variant="primary" size="sm" className="px-5 font-semibold text-xs uppercase tracking-wider">
            Get Started
          </Button>
        </div>
      </div>
    </nav>
  );
};

export { Navbar };
