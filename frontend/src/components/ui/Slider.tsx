"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { showTooltip?: boolean }
>(({ className, showTooltip = true, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [value, setValue] = React.useState(props.value || props.defaultValue || [0]);

  return (
    <div className="w-full pt-10 pb-4">
      <SliderPrimitive.Root
        ref={ref}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          className
        )}
        onValueChange={(v) => {
          setValue(v);
          props.onValueChange?.(v);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-surface-3">
          <SliderPrimitive.Range className="absolute h-full bg-gradient-primary" />
        </SliderPrimitive.Track>
        
        {value.map((val, index) => (
          <SliderPrimitive.Thumb
            key={index}
            className="block h-6 w-6 rounded-full border-2 border-primary bg-surface shadow-[0_0_15px_rgba(108,92,231,0.3)] ring-offset-background transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing hover:scale-110"
          >
            <AnimatePresence>
              {(isHovered || true) && ( // Simplified for now to always show or show on hover
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.8 }}
                  animate={{ opacity: 1, y: -45, scale: 1 }}
                  className="absolute left-1/2 -translate-x-1/2 px-2 py-1 bg-primary text-white text-[10px] font-bold rounded-lg pointer-events-none whitespace-nowrap shadow-lg ring-1 ring-white/10"
                >
                  {val}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-primary" />
                </motion.div>
              )}
            </AnimatePresence>
          </SliderPrimitive.Thumb>
        ))}
      </SliderPrimitive.Root>
    </div>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
