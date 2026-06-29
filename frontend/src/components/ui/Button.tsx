import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "children"> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "premium";
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "icon";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  noMotion?: boolean;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, leftIcon, rightIcon, noMotion = false, children, ...props }, ref) => {
    
    // Map variants directly to Vristo template styles
    const variantClass = (() => {
      switch (variant) {
        case "secondary": return "btn btn-secondary shadow-secondary/20";
        case "danger": return "btn btn-danger shadow-danger/20";
        case "outline": return "btn btn-outline-primary";
        case "ghost": return "btn hover:bg-primary/10 hover:text-primary border-transparent shadow-none";
        case "premium": return "btn btn-primary bg-gradient-primary border-transparent text-white shadow-primary/20";
        default: return "btn btn-primary shadow-primary/20";
      }
    })();

    // Map sizes to Vristo sizes
    const sizeClass = (() => {
      switch (size) {
        case "xs": return "btn-sm py-1 px-2 text-[10px]";
        case "sm": return "btn-sm";
        case "lg": return "btn-lg";
        case "xl": return "btn-lg py-3 px-8 text-base";
        case "icon": return "p-2 rounded-full";
        default: return "";
      }
    })();

    return (
      <motion.button
        ref={ref}
        whileHover={noMotion || props.disabled || isLoading ? undefined : { y: -2 }}
        whileTap={noMotion || props.disabled || isLoading ? undefined : { scale: 0.96 }}
        className={cn(variantClass, sizeClass, className)}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          leftIcon && <span className="mr-2">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </motion.button>
    );
  }
);
Button.displayName = "Button";

export { Button };
