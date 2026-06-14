"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { 
  Bot, 
  X, 
  Settings, 
  LogOut,
  User as UserIcon 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { navItems } from "@/config/navigation";
import { User } from "@/types/user";

interface MobileSidebarProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function MobileSidebar({ user, isOpen, onClose, onLogout }: MobileSidebarProps) {
  const pathname = usePathname();

  const displayName = user?.name ?? 'User';
  
  const displayAvatar = (() => {
    if (!user?.avatar) return null;
    try {
      const parsed = new URL(user.avatar);
      return ['http:', 'https:'].includes(parsed.protocol) ? user.avatar : null;
    } catch { return null; }
  })();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] lg:hidden"
          />

          {/* Sidebar Drawer */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 w-[280px] max-w-[85vw] bg-surface z-[101] shadow-2xl flex flex-col border-r border-border/40 lg:hidden overflow-hidden"
          >
            {/* Header - Fixed */}
            <div className="p-6 flex items-center justify-between border-b border-border/40 shrink-0">
              <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3">
                <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-black tracking-tighter uppercase">
                  Interview<span className="text-primary">AI</span>
                </span>
              </Link>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-6">
              <nav className="px-4 space-y-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link 
                      key={item.id} 
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                        isActive 
                          ? "text-primary bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                          : "text-text-muted hover:text-text-primary hover:bg-foreground/[0.04]"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary" : "text-text-muted")} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="px-4 mt-8 space-y-4">
                <Link 
                  href="/settings"
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-text-muted hover:text-text-primary hover:bg-foreground/[0.04] transition-all"
                >
                  <Settings className="w-5 h-5 shrink-0" />
                  <span>Settings</span>
                </Link>

                {/* Usage Card */}
                <div className="mx-4 p-4 rounded-xl bg-surface-2/50 border border-border/40 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Usage Status</p>
                  {(() => {
                    const planLimits: Record<string, number | null> = { free: 10, pro: 50, enterprise: null };
                    const plan = user?.subscription?.plan ?? 'free';
                    const limit = planLimits[plan] ?? 10;
                    const used = user?.interviewCount ?? 0;
                    const pct = limit !== null ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                    return (
                      <>
                        <div className="h-1.5 w-full bg-foreground/10 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-700",
                              pct >= 90 ? 'bg-danger' : 'bg-primary'
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] font-bold text-text-muted leading-none">
                          {used}/{limit ?? '∞'} interviews used
                        </p>
                      </>
                    );
                  })()}
                </div>

                <button
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-text-muted hover:text-danger hover:bg-danger/10 transition-all"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>

            {/* Profile - Fixed */}
            <div className="p-6 border-t border-border/40 bg-surface/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-border/40 flex items-center justify-center overflow-hidden">
                  {displayAvatar ? (
                    <Image src={displayAvatar} alt={displayName} width={40} height={40} className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-text-muted" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold leading-none">{displayName}</p>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-1 opacity-60">
                    {user?.subscription?.plan ?? 'Free'}
                  </p>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
