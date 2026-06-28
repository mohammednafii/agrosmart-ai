import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "green" | "red" | "amber" | "blue" | "neutral";
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  const variants = {
    green:   "bg-[rgba(0,200,150,0.12)] text-[#00c896]  border border-[rgba(0,200,150,0.25)]",
    red:     "bg-[rgba(150,0,0,0.12)]    text-[#e05c5c]  border border-[rgba(150,0,0,0.25)]",
    amber:   "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]  border border-[rgba(245,158,11,0.25)]",
    blue:    "bg-[rgba(59,130,246,0.12)] text-[#60a5fa]  border border-[rgba(59,130,246,0.25)]",
    neutral: "bg-[#1e1e24] text-[#9898a8] border border-[#2a2a33]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
