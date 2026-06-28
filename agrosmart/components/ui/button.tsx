"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b] disabled:pointer-events-none disabled:opacity-40 select-none";

    const variants = {
      primary:
        "bg-[#00c896] text-[#0a0a0b] hover:bg-[#00a87b] active:scale-[0.97] focus-visible:ring-[#00c896] shadow-[0_0_20px_rgba(0,200,150,0.25)] hover:shadow-[0_0_28px_rgba(0,200,150,0.4)]",
      secondary:
        "bg-[#1e1e24] text-[#f4f4f6] border border-[#3a3a47] hover:bg-[#2a2a33] hover:border-[#4a4a57] active:scale-[0.97] focus-visible:ring-[#3a3a47]",
      outline:
        "bg-transparent text-[#f4f4f6] border border-[#3a3a47] hover:bg-[#1e1e24] hover:border-[#4a4a57] active:scale-[0.97] focus-visible:ring-[#3a3a47]",
      ghost:
        "bg-transparent text-[#9898a8] hover:bg-[#1e1e24] hover:text-[#f4f4f6] active:scale-[0.97] focus-visible:ring-[#3a3a47]",
      danger:
        "bg-[#960000] text-white hover:bg-[#b00000] active:scale-[0.97] focus-visible:ring-[#960000] shadow-[0_0_16px_rgba(150,0,0,0.3)]",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin-slow h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
