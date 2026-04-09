"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-xl bg-surface-2 border border-border animate-pulse" />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
        "bg-surface-2 hover:bg-surface-3 border border-border overflow-hidden group",
        "hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-primary/10"
      )}
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? "dark" : "light"}
          initial={{ y: 20, opacity: 0, rotate: -90 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -20, opacity: 0, rotate: 90 }}
          transition={{ duration: 0.3, ease: "backOut" }}
          className="relative z-10"
        >
          {isDark ? (
            <Moon className="w-5 h-5 text-primary group-hover:text-primary transition-colors" />
          ) : (
            <Sun className="w-5 h-5 text-tertiary group-hover:text-tertiary transition-colors" />
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Background glow effect */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        isDark ? "bg-gradient-to-tr from-primary/10 to-transparent" : "bg-gradient-to-tr from-tertiary/10 to-transparent"
      )} />
    </button>
  );
}
