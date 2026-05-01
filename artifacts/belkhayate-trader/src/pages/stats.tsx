import React from "react";
import { useGetAnalysisStats } from "@workspace/api-client-react";
import { Loader2, TrendingUp, TrendingDown, AlertCircle, Minus, Activity, User, BarChart2, ShieldAlert } from "lucide-react";

export default function Stats() {
  const { data: stats, isLoading } = useGetAnalysisStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  const total = stats.total || 1;

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">System Statistics</h1>
        <p className="text-muted-foreground">Overview of historical signal distribution.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-lg p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-mono text-muted-foreground mb-1 uppercase tracking-wider">Total Scans</p>
            <p className="text-4xl font-bold text-foreground">{stats.total}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
            <Activity className="w-6 h-6 text-primary" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-mono text-muted-foreground mb-1 uppercase tracking-wider">Scans Today</p>
            <p className="text-4xl font-bold text-foreground">{stats.todayCount}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
            <Activity className="w-6 h-6 text-foreground" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Analyses Solo</p>
            </div>
            <p className="text-4xl font-bold text-foreground">{stats.soloTotal}</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {stats.total > 0 ? ((stats.soloTotal / stats.total) * 100).toFixed(1) : "0.0"}% du total
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <User className="w-6 h-6 text-blue-400" />
          </div>
        </div>

        <div className="bg-card border border-purple-500/20 rounded-lg p-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 className="w-4 h-4 text-purple-400" />
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Analyses Octogone</p>
            </div>
            <p className="text-4xl font-bold text-foreground">{stats.octogoneTotal}</p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {stats.total > 0 ? ((stats.octogoneTotal / stats.total) * 100).toFixed(1) : "0.0"}% du total
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <BarChart2 className="w-6 h-6 text-purple-400" />
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold mt-10 mb-6">Signal Distribution</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="BUY Signals"
          count={stats.buySignals}
          total={total}
          icon={TrendingUp}
          colorClass="text-success"
          bgClass="bg-success/10 border-success/20"
        />
        <StatCard
          label="SELL Signals"
          count={stats.sellSignals}
          total={total}
          icon={TrendingDown}
          colorClass="text-destructive"
          bgClass="bg-destructive/10 border-destructive/20"
        />
        <StatCard
          label="WAIT Signals"
          count={stats.waitSignals}
          total={total}
          icon={AlertCircle}
          colorClass="text-warning"
          bgClass="bg-warning/10 border-warning/20"
        />
        <StatCard
          label="NO SIGNAL"
          count={stats.noSignals}
          total={total}
          icon={Minus}
          colorClass="text-muted-foreground"
          bgClass="bg-secondary/50 border-border"
        />
      </div>

      <div className="mt-12 bg-card border border-border p-6 rounded-lg">
        <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-4">Distribution Ratio</h3>
        <div className="h-4 w-full flex rounded-full overflow-hidden">
          <div style={{ width: `${(stats.buySignals / total) * 100}%` }} className="bg-success h-full transition-all" />
          <div style={{ width: `${(stats.sellSignals / total) * 100}%` }} className="bg-destructive h-full transition-all" />
          <div style={{ width: `${(stats.waitSignals / total) * 100}%` }} className="bg-warning h-full transition-all" />
          <div style={{ width: `${(stats.noSignals / total) * 100}%` }} className="bg-muted-foreground/30 h-full transition-all" />
        </div>
        <div className="flex items-center gap-6 mt-4 text-xs font-mono text-muted-foreground">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-success"></div> BUY {((stats.buySignals / total) * 100).toFixed(1)}%</div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-destructive"></div> SELL {((stats.sellSignals / total) * 100).toFixed(1)}%</div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-warning"></div> WAIT {((stats.waitSignals / total) * 100).toFixed(1)}%</div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-muted-foreground/30"></div> NONE {((stats.noSignals / total) * 100).toFixed(1)}%</div>
        </div>
      </div>

      {(stats.tpMismatchTotal > 0 || stats.total > 0) && (
        <div className="mt-8 bg-card border border-amber-500/20 p-6 rounded-lg">
          <div className="flex items-center gap-2 mb-6">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
              Validation TP — Garde Belkhayate
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-card border border-amber-500/20 rounded-lg p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-mono text-muted-foreground mb-1 uppercase tracking-wider">TP Invalides détectés</p>
                <p className="text-4xl font-bold text-amber-400">{stats.tpMismatchTotal}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {stats.total > 0
                    ? `${((stats.tpMismatchTotal / stats.total) * 100).toFixed(1)}% des analyses`
                    : "0.0% des analyses"}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-mono text-muted-foreground mb-1 uppercase tracking-wider">TP Auto-corrigés</p>
                <p className="text-4xl font-bold text-foreground">{stats.tpCorrectedTotal}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">correction automatique</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <Activity className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      )}

      {stats.octogoneTotal > 0 && stats.octogoneMacroRegimes.length > 0 && (
        <div className="mt-8 bg-card border border-purple-500/20 p-6 rounded-lg">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
              Régimes Macro — Octogone
            </h3>
          </div>
          <div className="space-y-3">
            {stats.octogoneMacroRegimes.map(({ regime, count }) => {
              const pct = ((count / stats.octogoneTotal) * 100).toFixed(1);
              return (
                <div key={regime} className="flex items-center gap-4">
                  <div className="w-36 shrink-0">
                    <span className="text-sm font-mono text-foreground">{regime}</span>
                  </div>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-24 text-right shrink-0">
                    <span className="text-xs font-mono text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, count, total, icon: Icon, colorClass, bgClass }: any) {
  const percentage = ((count / total) * 100).toFixed(1);
  return (
    <div className={`border rounded-lg p-6 ${bgClass}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2 rounded-md bg-background/50 ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className={`text-xs font-mono font-bold ${colorClass}`}>{percentage}%</span>
      </div>
      <div>
        <p className="text-sm text-muted-foreground font-mono uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-bold text-foreground">{count}</p>
      </div>
    </div>
  );
}
