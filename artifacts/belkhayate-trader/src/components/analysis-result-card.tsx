import React from "react";
import { AnalysisResult } from "@workspace/api-client-react";
import { SignalBadge } from "@/components/ui/signal-badge";
import { Target, Zap, Activity, Navigation, Info, Maximize, AlertTriangle } from "lucide-react";

export function AnalysisResultCard({ result }: { result: AnalysisResult }) {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header / Signal */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card border border-border rounded-lg p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {result.asset || "Unknown Asset"}
            </h2>
            {result.timeframe && (
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-secondary text-secondary-foreground">
                {result.timeframe}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {result.synthesis}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-2">Primary Signal</div>
          <SignalBadge signal={result.signal} size="lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Energy & Direction */}
        <div className="flex flex-col gap-6">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4 text-foreground font-medium">
              <Zap className="w-4 h-4 text-primary" />
              Énergie (Centre de Gravité)
            </div>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">State</span>
                <span className="text-foreground">{result.energy.state}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Intensity</span>
                <span className="text-foreground">{result.energy.intensity}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Divergence</span>
                <span className="text-foreground">{result.energy.divergence}</span>
              </div>
              <div className="pt-1 text-xs text-muted-foreground leading-relaxed font-sans">
                {result.energy.detail}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4 text-foreground font-medium">
              <Activity className="w-4 h-4 text-primary" />
              Direction (MBK)
            </div>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Trend</span>
                <span className="text-foreground">{result.direction.trend}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Points</span>
                <span className="text-foreground">{result.direction.points}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Bands</span>
                <span className="text-foreground">{result.direction.bands}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Spring Effect</span>
                <span className="text-foreground">{result.direction.springEffect}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pivots & Trade Plan */}
        <div className="flex flex-col gap-6">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4 text-foreground font-medium">
              <Navigation className="w-4 h-4 text-primary" />
              Pivots (Lignes Mathématiques)
            </div>
            <div className="space-y-3 font-mono text-sm">
              {result.pivots.currentPrice && (
                <div className="flex justify-between items-center pb-2 border-b border-border/50">
                  <span className="text-muted-foreground">Current Price</span>
                  <span className="text-foreground">{result.pivots.currentPrice}</span>
                </div>
              )}
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Nearest Pivot</span>
                <span className="text-foreground font-bold text-primary">{result.pivots.nearestPivot}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Type</span>
                <span className="text-foreground">{result.pivots.pivotType}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Next Level</span>
                <span className="text-foreground">{result.pivots.nextPivot}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <div className="flex items-center gap-2 mb-4 text-foreground font-medium">
              <Target className="w-4 h-4 text-primary" />
              Trade Plan
            </div>

            {result.tpMismatch && (
              <div className="flex items-start gap-2 mb-4 bg-amber-500/10 border border-amber-500/30 rounded p-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                    TP Violation Belkhayate
                  </p>
                  {result.tpMismatchDetail && (
                    <p className="text-xs text-amber-300/80 mt-0.5">{result.tpMismatchDetail}</p>
                  )}
                </div>
              </div>
            )}

            {result.trade ? (
              <div className="space-y-4 font-mono text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary/50 rounded p-3 border border-border">
                    <div className="text-xs text-muted-foreground mb-1">ENTRY</div>
                    <div className="text-foreground font-bold">{result.trade.entry || "N/A"}</div>
                  </div>
                  <div className="bg-secondary/50 rounded p-3 border border-border">
                    <div className="text-xs text-muted-foreground mb-1">STOP LOSS</div>
                    <div className="text-destructive font-bold">{result.trade.stopLoss || "N/A"}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`bg-secondary/50 rounded p-3 border ${result.tpMismatch ? "border-amber-500/40" : "border-border"}`}>
                    <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      TARGET 1
                      {result.tpMismatch && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                    </div>
                    <div className={`font-bold ${result.tpMismatch ? "text-amber-400" : "text-success"}`}>
                      {result.trade.tp1 || "N/A"}
                    </div>
                  </div>
                  <div className="bg-secondary/50 rounded p-3 border border-border">
                    <div className="text-xs text-muted-foreground mb-1">TARGET 2</div>
                    <div className="text-success font-bold">{result.trade.tp2 || "N/A"}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground italic">
                No strict trade plan available.
              </div>
            )}
          </div>
        </div>

        {/* Missing Conditions & Raw Log */}
        <div className="flex flex-col gap-6 h-full">
          {result.missingConditions && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3 text-warning font-medium">
                <AlertTriangle className="w-4 h-4" />
                Missing Conditions
              </div>
              <p className="text-sm text-warning/90 leading-relaxed">
                {result.missingConditions}
              </p>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg flex flex-col flex-1 min-h-[250px] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30 shrink-0">
              <div className="flex items-center gap-2 text-foreground font-medium text-sm">
                <Maximize className="w-4 h-4 text-muted-foreground" />
                Raw Output Log
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-[#05080f]">
              <pre className="text-[10px] font-mono text-muted-foreground/80 whitespace-pre-wrap">
                {result.rawAnalysis}
              </pre>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
