"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Bot, 
  Home, 
  Play, 
  History, 
  BarChart3, 
  BookOpen, 
  LogOut, 
  Settings, 
  Bell,
  Search,
  ChevronRight,
  FileText,
  MessageSquare,
  Target,
  ClipboardList
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home, href: "/dashboard" },
  { id: "interviews", label: "New Interview", icon: Play, href: "/interviews/new" },
  { id: "history", label: "Interview History", icon: History, href: "/interviews" },
  { id: "results", label: "Interview Results", icon: FileText, href: "/interviews/demo/report" },
  { id: "feedback", label: "Question Feedback", icon: MessageSquare, href: "/interviews/demo/review" },
  { id: "analytics", label: "Progress Analytics", icon: BarChart3, href: "/analytics" },
  { id: "practice-recommendations", label: "Study Plan", icon: Target, href: "/study-plan" },
  { id: "practice-library", label: "Practice Library", icon: BookOpen, href: "/questions" }
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-[#0A0A0F] text-text-primary selection:bg-primary font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-black/20 backdrop-blur-xl flex flex-col z-50 overflow-hidden">
        {/* Sidebar Logo */}
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-semibold tracking-tighter uppercase whitespace-nowrap leading-none">
                Interview<span className="text-primary font-semibold uppercase">AI</span>
              </span>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1 opacity-60">Pro Plan</span>
            </div>
          </Link>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.id} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all relative group",
                  isActive 
                    ? "text-primary bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                    : "text-text-muted hover:text-text-primary hover:bg-white/[0.04]"
                )}
              >
                <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-primary" : "text-text-muted group-hover:text-text-primary")} />
                {item.label}
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-3/5 bg-primary rounded-l-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 space-y-4">
          <Link 
            href="/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-text-muted hover:text-text-primary hover:bg-white/[0.04] transition-all"
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>

          {/* Usage Card */}
          <div className="p-4 rounded-xl bg-surface/40 border border-white/5 space-y-3">
             <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Usage</p>
             <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-[65%] bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
             </div>
             <p className="text-[10px] font-bold text-text-muted opacity-80">13 of 20 tokens used</p>
          </div>

          <div className="group cursor-pointer flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors border-t border-white/5 pt-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10 flex items-center justify-center text-sm font-semibold text-primary overflow-hidden shadow-inner font-sans">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Rivera" alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-[#0A0A0F]" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate leading-none">Alex Rivera</p>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Pro Member</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top bar */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-black/10 backdrop-blur-md">
           {/* Search Bar */}
           <div className="flex items-center gap-2 max-w-md w-full relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search interviews, questions, insights..." 
                className="w-full h-10 bg-white/[0.03] border border-white/5 rounded-lg pl-10 pr-4 text-sm font-medium focus:outline-none focus:border-primary/50 focus:bg-white/[0.05] transition-all text-text-primary placeholder:text-text-muted"
              />
           </div>

           {/* User Actions */}
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button className="w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.04] transition-all relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-3 right-3 w-1.5 h-1.5 bg-danger rounded-full border border-background" />
                </button>
              </div>
              <div className="w-px h-10 bg-white/5 mx-2" />
              <div className="flex items-center gap-3">
                 <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold">Alex Rivera</p>
                 </div>
                 <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10 flex items-center justify-center overflow-hidden">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Rivera" alt="Avatar" className="w-full h-full object-cover" />
                 </div>
              </div>
           </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-8 overflow-y-auto custom-scrollbar relative">
          {/* Subtle Background Glows */}
          <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-secondary/5 rounded-full blur-[80px] pointer-events-none" />

          {children}
        </main>
      </div>
    </div>
  );
}
