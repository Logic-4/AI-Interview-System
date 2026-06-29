import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export interface CardProps extends Omit<React.ComponentPropsWithoutRef<typeof motion.div>, "children"> {
  variant?: "default" | "elevated" | "bordered" | "glass" | "gradient";
  hoverEffect?: boolean;
  children?: React.ReactNode;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", hoverEffect = true, children, ...props }, ref) => {
    // Map card classes to Vristo panel and shadows
    const cardClass = cn(
      "panel transition-all duration-300 relative overflow-hidden",
      variant === "glass" && "glass-effect",
      variant === "gradient" && "group",
      className
    );

    return (
      <motion.div
        ref={ref}
        whileHover={
          hoverEffect
            ? {
                y: -4,
                scale: 1.01,
              }
            : {}
        }
        className={cardClass}
        {...props}
      >
        {variant === "gradient" && (
          <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" />
        )}
        {children}
      </motion.div>
    );
  }
);
Card.displayName = "Card";

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 mb-4", className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-xl font-bold leading-none tracking-tight text-text-primary", className)} {...props} />
);

const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-text-muted", className)} {...props} />
);

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("text-text-secondary", className)} {...props} />
);

const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center mt-4 pt-4 border-t border-white-light dark:border-[#1b2e4b]", className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
