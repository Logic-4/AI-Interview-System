"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { 
  Bell,
  Search,
  Menu,
  User
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import authService from "@/services/authService";
import ThemeToggle from "@/components/layout/ThemeToggle";
import Sidebar from "@/components/layout/Sidebar";
import MobileSidebar from "@/components/layout/MobileSidebar";

const ALLOWED_AVATAR_HOSTS = [
  'lh3.googleusercontent.com',
  'googleusercontent.com',
  'avatars.githubusercontent.com',
  'public.blob.vercel-storage.com',
  'localhost',
  '127.0.0.1',
];

const isTrustedAvatarUrl = (value?: string): boolean => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return ALLOWED_AVATAR_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );
  } catch { return false; }
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, logout, setUser } = useAuthStore();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  // Persistence for collapsed state
  React.useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) setIsSidebarCollapsed(saved === 'true');
  }, []);

  const handleToggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  const sessionChecked = React.useRef(false);

  React.useEffect(() => {
    if (sessionChecked.current) return;
    if (!user) {
      sessionChecked.current = true;
      authService.getMe()
        .then((fetchedUser) => setUser(fetchedUser))
        .catch(async () => {
          logout();
          try { await authService.logout(); } catch {}
          router.replace('/login');
        });
    }
  }, [logout, router, setUser, user]);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      logout();
      router.replace('/login');
    }
  };

  const displayName = user?.name ?? 'Loading...';
  const displayAvatar = isTrustedAvatarUrl(user?.avatar) ? user!.avatar! : null;

  if (!isMounted) return null;

  return (
    <div className="flex h-screen bg-background text-text-primary selection:bg-primary font-sans overflow-hidden transition-colors duration-500 w-full max-w-[100vw]">
      <Sidebar 
        user={user} 
        isCollapsed={isSidebarCollapsed} 
        onToggle={handleToggleSidebar} 
        onLogout={handleLogout}
      />

      <MobileSidebar 
        user={user} 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <motion.div 
        layout
        className="flex-1 flex flex-col h-screen overflow-hidden min-w-0"
      >
        {/* Top bar */}
        <header className="h-20 border-b border-border/40 flex items-center justify-between px-6 lg:px-8 bg-surface/60 backdrop-blur-md relative z-40">
           {/* Mobile Menu & Search */}
           <div className="flex items-center gap-4 flex-1">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors border border-border/40"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 max-w-md w-full relative hidden md:flex">
                <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search interviews..." 
                  className="w-full h-10 bg-foreground/[0.03] border border-border/40 rounded-xl pl-10 pr-4 text-sm font-medium focus:outline-none focus:border-primary/50 focus:bg-foreground/[0.05] transition-all text-text-primary placeholder:text-text-muted"
                />
              </div>
           </div>

           {/* User Actions */}
           <div className="flex items-center gap-2 sm:gap-4 ml-auto">
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              <div className="flex items-center gap-2">
                <button className="w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-foreground/[0.04] transition-all relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-3 right-3 w-1.5 h-1.5 bg-danger rounded-full border border-background" />
                </button>
              </div>
              <div className="w-px h-8 bg-border/40 mx-1 hidden sm:block" />
              <div className="flex items-center gap-2 sm:gap-3">
                 <div className="text-right hidden lg:block">
                    <p className="text-sm font-bold truncate max-w-[100px]">{displayName}</p>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none mt-0.5">
                      {user?.subscription?.plan ?? 'Free'}
                    </p>
                 </div>
                 <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-border/40 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                    {displayAvatar ? (
                      <Image src={displayAvatar} alt={displayName} width={40} height={40} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-text-muted" />
                    )}
                 </div>
              </div>
           </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto overflow-x-hidden custom-scrollbar relative bg-background/50">
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </motion.div>
    </div>
  );
}
