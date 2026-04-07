"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  variant?: "bar" | "circular" | "ring";
  size?: "sm" | "md" | "lg" | "xl";
  showValue?: boolean;
  gradient?: boolean;
  color?: "primary" | "secondary" | "success" | "warning" | "danger" | "info";
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, variant = "bar", size = "md", showValue = false, gradient = true, color = "primary", ...props }, ref) => {
  const percentage = Math.min(100, Math.max(0, value || 0));

  if (variant === "circular" || variant === "ring") {
    const strokeWidth = size === "sm" ? 4 : size === "md" ? 6 : size === "lg" ? 8 : 10;
    const radius = 50 - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    const dimensions = {
      sm: "h-12 w-12",
      md: "h-16 w-16",
      lg: "h-24 w-24",
      xl: "h-32 w-32",
    }[size];

    return (
      <div className={cn("relative flex items-center justify-center", dimensions, className)}>
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            className="text-surface-3"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
          />
          {/* Progress circle */}
          <motion.circle
            className={cn(
              !gradient && {
                primary: "text-primary",
                secondary: "text-secondary",
                success: "text-success",
                warning: "text-warning",
                danger: "text-danger",
                info: "text-info",
              }[color]
            )}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeInOut" }}
            strokeLinecap="round"
            stroke={gradient ? "url(#progressGradient)" : "currentColor"}
            fill="transparent"
            r={radius}
            cx="50"
            cy="50"
          />
          {gradient && (
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={`hsl(var(--${color}-gradient-start))`} />
                <stop offset="100%" stopColor={`hsl(var(--${color}-gradient-end))`} />
              </linearGradient>
            </defs>
          )}
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn(
               "font-bold text-text-primary leading-none",
               {
                 sm: "text-xs",
                 md: "text-sm",
                 lg: "text-lg",
                 xl: "text-2xl",
               }[size]
            )}>
              {percentage}%
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-1">
      {(showValue || props.title) && (
        <div className="flex justify-between items-end px-0.5">
          <span className="text-sm font-semibold text-text-primary">{props.title}</span>
          {showValue && <span className="text-xs font-bold text-text-secondary">{percentage}%</span>}
        </div>
      )}
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-surface-3",
          {
            sm: "h-1",
            md: "h-2",
            lg: "h-4",
            xl: "h-6",
          }[size],
          className
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          asChild
          className="h-full w-full flex-1 transition-all duration-500"
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        >
          <div className={cn(
            "h-full w-full",
            gradient ? `bg-gradient-${color}` : `bg-${color}`
          )} />
        </ProgressPrimitive.Indicator>
      </ProgressPrimitive.Root>
    </div>
  );
});
Progress.displayName = "Progress";

export { Progress };
