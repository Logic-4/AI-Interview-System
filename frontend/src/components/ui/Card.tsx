"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-2xl border transition-all duration-300 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-surface border-border hover:border-border-light shadow-sm hover:shadow-md hover:-translate-y-1",
        elevated: "bg-surface border-transparent shadow-[0_4px_25px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)] hover:-translate-y-1",
        bordered: "bg-surface border-border-light shadow-none hover:border-primary/40",
        glass: "glass-effect backdrop-blur-xl bg-surface/10 border-white/5 hover:border-white/10 hover:shadow-[0_0_50px_rgba(108,92,231,0.1)]",
        gradient: "bg-surface group",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface CardProps
  extends Omit<React.ComponentPropsWithoutRef<typeof motion.div>, "children">,
    VariantProps<typeof cardVariants> {
  hoverEffect?: boolean;
  children?: React.ReactNode;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, hoverEffect = true, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref as any}
        whileHover={
          hoverEffect
            ? {
                y: -4,
                scale: 1.01,
                boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
              }
            : {}
        }
        className={cn(cardVariants({ variant, className }))}
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
  <div className={cn("p-6 flex flex-col space-y-1.5", className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-xl font-semibold leading-none tracking-tight text-text-primary", className)} {...props} />
);

const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-text-muted", className)} {...props} />
);

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0 text-text-secondary", className)} {...props} />
);

const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center p-6 pt-0 mt-auto", className)} {...props} />
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
