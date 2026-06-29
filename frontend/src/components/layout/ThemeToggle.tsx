import { useDispatch, useSelector } from 'react-redux';
import { IRootState } from '../../store';
import { toggleTheme } from '../../store/themeConfigSlice';
import { Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

export default function ThemeToggle() {
  const themeConfig = useSelector((state: IRootState) => state.themeConfig);
  const dispatch = useDispatch();

  const isDark = themeConfig.theme === 'dark';

  return (
    <button
      onClick={() => dispatch(toggleTheme(isDark ? 'light' : 'dark'))}
      className={cn(
        "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
        "bg-white-light/30 dark:bg-[#1a2941]/50 border border-white-light dark:border-[#1b2e4b] overflow-hidden group",
        "hover:scale-105 active:scale-95 hover:shadow-lg"
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
            <Moon className="w-5 h-5 text-primary" />
          ) : (
            <Sun className="w-5 h-5 text-warning" />
          )}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
