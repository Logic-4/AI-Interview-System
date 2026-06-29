import * as React from "react";
import toast, { Toaster, Toast as ToastType } from "react-hot-toast";
import { X, CheckCircle2, AlertCircle, Info, Trophy, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

type ToastProps = {
  toast: ToastType;
  type: "success" | "error" | "warning" | "info" | "achievement";
  title: string;
  message: string;
  xp?: number;
};

const icons = {
  success: <CheckCircle2 className="w-6 h-6 text-success" />,
  error: <AlertCircle className="w-6 h-6 text-danger" />,
  warning: <AlertCircle className="w-6 h-6 text-warning" />,
  info: <Info className="w-6 h-6 text-info" />,
  achievement: <Trophy className="w-6 h-6 text-primary" />,
};

const Toast = ({ toast: t, type, title, message, xp }: ToastProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "max-w-md w-full bg-white dark:bg-black border border-white-light dark:border-[#1b2e4b] rounded-md shadow-lg p-4 flex items-start gap-4 pointer-events-auto",
        type === "achievement" && "border-primary/20 bg-gradient-to-br from-white to-primary/5 shadow-primary/10"
      )}
    >
      <div className={cn(
        "flex-shrink-0 w-12 h-12 rounded-md flex items-center justify-center border border-white-light dark:border-[#1b2e4b]",
        type === "achievement" ? "bg-primary/10" : "bg-white-light/30 dark:bg-[#1a2941]/50"
      )}>
        {icons[type]}
      </div>

      <div className="flex-1 space-y-1 py-1">
        <h4 className="font-semibold text-text-primary dark:text-white text-sm tracking-tight">{title}</h4>
        <p className="text-sm text-text-secondary dark:text-white-dark leading-normal">{message}</p>
        
        {type === "achievement" && xp && (
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "fit-content" }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold mt-2"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+{xp} XP</span>
          </motion.div>
        )}
      </div>

      <button
        onClick={() => toast.dismiss(t.id)}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-white-light dark:hover:bg-[#1b2e4b] transition-colors text-text-muted hover:text-text-primary"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

export const showToast = {
  success: (title: string, message: string) =>
    toast.custom((t: ToastType) => <Toast toast={t} type="success" title={title} message={message} />),
  error: (title: string, message: string) =>
    toast.custom((t: ToastType) => <Toast toast={t} type="error" title={title} message={message} />),
  warning: (title: string, message: string) =>
    toast.custom((t: ToastType) => <Toast toast={t} type="warning" title={title} message={message} />),
  info: (title: string, message: string) =>
    toast.custom((t: ToastType) => <Toast toast={t} type="info" title={title} message={message} />),
  achievement: (title: string, message: string, xp?: number) =>
    toast.custom((t: ToastType) => <Toast toast={t} type="achievement" title={title} message={message} xp={xp} />),
};

export { Toaster };
