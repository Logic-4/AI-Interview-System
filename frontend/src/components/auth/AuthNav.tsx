import React from "react";
import Link from "next/link";
import { Bot } from "lucide-react";

export function AuthNav() {
  return (
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
          href="/help" 
          className="text-sm font-semibold text-text-muted hover:text-text-primary transition-colors"
        >
          Help Center
        </Link>
      </nav>
  );
}
