"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full border border-border bg-surface-2",
  {
    variants: {
      size: {
        xs: "h-6 w-6",
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-14 w-14",
        xl: "h-20 w-20",
      },
      premium: {
        true: "border-primary/50 shadow-[0_0_15px_rgba(108,92,231,0.3)]",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      premium: false,
    },
  }
);

interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  fallback?: string;
  status?: "online" | "offline" | "away" | "busy";
  isPremium?: boolean;
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, src, alt, fallback, status, isPremium, size, ...props }, ref) => (
  <div className="relative inline-block">
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(avatarVariants({ size, premium: isPremium, className }))}
      {...props}
    >
      <AvatarPrimitive.Image
        src={src}
        alt={alt}
        className="aspect-square h-full w-full object-cover"
      />
      <AvatarPrimitive.Fallback
        className="flex h-full w-full items-center justify-center rounded-full bg-surface-3 text-text-secondary font-semibold text-xs uppercase"
      >
        {fallback || (alt ? alt.substring(0, 2) : "??")}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
    
    {status && (
      <span
        className={cn(
          "absolute bottom-[5%] right-[5%] block rounded-full ring-2 ring-background ring-offset-background",
          {
            xs: "h-1.5 w-1.5",
            sm: "h-2 w-2",
            md: "h-2.5 w-2.5",
            lg: "h-3.5 w-3.5",
            xl: "h-5 w-5",
          }[size || "md"],
          {
            online: "bg-success shadow-[0_0_8px_rgba(0,230,118,0.6)]",
            offline: "bg-text-muted",
            away: "bg-warning shadow-[0_0_8px_rgba(255,179,0,0.6)]",
            busy: "bg-danger shadow-[0_0_8px_rgba(255,82,82,0.6)]",
          }[status]
        )}
      />
    )}

    {isPremium && (
      <div className="absolute -top-1 -right-1 z-10 p-0.5 rounded-full bg-gradient-primary shadow-lg ring-1 ring-background">
        <Sparkles className="h-2 w-2 text-white" />
      </div>
    )}
  </div>
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

export { Avatar };
