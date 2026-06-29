import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      asChild
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-white border border-white-light dark:border-[#17263c] dark:bg-[#121e32] px-3 py-1.5 text-xs font-semibold text-black dark:text-white shadow-md backdrop-blur-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        className
      )}
      {...props}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        {props.children}
        <TooltipPrimitive.Arrow className="fill-white dark:fill-[#121e32]" />
      </motion.div>
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
