import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { cn } from "../../lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const LoadingSpinner = ({ size = "md", className }: LoadingSpinnerProps) => {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-14 w-14",
    lg: "h-20 w-20",
    xl: "h-32 w-32",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-7 w-7",
    lg: "h-10 w-10",
    xl: "h-16 w-16",
  };

  return (
    <div className={cn("relative flex items-center justify-center", sizes[size], className)}>
      {/* Background ring */}
      <div className="absolute inset-0 rounded-full border-4 border-primary/10" />
      
      {/* Animated spinning border */}
      <motion.div
        className="absolute inset-0 rounded-full border-t-4 border-primary"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />

      {/* Floating logo icon */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className="text-primary z-10"
      >
        <Bot className={iconSizes[size]} />
      </motion.div>
    </div>
  );
};

export { LoadingSpinner };
