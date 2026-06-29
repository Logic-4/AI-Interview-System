import { motion } from "framer-motion";
import { Bot, Plus } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center rounded-md border-2 border-dashed border-white-light bg-white dark:border-[#1b2e4b] dark:bg-black shadow-inner",
        className
      )}
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="mb-6 w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(67,97,238,0.15)] ring-1 ring-primary/20"
      >
        {icon || <Bot size={48} strokeWidth={1.5} />}
      </motion.div>
      
      <h3 className="text-2xl font-bold tracking-tight text-text-primary dark:text-white mb-3">{title}</h3>
      <p className="text-base text-text-muted max-w-sm mb-10 leading-relaxed font-medium">
        {description}
      </p>

      {actionLabel && (
        <Button
          variant="premium"
          onClick={onAction}
          leftIcon={<Plus className="w-5 h-5" />}
          className="shadow-primary/30"
        >
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
};

export { EmptyState };
