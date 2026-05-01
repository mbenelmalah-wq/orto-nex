import { AnalysisResultSignal } from "@workspace/api-client-react";

export function formatSignal(signal: string) {
  switch (signal) {
    case AnalysisResultSignal.BUY: return "BUY";
    case AnalysisResultSignal.SELL: return "SELL";
    case AnalysisResultSignal.WAIT: return "WAIT";
    case AnalysisResultSignal.NO_SIGNAL: return "NO SIGNAL";
    default: return signal;
  }
}

export function formatDate(dateString: string) {
  const d = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}

export function getSignalColorClass(signal: string) {
  switch (signal) {
    case AnalysisResultSignal.BUY:
      return "text-success border-success/30 bg-success/10";
    case AnalysisResultSignal.SELL:
      return "text-destructive border-destructive/30 bg-destructive/10";
    case AnalysisResultSignal.WAIT:
      return "text-warning border-warning/30 bg-warning/10";
    case AnalysisResultSignal.NO_SIGNAL:
    default:
      return "text-muted-foreground border-border bg-secondary/50";
  }
}

export function getSignalIconColor(signal: string) {
  switch (signal) {
    case AnalysisResultSignal.BUY: return "text-success";
    case AnalysisResultSignal.SELL: return "text-destructive";
    case AnalysisResultSignal.WAIT: return "text-warning";
    default: return "text-muted-foreground";
  }
}
