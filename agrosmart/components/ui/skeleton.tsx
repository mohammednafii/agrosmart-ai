import React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton", className)} style={style} />;
}

export function SkeletonBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-[#2a2a33] bg-[#18181c]">
      <Skeleton className="h-3.5 w-2/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}
