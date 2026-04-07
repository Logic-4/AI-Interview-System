import { cn } from "@/lib/utils";

function Skeleton({
  className,
  variant = "shimmer",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "shimmer" | "pulse" }) {
  return (
    <div
      className={cn(
        "bg-surface-3 rounded-md overflow-hidden relative",
        variant === "shimmer" && "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/20 dark:before:via-white/5 before:to-transparent",
        variant === "pulse" && "animate-pulse",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
