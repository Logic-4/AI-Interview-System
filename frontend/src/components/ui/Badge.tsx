"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        filled: "border-transparent",
        outlined: "bg-transparent",
        soft: "border-transparent bg-opacity-10",
      },
      color: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/80 border-primary",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-secondary",
        success: "bg-success text-success-foreground hover:bg-success/80 border-success",
        warning: "bg-warning text-warning-foreground hover:bg-warning/80 border-warning",
        danger: "bg-danger text-danger-foreground hover:bg-danger/80 border-danger",
        info: "bg-info text-info-foreground hover:bg-info/80 border-info",
        muted: "bg-muted text-muted-foreground hover:bg-muted/80 border-border",
      },
    },
    compoundVariants: [
      {
        variant: "soft",
        color: "primary",
        className: "bg-primary/10 text-primary border-transparent",
      },
      {
        variant: "soft",
        color: "secondary",
        className: "bg-secondary/10 text-secondary border-transparent",
      },
      {
        variant: "soft",
        color: "success",
        className: "bg-success/10 text-success border-transparent",
      },
      {
        variant: "soft",
        color: "warning",
        className: "bg-warning/10 text-warning border-transparent",
      },
      {
        variant: "soft",
        color: "danger",
        className: "bg-danger/10 text-danger border-transparent",
      },
      {
        variant: "soft",
        color: "info",
        className: "bg-info/10 text-info border-transparent",
      },
      {
        variant: "outlined",
        color: "primary",
        className: "text-primary border-primary hover:bg-primary/5",
      },
      {
        variant: "outlined",
        color: "secondary",
        className: "text-secondary border-secondary hover:bg-secondary/5",
      },
      {
        variant: "outlined",
        color: "success",
        className: "text-success border-success hover:bg-success/5",
      },
      {
        variant: "outlined",
        color: "warning",
        className: "text-warning border-warning hover:bg-warning/5",
      },
      {
        variant: "outlined",
        color: "danger",
        className: "text-danger border-danger hover:bg-danger/5",
      },
      {
        variant: "outlined",
        color: "info",
        className: "text-info border-info hover:bg-info/5",
      },
    ],
    defaultVariants: {
      variant: "filled",
      color: "primary",
    },
  }
);

export interface BadgeProps
  extends Omit<React.ComponentPropsWithoutRef<typeof motion.div>, "children" | "color">,
    VariantProps<typeof badgeVariants> {
  onClose?: () => void;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

function Badge({ className, variant, color, onClose, icon, children, ...props }: BadgeProps) {
  return (
    <motion.div
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={cn(badgeVariants({ variant, color: color as any }), className)}
      {...props}
    >
      {icon && <span className="mr-1.5">{icon}</span>}
      {children}
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1.5 rounded-full outline-none hover:bg-black/5 flex items-center justify-center p-0.5"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </motion.div>
  );
}

export { Badge, badgeVariants };
