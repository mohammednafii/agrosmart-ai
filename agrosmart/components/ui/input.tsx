import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-[#9898a8] tracking-wide">
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={cn(
            "h-10 w-full rounded-lg border bg-[#111114] px-3.5 text-sm text-[#f4f4f6] placeholder:text-[#5a5a6a]",
            "transition-all duration-200 outline-none",
            "border-[#2a2a33] hover:border-[#3a3a47]",
            "focus:border-[#00c896] focus:ring-2 focus:ring-[rgba(0,200,150,0.15)]",
            error && "border-[#960000] focus:border-[#960000] focus:ring-[rgba(150,0,0,0.15)]",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-[11px] text-[#e05c5c] leading-snug">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
