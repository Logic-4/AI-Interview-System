import * as React from "react";
import { motion, animate } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "./Card";
import { cn } from "../../lib/utils";

const COLOR_MAP: Record<string, string> = {
  primary: '#EE4264',
  secondary: '#2F3446',
  success: '#00ab55',
  warning: '#e2a03f',
  danger: '#e7515a',
  info: '#2196f3',
};

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
        onUpdate(val) {
          node.textContent = val.toLocaleString(undefined, {
            maximumFractionDigits: suffix === "%" ? 1 : 0,
          });
        },
      });
      return () => controls.stop();
    }
  }, [value, suffix]);

  const colorHsl = COLOR_MAP[color] || COLOR_MAP.primary;

  return (
    <Card className={cn("relative group transition-all duration-500 overflow-hidden border border-white-light dark:border-[#1b2e4b]", className)}>
      <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10" />
      
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div
            className="p-3 rounded-xl border border-white-light dark:border-[#1b2e4b]"
            style={{
              backgroundColor: `${colorHsl}1a`, // Hex transparency
              boxShadow: `0 0 20px ${colorHsl}26`,
            }}
          >
            <Icon className="w-6 h-6" style={{ color: colorHsl }} />
          </div>
          
          {trend && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ring-inset",
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
          <h3 className="text-3xl font-semibold text-text-primary dark:text-white flex items-baseline gap-1">
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
