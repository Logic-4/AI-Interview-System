import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxItemProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

export function CustomCheckbox({ id, title, description, checked, onChange }: CheckboxItemProps) {
  return (
    <div className="flex gap-4 cursor-pointer" onClick={onChange}>
      <div className="mt-1 flex-shrink-0">
        <div
          className={cn(
            "w-5 h-5 rounded-[4px] border flex items-center justify-center transition-colors",
            checked
              ? "bg-primary border-primary text-white"
              : "border-border-light bg-transparent"
          )}
        >
           {checked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
        </div>
      </div>
      <div>
        <label
          htmlFor={id}
          className="text-sm font-semibold text-text-primary cursor-pointer select-none"
        >
          {title}
        </label>
        <p className="text-xs text-text-muted mt-0.5 select-none">{description}</p>
      </div>
    </div>
  );
}
