import React, { useState } from "react";
import { useListAnalysisHistory, useDeleteAnalysis, getListAnalysisHistoryQueryKey, getGetAnalysisStatsQueryKey } from "@workspace/api-client-react";
import { SignalBadge } from "@/components/ui/signal-badge";
import { formatDate } from "@/lib/format";
import { Trash2, Search, ArrowRight, Loader2, Calendar, BarChart2, User, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { AnalysisRecord } from "@workspace/api-client-react";

type ModeFilter = "ALL" | "SOLO" | "OCTOGONE";

interface MarketData {
  valide?: boolean;
  signal_local?: string;
  i1?: string;
  i2?: string;
  i3?: string;
  energie?: { statut?: string; intensite?: string; divergence?: string };
  direction?: { tendance?: string; points?: string; effet_ressort?: boolean };
  pivots?: { niveau_proche?: string; type?: string; reaction_prix?: string };
}

interface OctogoneRaw {
  regime_macro?: string;
  tete_du_marche?: string;
  marches?: Record<string, MarketData>;
  trade_final?: {
    decision?: string;
    actif?: string;
    logique?: string;
    entry?: string;
    stopLoss?: string;
    tp1?: string;
    tp2?: string;
    confiance?: number;
  };
}

interface OctogoneSession {
  sessionKey: string;
  records: AnalysisRecord[];
  primaryRecord: AnalysisRecord;
  allMarkets: Record<string, MarketData>;
}

const SIGNAL_STYLES: Record<string, string> = {
  BUY: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  SELL: "bg-red-500/15 text-red-400 border-red-500/30",
  NO_TRADE: "bg-secondary text-muted-foreground border-border",
  NO_SIGNAL: "bg-secondary text-muted-foreground border-border",
  WAIT: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const ALL_MARKETS_ORDER = ["ZN", "DX", "ES", "BTC", "CL", "GC", "HG", "6J"];

function groupOctogoneSessions(records: AnalysisRecord[]): OctogoneSession[] {
  const bySession = new Map<string, AnalysisRecord[]>();

  for (const record of records) {
    const key = record.sessionId ?? `solo-${record.id}`;
    const group = bySession.get(key) ?? [];
    group.push(record);
    bySession.set(key, group);
  }

  const sessions: OctogoneSession[] = [];

  for (const [sessionKey, sessionRecords] of bySession) {
    sessionRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const primaryRecord = sessionRecords[0];

    const allMarkets: Record<string, MarketData> = {};

    for (const record of sessionRecords) {
      try {
        const raw = JSON.parse(record.rawAnalysis) as OctogoneRaw;
        if (raw.marches) {
          for (const [market, data] of Object.entries(raw.marches)) {
            if (!allMarkets[market] && data.signal_local !== "NO_SIGNAL") {
              allMarkets[market] = data;
            } else if (!allMarkets[market]) {
              allMarkets[market] = data;
            }
          }
        }
      } catch {
      }
    }

    sessions.push({ sessionKey, records: sessionRecords, primaryRecord, allMarkets });
  }

  return sessions;
}

function MarketSignalChip({ market, data }: { market: string; data: MarketData }) {
  const signal = data.signal_local ?? "NO_SIGNAL";
  const style = SIGNAL_STYLES[signal] ?? SIGNAL_STYLES["NO_SIGNAL"];
  return (
    <div className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs font-mono ${style}`}>
      <span className="font-bold text-sm">{market}</span>
      <span className="opacity-80">{signal.replace("_", " ")}</span>
      {data.energie?.statut && data.energie.statut !== "ABSENT" && (
        <span className="text-xs opacity-60 truncate max-w-[80px]">{data.energie.statut}</span>
      )}
    </div>
  );
}

function OctogoneSessionCard({
  session,
  onDelete,
  isDeleting,
}: {
  session: OctogoneSession;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { primaryRecord, records, allMarkets } = session;

  const orderedMarkets = [
    ...ALL_MARKETS_ORDER.filter((m) => allMarkets[m]),
    ...Object.keys(allMarkets).filter((m) => !ALL_MARKETS_ORDER.includes(m)),
  ];

  const buyCount = orderedMarkets.filter((m) => allMarkets[m]?.signal_local === "BUY").length;
  const sellCount = orderedMarkets.filter((m) => allMarkets[m]?.signal_local === "SELL").length;
  const noTradeCount = orderedMarkets.filter(
    (m) => !["BUY", "SELL"].includes(allMarkets[m]?.signal_local ?? ""),
  ).length;

  let tradeFinal: OctogoneRaw["trade_final"] = undefined;
  try {
    const raw = JSON.parse(primaryRecord.rawAnalysis) as OctogoneRaw;
    tradeFinal = raw.trade_final;
  } catch {
  }

  return (
    <div className="bg-card border border-purple-500/30 rounded-lg hover:border-purple-500/60 transition-colors group">
      <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="shrink-0 w-32">
          <SignalBadge signal={primaryRecord.signal} size="md" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
              OCTOGONE
            </span>
            {records.length > 1 && (
              <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                {records.length} enregistrements
              </span>
            )}
            {primaryRecord.energyState && (
              <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                {primaryRecord.energyState}
              </span>
            )}
            {primaryRecord.directionTrend && primaryRecord.directionTrend !== "NEUTRE" && (
              <span className="text-xs font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded">
                {primaryRecord.directionTrend}
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {formatDate(primaryRecord.createdAt)}
            </span>
          </div>

          {orderedMarkets.length > 0 && (
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs text-muted-foreground font-mono">
                {orderedMarkets.length} marchés :
              </span>
              {buyCount > 0 && (
                <span className="text-xs font-mono text-emerald-400">↑ {buyCount} BUY</span>
              )}
              {sellCount > 0 && (
                <span className="text-xs font-mono text-red-400">↓ {sellCount} SELL</span>
              )}
              {noTradeCount > 0 && (
                <span className="text-xs font-mono text-muted-foreground">— {noTradeCount} neutre</span>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground truncate">{primaryRecord.synthesis}</p>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {records.map((r) => (
            <Button
              key={r.id}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(r.id)}
              disabled={isDeleting}
              title={`Supprimer l'enregistrement #${r.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          ))}
          {orderedMarkets.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  Réduire <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Détails <ChevronDown className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {expanded && orderedMarkets.length > 0 && (
        <div className="border-t border-purple-500/20 px-5 pb-5 pt-4">
          <p className="text-xs text-muted-foreground font-mono mb-3 uppercase tracking-wider">
            Signaux par marché
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {orderedMarkets.map((market) => (
              <MarketSignalChip key={market} market={market} data={allMarkets[market]} />
            ))}
          </div>

          {tradeFinal && tradeFinal.actif && (
            <div className="mt-4 p-3 bg-secondary/50 rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <span className="text-muted-foreground">Trade final :</span>
                <span className="font-bold text-foreground">{tradeFinal.actif}</span>
                {tradeFinal.entry && (
                  <>
                    <span className="text-muted-foreground">Entrée</span>
                    <span className="text-foreground">{tradeFinal.entry}</span>
                  </>
                )}
                {tradeFinal.stopLoss && (
                  <>
                    <span className="text-muted-foreground">SL</span>
                    <span className="text-red-400">{tradeFinal.stopLoss}</span>
                  </>
                )}
                {tradeFinal.tp1 && (
                  <>
                    <span className="text-muted-foreground">TP1</span>
                    <span className="text-emerald-400">{tradeFinal.tp1}</span>
                  </>
                )}
                {tradeFinal.tp2 && (
                  <>
                    <span className="text-muted-foreground">TP2</span>
                    <span className="text-emerald-400">{tradeFinal.tp2}</span>
                  </>
                )}
                {tradeFinal.confiance != null && (
                  <>
                    <span className="text-muted-foreground">Confiance</span>
                    <span className="text-foreground">{tradeFinal.confiance}%</span>
                  </>
                )}
              </div>
              {tradeFinal.logique && (
                <p className="mt-2 text-xs text-muted-foreground">{tradeFinal.logique}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function History() {
  const { data: history, isLoading } = useListAnalysisHistory();
  const deleteMutation = useDeleteAnalysis();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modeFilter, setModeFilter] = useState<ModeFilter>("ALL");
  const [search, setSearch] = useState("");

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;

    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListAnalysisHistoryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAnalysisStatsQueryKey() });
      toast({ title: "Deleted", description: "Record removed successfully." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete record.", variant: "destructive" });
    }
  };

  const allRecords = history ?? [];

  const soloRecords = allRecords.filter((r) => (r.mode ?? "SOLO") === "SOLO");
  const octogoneRecords = allRecords.filter((r) => r.mode === "OCTOGONE");
  const octogoneSessions = groupOctogoneSessions(octogoneRecords);

  const soloCount = soloRecords.length;
  const octogoneCount = octogoneSessions.length;

  const filteredSoloRecords = soloRecords.filter((record) => {
    if (modeFilter === "OCTOGONE") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (record.asset ?? "").toLowerCase().includes(q) ||
        (record.synthesis ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredOctogoneSessions = octogoneSessions.filter((session) => {
    if (modeFilter === "SOLO") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return session.records.some(
        (r) =>
          (r.asset ?? "").toLowerCase().includes(q) ||
          (r.synthesis ?? "").toLowerCase().includes(q),
      );
    }
    return true;
  });

  const totalVisible = filteredSoloRecords.length + filteredOctogoneSessions.length;

  type MergedItem =
    | { type: "octogone"; session: OctogoneSession; ts: number }
    | { type: "solo"; record: AnalysisRecord; ts: number };

  const mergedItems: MergedItem[] = [
    ...filteredOctogoneSessions.map((session) => ({
      type: "octogone" as const,
      session,
      ts: new Date(session.primaryRecord.createdAt).getTime(),
    })),
    ...filteredSoloRecords.map((record) => ({
      type: "solo" as const,
      record,
      ts: new Date(record.createdAt).getTime(),
    })),
  ].sort((a, b) => b.ts - a.ts);

  const tabs: { label: string; value: ModeFilter; count: number }[] = [
    { label: "All", value: "ALL", count: soloCount + octogoneCount },
    { label: "Solo", value: "SOLO", count: soloCount },
    { label: "Octogone", value: "OCTOGONE", count: octogoneCount },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Analysis History</h1>
          <p className="text-muted-foreground">Log of all your past Ortogonex analyses.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            className="pl-9 bg-card border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setModeFilter(tab.value)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              modeFilter === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.value === "SOLO" && <User className="w-3.5 h-3.5" />}
            {tab.value === "OCTOGONE" && <BarChart2 className="w-3.5 h-3.5" />}
            {tab.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                modeFilter === tab.value ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : totalVisible === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-lg bg-card/30">
          <Calendar className="w-10 h-10 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            {allRecords.length > 0 ? "No records match this filter." : "No history available."}
          </p>
          {allRecords.length === 0 && (
            <Link href="/">
              <Button variant="link" className="mt-2 text-primary">
                Run your first analysis
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {mergedItems.map((item) => {
            if (item.type === "octogone") {
              return (
                <OctogoneSessionCard
                  key={item.session.sessionKey}
                  session={item.session}
                  onDelete={handleDelete}
                  isDeleting={deleteMutation.isPending}
                />
              );
            }

            const record = item.record;
            return (
              <div
                key={record.id}
                className="bg-card border border-border rounded-lg p-5 flex flex-col sm:flex-row sm:items-center gap-6 hover:border-primary/50 transition-colors group"
              >
                <div className="shrink-0 w-32">
                  <SignalBadge signal={record.signal} size="md" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-foreground text-lg">{record.asset || "Unknown"}</span>
                    {record.timeframe && (
                      <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                        {record.timeframe}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatDate(record.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{record.synthesis}</p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(record.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Details <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
