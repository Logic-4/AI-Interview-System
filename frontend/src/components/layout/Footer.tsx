"use client";

import Link from "next/link";
import { Bot, Zap, Home, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-bg-glow py-16 px-6 lg:px-8 bg-surface-2/30 backdrop-blur-3xl border-t border-white/5">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-white/5 pb-12">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-gradient-primary p-1.5 rounded-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tighter text-text-primary uppercase">
              Interview<span className="text-primary">AI</span>
            </span>
          </Link>

          <nav className="flex flex-wrap justify-center gap-8 text-sm font-semibold text-text-muted">
            <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-text-primary transition-colors">Terms of Service</Link>
            <Link href="/contact" className="hover:text-text-primary transition-colors">Contact</Link>
          </nav>

          <div className="flex items-center gap-6">
             <Link href="#" className="text-text-muted hover:text-primary transition-colors">
               <Bot className="w-5 h-5" />
             </Link>
             <Link href="#" className="text-text-muted hover:text-primary transition-colors">
               <Zap className="w-5 h-5" />
             </Link>
             <Link href="#" className="text-text-muted hover:text-primary transition-colors">
               <Home className="w-5 h-5" />
             </Link>
             <Link href="#" className="text-text-muted hover:text-primary transition-colors">
               <Users className="w-5 h-5" />
             </Link>
          </div>
        </div>

        <div className="mt-8 text-center">
           <p className="text-xs font-bold uppercase tracking-widest text-text-muted opacity-50">
             © {currentYear} INTERVIEWAI. ALL RIGHTS RESERVED.
           </p>
        </div>
      </div>
    </footer>
  );
};

export { Footer };
