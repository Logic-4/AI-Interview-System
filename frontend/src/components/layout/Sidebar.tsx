"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  Bot, 
  LogOut, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  User as UserIcon 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { navItems } from "@/config/navigation";
import { User } from "@/types/user";

interface SidebarProps {
  user: User | null;
  isCollapsed: boolean;
  onToggle: () => void;
  onLogout: () => void;
}

export default function Sidebar({ user, isCollapsed, onToggle, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const displayName = user?.name ?? 'Loading...';
  
  const displayAvatar = (() => {
    if (!user?.avatar) return null;
    try {
      const parsed = new URL(user.avatar);
      return ['http:', 'https:'].includes(parsed.protocol) ? user.avatar : null;
    } catch { return null; }
  })();

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="hidden lg:block relative z-50 group/sidebar"
    >
      {/* Actual Sidebar Content Container */}
      <div className="w-full h-full flex flex-col border-r border-border/40 bg-surface/60 backdrop-blur-xl overflow-hidden shadow-sm">
        
        {/* Logo Section - Fixed height */}
        <div className={cn("p-6 shrink-0", isCollapsed && "px-4 flex justify-center")}>
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col"
              >
                <span className="text-xl font-black tracking-tighter uppercase whitespace-nowrap leading-none">
                  Interview<span className="text-primary">AI</span>
                </span>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1 opacity-60">
                  {user?.subscription?.plan ?? 'Free'} Plan
                </span>
              </motion.div>
            )}
          </Link>
        </div>

        {/* Scrollable Area: Nav + Usage/Settings */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-2">
          {/* Navigation */}
          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.id} 
                  href={item.href}
                  className={cn(
                    "flex items-center py-2.5 rounded-xl text-sm font-bold transition-all relative group overflow-hidden",
                    isCollapsed ? "justify-center px-0" : "px-4 gap-3",
                    isActive 
                      ? "text-primary bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                      : "text-text-muted hover:text-text-primary hover:bg-foreground/[0.04]"
                  )}
                >
                  <item.icon className={cn("w-5 h-5 transition-colors shrink-0", isActive ? "text-primary" : "text-text-muted group-hover:text-text-primary")} />
                  
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}

                  {isActive && !isCollapsed && (
                    <motion.div 
                      layoutId="active-nav"
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-3/5 bg-primary rounded-l-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Secondary Actions & Usage */}
          <div className={cn("px-3 mt-6 space-y-2", isCollapsed && "px-3")}>
            <Link 
              href="/settings"
              className={cn(
                "flex items-center py-2.5 rounded-xl text-sm font-bold text-text-muted hover:text-text-primary hover:bg-foreground/[0.04] transition-all",
                isCollapsed ? "justify-center px-0" : "px-4 gap-3"
              )}
            >
              <Settings className={cn("w-5 h-5 shrink-0")} />
              {!isCollapsed && <span>Settings</span>}
            </Link>

            <AnimatePresence>
              {!isCollapsed && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 rounded-xl bg-surface-2/50 border border-border/40 space-y-2 overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Usage</p>
                    {(() => {
                      const planLimits: Record<string, number | null> = { free: 10, pro: 50, enterprise: null };
                      const plan = user?.subscription?.plan ?? 'free';
                      const limit = planLimits[plan] ?? 10;
                      const used = user?.interviewCount ?? 0;
                      const pct = limit !== null ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                      return (
                        <span className={cn("text-[9px] font-bold", pct >= 90 ? "text-danger" : "text-primary")}>
                          {pct}%
                        </span>
                      );
                    })()}
                  </div>
                  {(() => {
                    const planLimits: Record<string, number | null> = { free: 10, pro: 50, enterprise: null };
                    const plan = user?.subscription?.plan ?? 'free';
                    const limit = planLimits[plan] ?? 10;
                    const used = user?.interviewCount ?? 0;
                    const pct = limit !== null ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                    return (
                      <>
                        <div className="h-1 w-full bg-foreground/10 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-700",
                              pct >= 90 ? 'bg-danger' : 'bg-primary'
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[9px] font-bold text-text-muted opacity-80 leading-none">
                          {used}/{limit ?? '∞'} interviews
                        </p>
                      </>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={onLogout}
              className={cn(
                "w-full flex items-center py-2.5 rounded-xl text-sm font-bold text-text-muted hover:text-danger hover:bg-danger/10 transition-all",
                isCollapsed ? "justify-center px-0" : "px-4 gap-3"
              )}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span>Log Out</span>}
            </button>
          </div>
        </div>

        {/* User Profile - Fixed at bottom */}
        <div className={cn("p-4 shrink-0 border-t border-border/40 bg-surface/40", isCollapsed ? "px-3" : "px-4")}>
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-border/40 flex items-center justify-center text-sm font-semibold text-primary overflow-hidden shadow-inner shrink-0 relative">
              {displayAvatar ? (
                <Image src={displayAvatar} alt={displayName} width={40} height={40} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-4 h-4 text-text-muted" />
              )}
              <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-background" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold truncate leading-none">{displayName}</p>
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1 opacity-60">
                  {user?.subscription?.plan ?? 'Free'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapse Toggle Button - Outside Content Area */}
      <button
        onClick={onToggle}
        className="absolute -right-3.5 top-7 w-7 h-7 bg-surface border border-border/60 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary shadow-lg z-[60] transition-all hover:scale-110 active:scale-95 group-hover/sidebar:opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </motion.aside>
  );
}
