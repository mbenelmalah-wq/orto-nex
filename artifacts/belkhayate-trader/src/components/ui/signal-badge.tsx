import React from "react";
import { AnalysisResultSignal } from "@workspace/api-client-react";
import { formatSignal, getSignalColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertCircle, TrendingDown, TrendingUp, Minus } from "lucide-react";

interface SignalBadgeProps {
  signal: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SignalBadge({ signal, className, size = "md" }: SignalBadgeProps) {
  const colorClass = getSignalColorClass(signal);
  const formatted = formatSignal(signal);

  let Icon = Minus;
  if (signal === AnalysisResultSignal.BUY) Icon = TrendingUp;
  else if (signal === AnalysisResultSignal.SELL) Icon = TrendingDown;
  else if (signal === AnalysisResultSignal.WAIT) Icon = AlertCircle;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-3 py-1 text-xs gap-1.5",
    lg: "px-4 py-2 text-sm gap-2 font-bold",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <div className={cn(
      "inline-flex items-center rounded-md border font-mono uppercase tracking-wider",
      colorClass,
      sizeClasses[size],
      className
    )}>
      <Icon className={iconSizes[size]} />
      {formatted}
    </div>
  );
}
