import * as React from "react";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export interface BadgeProps
  extends Omit<React.ComponentPropsWithoutRef<typeof motion.div>, "children" | "color"> {
  variant?: "filled" | "outlined" | "soft";
  color?: "primary" | "secondary" | "success" | "warning" | "danger" | "info" | "muted";
  onClose?: () => void;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

function Badge({ className, variant = "filled", color = "primary", onClose, icon, children, ...props }: BadgeProps) {
  
  // Map color + variant to Vristo badge styles
  const badgeClass = (() => {
    const isOutlined = variant === "outlined";
    const isSoft = variant === "soft";
    
    if (isOutlined) {
      switch (color) {
        case "secondary": return "badge badge-outline-secondary";
        case "success": return "badge badge-outline-success";
        case "warning": return "badge badge-outline-warning";
        case "danger": return "badge badge-outline-danger";
        case "info": return "badge badge-outline-info";
        case "muted": return "badge badge-outline-dark";
        default: return "badge badge-outline-primary";
      }
    } else if (isSoft) {
      // Vristo doesn't have native soft badges, so we use background opacity or local css variables
      switch (color) {
        case "secondary": return "badge bg-secondary/10 text-secondary border-transparent";
        case "success": return "badge bg-success/10 text-success border-transparent";
        case "warning": return "badge bg-warning/10 text-warning border-transparent";
        case "danger": return "badge bg-danger/10 text-danger border-transparent";
        case "info": return "badge bg-info/10 text-info border-transparent";
        case "muted": return "badge bg-dark-light text-dark border-transparent";
        default: return "badge bg-primary/10 text-primary border-transparent";
      }
    } else {
      // filled
      switch (color) {
        case "secondary": return "badge bg-secondary text-white";
        case "success": return "badge bg-success text-white";
        case "warning": return "badge bg-warning text-white";
        case "danger": return "badge bg-danger text-white";
        case "info": return "badge bg-info text-white";
        case "muted": return "badge bg-dark text-white";
        default: return "badge bg-primary text-white";
      }
    }
  })();

  return (
    <motion.div
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className={cn(badgeClass, className)}
      {...props}
    >
      {icon && <span className="mr-1.5 shrink-0">{icon}</span>}
      {children}
      {onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1.5 rounded-full outline-none hover:bg-foreground/10 flex items-center justify-center p-0.5"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </motion.div>
  );
}

export { Badge };
