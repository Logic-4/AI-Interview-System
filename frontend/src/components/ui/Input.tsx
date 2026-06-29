import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  success?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, leftIcon, rightIcon, success, ...props }, ref) => {
    return (
      <div className={cn("w-full space-y-1.5 group", error && "has-error", success && "has-success")}>
        {label && (
          <label className="text-sm font-semibold text-text-secondary dark:text-white-dark mb-1.5 block">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-primary z-10">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              "form-input",
              leftIcon && "pl-11",
              rightIcon && "pr-11",
              error && "border-danger focus:border-danger text-danger bg-danger/[0.08] placeholder-danger/70",
              success && "border-success focus:border-success text-success bg-success/[0.08] placeholder-success/70",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-primary z-10">
              {rightIcon}
            </div>
          )}
        </div>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-xs font-semibold text-danger mt-1"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
