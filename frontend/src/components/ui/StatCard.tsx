"use client";

import * as React from "react";
import { motion, useSpring, useTransform, animate } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
  icon: React.ElementType;
  color?: "primary" | "secondary" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const StatCard = ({
  title,
  value,
  prefix = "",
  suffix = "",
  trend,
  icon: Icon,
  color = "primary",
  className,
}: StatCardProps) => {
  const countRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const node = countRef.current;
    if (node) {
      const controls = animate(0, value, {
        duration: 2,
        onUpdate(value) {
          node.textContent = value.toLocaleString(undefined, {
            maximumFractionDigits: suffix === "%" ? 1 : 0,
          });
        },
      });
      return () => controls.stop();
    }
  }, [value, suffix]);

  return (
    <Card className={cn("relative group transition-all duration-500 overflow-hidden", className)}>
      {/* Background decoration */}
      <div className={`absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-${color}/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`} />
      
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            "p-3 rounded-2xl border border-white/5",
            `bg-gradient-${color} shadow-[0_0_20px_rgba(var(--${color}),0.15)]`
          )}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          
          {trend && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ring-inset backdrop-blur-md",
                trend.isUp 
                  ? "bg-success/10 text-success ring-success/20" 
                  : "bg-danger/10 text-danger ring-danger/20"
              )}
            >
              {trend.isUp ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              <span>{trend.value}%</span>
            </motion.div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            {title}
          </p>
          <h3 className="text-3xl font-semibold text-text-primary flex items-baseline gap-1">
            {prefix && <span className="text-xl opacity-60">{prefix}</span>}
            <span ref={countRef}>0</span>
            {suffix && <span className="text-xl opacity-60">{suffix}</span>}
          </h3>
        </div>
      </CardContent>
    </Card>
  );
};

export { StatCard };
