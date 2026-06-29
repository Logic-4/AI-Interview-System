import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { showTooltip?: boolean }
>(({ className, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [value, setValue] = React.useState(props.value || props.defaultValue || [0]);

  React.useEffect(() => {
    if (props.value) {
      setValue(props.value);
    }
  }, [props.value]);

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
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-white-light dark:bg-[#1b2e4b]">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        
        {value.map((val, index) => (
          <SliderPrimitive.Thumb
            key={index}
            className="block h-6 w-6 rounded-full border-2 border-primary bg-white dark:bg-black shadow-[0_0_15px_rgba(67,97,238,0.3)] cursor-grab active:cursor-grabbing hover:scale-110"
          >
            <AnimatePresence>
              {(isHovered || true) && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.8 }}
                  animate={{ opacity: 1, y: -45, scale: 1 }}
                  className="absolute left-1/2 -translate-x-1/2 px-2 py-1 bg-primary text-white text-[10px] font-bold rounded-lg pointer-events-none whitespace-nowrap shadow-lg"
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
