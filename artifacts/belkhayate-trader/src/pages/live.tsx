import { useEffect, useRef, useState, useCallback } from "react";
import {
  Monitor, Square, Play, Wifi, AlertCircle, TrendingUp, TrendingDown,
  Minus, Clock, Zap, Globe2, Activity, Target, ShieldAlert, Bell, BellOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SignalType = "BUY" | "SELL" | "WAIT" | "NO_SIGNAL" | "NO_TRADE";
type WsStatus = "disconnected" | "connecting" | "connected" | "analyzing" | "error";
type AppMode = "SOLO" | "OCTOGONE";

const INTERVAL_SECONDS = 300;
const OCTOGONE_MARKETS = ["ZN", "DX", "ES", "BTC", "CL", "GC", "HG", "6J"] as const;
const DEFAULT_MARKETS_A = ["DX", "BTC", "ZN", "6J"] as string[];
const DEFAULT_MARKETS_B = ["ES", "CL", "GC", "HG"] as string[];
const LS_KEY_MARKETS_A = "belkhai_marketsA";
const LS_KEY_MARKETS_B = "belkhai_marketsB";

const signalConfig: Record<string, { label: string; color: string; bg: string; border: string; dot: string; Icon: typeof TrendingUp }> = {
  BUY:       { label: "ACHAT",     color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/40", dot: "bg-emerald-400", Icon: TrendingUp },
  SELL:      { label: "VENTE",     color: "text-red-400",     bg: "bg-red-400/10",     border: "border-red-400/40",     dot: "bg-red-400",     Icon: TrendingDown },
  WAIT:      { label: "ATTENDRE",  color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/40",   dot: "bg-amber-400",   Icon: Minus },
  NO_SIGNAL: { label: "SANS SIG",  color: "text-gray-400",    bg: "bg-gray-400/10",    border: "border-gray-400/40",    dot: "bg-gray-400",    Icon: Minus },
  NO_TRADE:  { label: "NO TRADE",  color: "text-gray-400",    bg: "bg-gray-400/10",    border: "border-gray-400/40",    dot: "bg-gray-400",    Icon: Minus },
};

const regimeConfig: Record<string, { label: string; color: string; bg: string }> = {
  RISK_ON:            { label: "RISK ON",      color: "text-emerald-400", bg: "bg-emerald-400/10" },
  RISK_OFF:           { label: "RISK OFF",     color: "text-red-400",     bg: "bg-red-400/10" },
  INFLATION:          { label: "INFLATION",    color: "text-orange-400",  bg: "bg-orange-400/10" },
  LIQUIDITE_DOMINANTE:{ label: "LIQUIDITÉ",    color: "text-blue-400",    bg: "bg-blue-400/10" },
  CROISSANCE_REELLE:  { label: "CROISSANCE",   color: "text-teal-400",    bg: "bg-teal-400/10" },
  CHAOS_DESYNCHRONISE:{ label: "CHAOS",        color: "text-gray-400",    bg: "bg-gray-400/10" },
};

const i1Config: Record<string, { label: string; color: string }> = {
  FORT_HAUSSIER: { label: "↑↑", color: "text-emerald-400" },
  HAUSSIER:      { label: "↑",  color: "text-emerald-400" },
  NEUTRE:        { label: "—",  color: "text-gray-400" },
  BAISSIER:      { label: "↓",  color: "text-red-400" },
  FORT_BAISSIER: { label: "↓↓", color: "text-red-400" },
};

const i2Config: Record<string, { label: string; color: string }> = {
  NULLE:   { label: "∅",   color: "text-gray-500" },
  FAIBLE:  { label: "▪",   color: "text-gray-400" },
  MODEREE: { label: "▪▪",  color: "text-yellow-400" },
  FORTE:   { label: "▪▪▪", color: "text-orange-400" },
  EXTREME: { label: "MAX", color: "text-red-400" },
};

const i3Config: Record<string, { label: string; color: string }> = {
  ACCEPTATION_HAUSSIERE:  { label: "A↑",  color: "text-emerald-400" },
  ACCEPTATION_BAISSIERE:  { label: "A↓",  color: "text-red-400" },
  ABSORPTION_HAUSSIERE:   { label: "AB↑", color: "text-emerald-300" },
  ABSORPTION_BAISSIERE:   { label: "AB↓", color: "text-red-300" },
  NEUTRE:                 { label: "—",   color: "text-gray-500" },
};

interface SoloSignal {
  signal: SignalType;
  confiance: number;
  actif_detecte?: string | null;
  timeframe_detecte?: string | null;
  energie: { statut: string; intensite?: string; divergence?: string; detail?: string };
  direction: { points: string; tendance: string; effet_ressort?: boolean };
  pivots: { niveau_proche: string; type: string; take_profit_1?: string; take_profit_2?: string };
  trade?: { entry?: string; stopLoss?: string; tp1?: string; tp2?: string } | null;
  conditions_manquantes?: string;
  raison: string;
}

interface MarketState {
  valide: boolean;
  signal_local: string;
  i1: string;
  i2: string;
  i3: string;
  energie: { statut: string; intensite: string; divergence: string };
  direction: { tendance: string; points: string; effet_ressort: boolean };
  pivots: { niveau_proche: string; type: string; reaction_prix: string };
}

interface OctogoneSignal {
  octogone_actif: boolean;
  belkhayate_actif: boolean;
  regime_macro: string;
  tete_du_marche: string | null;
  qualite_globale: string;
  validation_intermarche: string;
  divergence_detectee: { presence: boolean; actif: string | null; type: string | null; detail: string | null };
  marches: Record<string, MarketState>;
  trade_final: {
    decision: string;
    actif: string | null;
    type: string;
    entry: string | null;
    stopLoss: string | null;
    tp1: string | null;
    tp2: string | null;
    confiance: number;
    logique: string;
  };
  raisons_no_trade: string[] | null;
}

interface HistoryEntry {
  mode: AppMode;
  signal: string;
  actif?: string | null;
  confiance: number;
  raison: string;
  timestamp: number;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-emerald-400" : value >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${value}%` }} />
    </div>
  );
}

function SignalBadge({ signal, size = "sm" }: { signal: string; size?: "sm" | "md" }) {
  const cfg = signalConfig[signal] ?? signalConfig["NO_SIGNAL"];
  return (
    <span className={cn(
      "inline-flex items-center gap-1 font-mono font-bold border rounded-full",
      cfg.color, cfg.bg, cfg.border,
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
    )}>
      <cfg.Icon className={size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} />
      {cfg.label}
    </span>
  );
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getWsUrl(path: string) {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}`;
}

function VideoPanel({
  label, markets, videoRef, canvasRef, isSharing, isAnalyzing, onStart, onStop,
}: {
  label: string;
  markets: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isSharing: boolean;
  isAnalyzing: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      <div className="flex items-center justify-between px-1">
        <div>
          <span className="text-xs font-mono font-bold text-foreground">{label}</span>
          <span className="text-xs font-mono text-muted-foreground ml-2">{markets}</span>
        </div>
        {isSharing ? (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-mono rounded-md transition-colors"
          >
            <Square className="w-3 h-3 fill-current" />
            Arrêter
          </button>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-mono rounded-md transition-colors font-semibold"
          >
            <Play className="w-3 h-3 fill-current" />
            Partager
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 h-48 rounded-lg overflow-hidden border border-border bg-black relative">
        <video ref={videoRef} muted className="w-full h-full object-contain" />
        <canvas ref={canvasRef} className="hidden" />
        {!isSharing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Monitor className="w-10 h-10 opacity-20" />
            <p className="text-xs font-mono opacity-60">Partage écran requis</p>
          </div>
        )}
        {isSharing && isAnalyzing && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-blue-500/20 border border-blue-400/30 text-blue-400 text-[10px] font-mono px-2 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Analyse...
          </div>
        )}
        {isSharing && !isAnalyzing && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </div>
        )}
      </div>
    </div>
  );
}

function MarketRow({ ticker, state }: { ticker: string; state: MarketState | undefined }) {
  if (!state) return null;
  const i1 = i1Config[state.i1] ?? { label: "—", color: "text-gray-400" };
  const i2 = i2Config[state.i2] ?? { label: "—", color: "text-gray-400" };
  const i3 = i3Config[state.i3] ?? { label: "—", color: "text-gray-500" };
  const sigCfg = signalConfig[state.signal_local] ?? signalConfig["NO_SIGNAL"];
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-mono",
      state.valide ? "bg-black/20" : "bg-black/10 opacity-50"
    )}>
      <span className="w-6 text-foreground font-bold shrink-0">{ticker}</span>
      <span className={cn("w-5 font-bold text-center shrink-0", sigCfg.color)} title={`Signal: ${state.signal_local}`}>{sigCfg.label.slice(0, 4)}</span>
      <span className="text-gray-600 shrink-0">|</span>
      <span className={cn("w-5 font-bold text-center shrink-0", i1.color)} title={`I1: ${state.i1}`}>{i1.label}</span>
      <span className={cn("w-7 font-bold text-center shrink-0 text-[10px]", i2.color)} title={`I2: ${state.i2}`}>{i2.label}</span>
      <span className={cn("w-7 font-bold text-center shrink-0 text-[10px]", i3.color)} title={`I3: ${state.i3}`}>{i3.label}</span>
      <span className="flex-1 text-muted-foreground text-[10px] truncate">
        {state.pivots.niveau_proche !== "AUCUN" ? state.pivots.niveau_proche : "—"}
      </span>
      {!state.valide && <span className="text-[9px] text-gray-500 shrink-0">INV</span>}
    </div>
  );
}

function playAlertSound(type: "BUY" | "SELL") {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    const freqs = type === "BUY" ? [523, 659, 784] : [784, 659, 523];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.18);
    });

    setTimeout(() => ctx.close(), 1500);
  } catch (_) {}
}

export default function Live() {
  const [appMode, setAppMode] = useState<AppMode>("SOLO");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const lastSoloAlertRef = useRef<number>(0);
  const lastOctoAlertRef = useRef<number>(0);


  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const videoRef1 = useRef<HTMLVideoElement>(null);
  const canvasRef1 = useRef<HTMLCanvasElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);
  const canvasRef2 = useRef<HTMLCanvasElement>(null);
  const wsOctoRef = useRef<WebSocket | null>(null);
  const stream1Ref = useRef<MediaStream | null>(null);
  const stream2Ref = useRef<MediaStream | null>(null);
  const octoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const octoCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const [isSharing, setIsSharing] = useState(false);
  const [latestSolo, setLatestSolo] = useState<SoloSignal | null>(null);
  const [indicateursManquants, setIndicateursManquants] = useState<string[] | null>(null);
  const [asset, setAsset] = useState("");
  const [timeframe, setTimeframe] = useState("15m");
  const [autoDetected, setAutoDetected] = useState(false);
  const [countdown, setCountdown] = useState(INTERVAL_SECONDS);
  const [soloError, setSoloError] = useState<string | null>(null);

  const [octoStatus, setOctoStatus] = useState<WsStatus>("disconnected");
  const [isSharing1, setIsSharing1] = useState(false);
  const [isSharing2, setIsSharing2] = useState(false);
  const [latestOcto, setLatestOcto] = useState<OctogoneSignal | null>(null);
  const [octoCountdown, setOctoCountdown] = useState(INTERVAL_SECONDS);
  const [octoError, setOctoError] = useState<string | null>(null);

  const [marketsA, setMarketsA] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_MARKETS_A);
      if (saved !== null) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((m) => (OCTOGONE_MARKETS as readonly string[]).includes(m));
          if (valid.length > 0 || parsed.length === 0) return valid;
        }
      }
    } catch {}
    return DEFAULT_MARKETS_A;
  });
  const [marketsB, setMarketsB] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_MARKETS_B);
      if (saved !== null) {
        const parsed = JSON.parse(saved) as string[];
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((m) => (OCTOGONE_MARKETS as readonly string[]).includes(m));
          if (valid.length > 0 || parsed.length === 0) return valid;
        }
      }
    } catch {}
    return DEFAULT_MARKETS_B;
  });
  const marketsARef = useRef<string[]>(marketsA);
  const marketsBRef = useRef<string[]>(marketsB);
  useEffect(() => {
    marketsARef.current = marketsA;
    try { localStorage.setItem(LS_KEY_MARKETS_A, JSON.stringify(marketsA)); } catch {}
  }, [marketsA]);
  useEffect(() => {
    marketsBRef.current = marketsB;
    try { localStorage.setItem(LS_KEY_MARKETS_B, JSON.stringify(marketsB)); } catch {}
  }, [marketsB]);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const enableAlerts = useCallback(async () => {
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    }
    lastSoloAlertRef.current = history.find(h => h.mode === "SOLO")?.timestamp ?? Date.now();
    lastOctoAlertRef.current = history.find(h => h.mode === "OCTOGONE")?.timestamp ?? Date.now();
    setAlertsEnabled(true);
  }, [history]);

  const triggerAlert = useCallback((signal: "BUY" | "SELL", actif: string | null | undefined, confiance: number, mode: AppMode) => {
    playAlertSound(signal);
    if ("Notification" in window && Notification.permission === "granted") {
      const signalLabel = signal === "BUY" ? "ACHAT" : "VENTE";
      const title = `🔔 Signal ${signalLabel}${actif ? ` — ${actif}` : ""} [${mode}]`;
      const body = `Confiance : ${confiance}%`;
      new Notification(title, { body, icon: "/favicon.ico", tag: `ortogonex-${mode}-${Date.now()}` });
    }
  }, []);

  const statusDot: Record<WsStatus, string> = {
    disconnected: "bg-zinc-500",
    connecting: "bg-amber-400 animate-pulse",
    connected: "bg-emerald-400",
    analyzing: "bg-blue-400 animate-pulse",
    error: "bg-red-400",
  };
  const statusLabel: Record<WsStatus, string> = {
    disconnected: "Déconnecté",
    connecting: "Connexion...",
    connected: "En attente",
    analyzing: "Analyse en cours...",
    error: "Erreur",
  };

  const connectSoloWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsStatus("connecting");
    const ws = new WebSocket(getWsUrl("/api/live"));
    wsRef.current = ws;
    ws.onopen = () => setWsStatus("connected");
    ws.onclose = () => { setWsStatus("disconnected"); wsRef.current = null; };
    ws.onerror = () => { setWsStatus("error"); setSoloError("WebSocket connexion échouée"); };
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === "analyzing") {
        setWsStatus("analyzing");
      } else if (msg.type === "signal") {
        if (msg.payload && !msg.payload.error) {
          const payload = msg.payload as Record<string, unknown>;
          if (payload.belkhayate_detecte === false) {
            setIndicateursManquants((payload.indicateurs_manquants as string[]) ?? ["Belkhayate Énergie", "Belkhayate Direction", "Pivots Belkhayate"]);
          } else {
            setIndicateursManquants(null);
            const sig = payload as unknown as SoloSignal;
            setLatestSolo(sig);
            if (sig.actif_detecte) { setAsset(sig.actif_detecte); setAutoDetected(true); }
            if (sig.timeframe_detecte) setTimeframe(sig.timeframe_detecte);
            setHistory(prev => [{
              mode: "SOLO", signal: sig.signal, actif: sig.actif_detecte, confiance: sig.confiance, raison: sig.raison, timestamp: msg.timestamp,
            }, ...prev.slice(0, 19)]);
          }
        }
        setWsStatus("connected");
        setCountdown(INTERVAL_SECONDS);
      } else if (msg.type === "error") {
        setSoloError(msg.message);
        setWsStatus("connected");
      }
    };
  }, []);

  const captureSoloAndSend = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ws = wsRef.current;
    if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
    setWsStatus("analyzing");
    ws.send(JSON.stringify({ type: "frame", data: base64, asset, timeframe }));
  }, [asset, timeframe]);

  const startSoloSharing = useCallback(async () => {
    setSoloError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      stream.getVideoTracks()[0].onended = () => stopSoloSharing();
      connectSoloWs();
      setIsSharing(true);
    } catch (err) {
      if (err instanceof Error && err.name !== "NotAllowedError") setSoloError("Impossible d'accéder à l'écran : " + err.message);
    }
  }, [connectSoloWs]);

  const stopSoloSharing = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    wsRef.current?.close(); wsRef.current = null;
    setIsSharing(false); setWsStatus("disconnected");
  }, []);

  const connectOctoWs = useCallback((onOpenCallback?: () => void) => {
    // If already open, run callback immediately
    if (wsOctoRef.current?.readyState === WebSocket.OPEN) {
      onOpenCallback?.();
      return;
    }
    // Close any stale connecting socket
    if (wsOctoRef.current) {
      wsOctoRef.current.onclose = null;
      wsOctoRef.current.onerror = null;
      wsOctoRef.current.close();
      wsOctoRef.current = null;
    }
    setOctoStatus("connecting");
    setOctoError(null);
    const ws = new WebSocket(getWsUrl("/api/octogone"));
    wsOctoRef.current = ws;
    ws.onopen = () => {
      setOctoStatus("connected");
      onOpenCallback?.();
    };
    ws.onclose = () => { setOctoStatus("disconnected"); wsOctoRef.current = null; };
    ws.onerror = (e) => {
      console.error("Octogone WS error", e);
      setOctoStatus("error");
      setOctoError("WebSocket Octogone connexion échouée — vérifiez que le serveur API tourne");
    };
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === "analyzing") {
        setOctoStatus("analyzing");
      } else if (msg.type === "octogone_signal") {
        if (msg.payload && !msg.payload.error) {
          const sig = msg.payload as OctogoneSignal;
          setLatestOcto(sig);
          const trade = sig.trade_final;
          setHistory(prev => [{
            mode: "OCTOGONE", signal: trade.decision, actif: trade.actif, confiance: trade.confiance, raison: trade.logique, timestamp: msg.timestamp,
          }, ...prev.slice(0, 19)]);
        }
        setOctoStatus("connected");
        setOctoCountdown(INTERVAL_SECONDS);
      } else if (msg.type === "error") {
        setOctoError(msg.message);
        setOctoStatus("connected");
      }
    };
  }, []);

  const captureOctoAndSend = useCallback(() => {
    const ws = wsOctoRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const captureFrame = (video: HTMLVideoElement | null, canvas: HTMLCanvasElement | null): string | null => {
      if (!video || !canvas) return null;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
    };

    const frame1 = captureFrame(videoRef1.current, canvasRef1.current);
    const frame2 = captureFrame(videoRef2.current, canvasRef2.current);
    if (!frame1 || !frame2) { setOctoError("Les deux écrans doivent être partagés pour analyser"); return; }

    setOctoStatus("analyzing");
    ws.send(JSON.stringify({
      type: "dual_frame",
      frame1,
      frame2,
      marketsA: marketsARef.current,
      marketsB: marketsBRef.current,
    }));
  }, []);

  const stopOctoLoop = useCallback(() => {
    if (octoIntervalRef.current) clearInterval(octoIntervalRef.current);
    if (octoCountdownRef.current) clearInterval(octoCountdownRef.current);
    octoIntervalRef.current = null; octoCountdownRef.current = null;
    wsOctoRef.current?.close(); wsOctoRef.current = null;
    setOctoStatus("disconnected"); setOctoCountdown(INTERVAL_SECONDS);
  }, []);

  const stopSharing1 = useCallback(() => {
    stream1Ref.current?.getTracks().forEach(t => t.stop());
    stream1Ref.current = null;
    if (videoRef1.current) videoRef1.current.srcObject = null;
    setIsSharing1(false);
  }, []);

  const stopSharing2 = useCallback(() => {
    stream2Ref.current?.getTracks().forEach(t => t.stop());
    stream2Ref.current = null;
    if (videoRef2.current) videoRef2.current.srcObject = null;
    setIsSharing2(false);
  }, []);

  const startSharing1 = useCallback(async () => {
    setOctoError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
      stream1Ref.current = stream;
      if (videoRef1.current) { videoRef1.current.srcObject = stream; videoRef1.current.play(); }
      stream.getVideoTracks()[0].onended = () => { stopSharing1(); stopOctoLoop(); };
      setIsSharing1(true);
    } catch (err) {
      if (err instanceof Error && err.name !== "NotAllowedError") setOctoError("Écran A : " + err.message);
    }
  }, [stopSharing1, stopOctoLoop]);

  const startSharing2 = useCallback(async () => {
    setOctoError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
      stream2Ref.current = stream;
      if (videoRef2.current) { videoRef2.current.srcObject = stream; videoRef2.current.play(); }
      stream.getVideoTracks()[0].onended = () => { stopSharing2(); stopOctoLoop(); };
      setIsSharing2(true);
    } catch (err) {
      if (err instanceof Error && err.name !== "NotAllowedError") setOctoError("Écran B : " + err.message);
    }
  }, [stopSharing2, stopOctoLoop]);

  const startOctogoneAnalysis = useCallback(() => {
    if (!isSharing1 || !isSharing2) { setOctoError("Partagez les 2 écrans avant de lancer l'analyse"); return; }
    if (octoStatus === "analyzing") return;
    // Connect WS and send frames only once the socket is confirmed open
    connectOctoWs(captureOctoAndSend);
  }, [isSharing1, isSharing2, octoStatus, connectOctoWs, captureOctoAndSend]);

  const stopOctogoneAnalysis = useCallback(() => {
    wsOctoRef.current?.close(); wsOctoRef.current = null;
    stopSharing1(); stopSharing2();
    setOctoStatus("disconnected");
  }, [stopSharing1, stopSharing2]);

  const isOctoAnalyzing = octoStatus === "analyzing";

  useEffect(() => () => { stopSoloSharing(); stopOctogoneAnalysis(); }, [stopSoloSharing, stopOctogoneAnalysis]);

  useEffect(() => {
    if (appMode === "SOLO") {
      stopOctogoneAnalysis();
    } else {
      stopSoloSharing();
    }
  }, [appMode]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!alertsEnabled || !latestSolo) return;
    const ts = history.find(h => h.mode === "SOLO")?.timestamp ?? 0;
    if (ts <= lastSoloAlertRef.current) return;
    if ((latestSolo.signal === "BUY" || latestSolo.signal === "SELL") && latestSolo.confiance >= 70) {
      lastSoloAlertRef.current = ts;
      triggerAlert(latestSolo.signal, latestSolo.actif_detecte, latestSolo.confiance, "SOLO");
    }
  }, [latestSolo, alertsEnabled, triggerAlert, history]);

  useEffect(() => {
    if (!alertsEnabled || !latestOcto) return;
    const ts = history.find(h => h.mode === "OCTOGONE")?.timestamp ?? 0;
    if (ts <= lastOctoAlertRef.current) return;
    const trade = latestOcto.trade_final;
    if ((trade.decision === "BUY" || trade.decision === "SELL") && trade.confiance >= 70) {
      lastOctoAlertRef.current = ts;
      triggerAlert(trade.decision as "BUY" | "SELL", trade.actif, trade.confiance, "OCTOGONE");
    }
  }, [latestOcto, alertsEnabled, triggerAlert, history]);

  return (
    <div className="p-6 h-full flex flex-col gap-4 min-h-0 overflow-hidden">
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-mono font-bold tracking-tight text-foreground flex items-center gap-2">
            <Monitor className="w-6 h-6 text-primary" />
            Live Screen Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {appMode === "SOLO"
              ? "1 écran — analyse Belkhayate à la demande (bouton)"
              : "2 écrans — analyse Octogone inter-corrélée (sélectionnez vos marchés)"
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 font-mono text-xs">
            <button
              onClick={() => setAppMode("SOLO")}
              className={cn("px-3 py-1.5 rounded-md transition-colors font-bold", appMode === "SOLO" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              SOLO
            </button>
            <button
              onClick={() => setAppMode("OCTOGONE")}
              className={cn("px-3 py-1.5 rounded-md transition-colors font-bold flex items-center gap-1.5", appMode === "OCTOGONE" ? "bg-violet-600 text-white" : "text-muted-foreground hover:text-foreground")}
            >
              <Globe2 className="w-3.5 h-3.5" />
              OCTOGONE
            </button>
          </div>
          <div className={cn("flex items-center gap-2 text-sm font-mono text-muted-foreground")}>
            <div className={cn("w-2 h-2 rounded-full", statusDot[appMode === "SOLO" ? wsStatus : octoStatus])} />
            {statusLabel[appMode === "SOLO" ? wsStatus : octoStatus]}
          </div>
          <button
            onClick={alertsEnabled ? () => setAlertsEnabled(false) : enableAlerts}
            title={alertsEnabled ? "Désactiver les alertes" : "Activer les alertes sonores et notifications"}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors",
              alertsEnabled
                ? "bg-amber-400/10 border-amber-400/30 text-amber-400 hover:bg-amber-400/20"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-amber-400/30"
            )}
          >
            {alertsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            {alertsEnabled ? (
              <span>
                Alertes ON
                {notifPermission === "denied" && <span className="ml-1 text-[10px] opacity-60">(son seul)</span>}
              </span>
            ) : "Alertes"}
          </button>
        </div>
      </div>

      {appMode === "SOLO" ? (
        <SoloMode
          videoRef={videoRef} canvasRef={canvasRef}
          isSharing={isSharing} wsStatus={wsStatus}
          asset={asset} setAsset={setAsset} autoDetected={autoDetected} setAutoDetected={setAutoDetected}
          timeframe={timeframe} setTimeframe={setTimeframe}
          onStart={startSoloSharing} onStop={stopSoloSharing} onAnalyze={captureSoloAndSend}
          latestSignal={latestSolo} indicateursManquants={indicateursManquants}
          error={soloError} history={history.filter(h => h.mode === "SOLO")}
        />
      ) : (
        <OctogoneMode
          videoRef1={videoRef1} canvasRef1={canvasRef1}
          videoRef2={videoRef2} canvasRef2={canvasRef2}
          isSharing1={isSharing1} isSharing2={isSharing2}
          onStart1={startSharing1} onStop1={stopSharing1}
          onStart2={startSharing2} onStop2={stopSharing2}
          isAnalyzing={isOctoAnalyzing} octoStatus={octoStatus}
          onStartAnalysis={startOctogoneAnalysis}
          onStopAnalysis={stopOctogoneAnalysis}
          latestOcto={latestOcto} error={octoError}
          history={history.filter(h => h.mode === "OCTOGONE")}
          marketsA={marketsA} setMarketsA={setMarketsA}
          marketsB={marketsB} setMarketsB={setMarketsB}
        />
      )}
    </div>
  );
}

function SoloMode({
  videoRef, canvasRef, isSharing, wsStatus,
  asset, setAsset, autoDetected, setAutoDetected, timeframe, setTimeframe,
  onStart, onStop, onAnalyze, latestSignal, indicateursManquants, error, history,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isSharing: boolean;
  wsStatus: WsStatus;
  asset: string;
  setAsset: (v: string) => void;
  autoDetected: boolean;
  setAutoDetected: (v: boolean) => void;
  timeframe: string;
  setTimeframe: (v: string) => void;
  onStart: () => void;
  onStop: () => void;
  onAnalyze: () => void;
  latestSignal: SoloSignal | null;
  indicateursManquants: string[] | null;
  error: string | null;
  history: HistoryEntry[];
}) {
  return (
    <div className="grid grid-cols-[1fr_320px] gap-6 flex-1 min-h-0">
      <div className="flex flex-col gap-4 min-h-0">
        <div className="flex items-center gap-4 bg-card border border-border rounded-lg p-4 shrink-0">
          <div className="flex-1 flex items-center gap-3">
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                Actif
                {autoDetected && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">AUTO</span>}
              </label>
              <input value={asset} onChange={e => { setAsset(e.target.value); setAutoDetected(false); }} placeholder="Détection auto…"
                className="mt-1 block w-36 bg-background border border-border rounded px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Timeframe</label>
              <input value={timeframe} onChange={e => setTimeframe(e.target.value)}
                className="mt-1 block w-20 bg-background border border-border rounded px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          {isSharing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onAnalyze}
                disabled={wsStatus === "analyzing"}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-mono rounded-md transition-colors font-semibold",
                  wsStatus === "analyzing"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/30 cursor-not-allowed"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground"
                )}
              >
                {wsStatus === "analyzing"
                  ? <><Activity className="w-4 h-4 animate-pulse" /> Analyse...</>
                  : <><Zap className="w-4 h-4" /> Analyser</>
                }
              </button>
              <button onClick={onStop} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-mono rounded-md transition-colors">
                <Square className="w-4 h-4 fill-current" /> Arrêter
              </button>
            </div>
          ) : (
            <button onClick={onStart} className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-mono rounded-md transition-colors font-semibold">
              <Play className="w-4 h-4 fill-current" /> Partager l'écran
            </button>
          )}
        </div>

        {error && <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 shrink-0"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

        <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-border bg-black relative">
          <video ref={videoRef} muted className="w-full h-full object-contain" />
          <canvas ref={canvasRef} className="hidden" />
          {!isSharing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <Monitor className="w-16 h-16 opacity-20" />
              <div className="text-center">
                <p className="font-mono text-sm font-medium">Aucun écran partagé</p>
                <p className="text-xs mt-1 opacity-60">Clique sur "Partager l'écran" pour commencer</p>
              </div>
            </div>
          )}
          {wsStatus === "analyzing" && (
            <div className="absolute top-3 right-3 flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 text-blue-400 text-xs font-mono px-3 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> Analyse IA en cours...
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto">
        {indicateursManquants && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-mono font-bold text-red-400">Indicateurs Belkhayate non détectés</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Les 3 indicateurs requis sont manquants. L'analyse est impossible.</p>
              </div>
            </div>
            {indicateursManquants.length > 0 && (
              <ul className="text-xs font-mono text-red-300/80 space-y-1 pl-1">
                {indicateursManquants.map((ind, i) => <li key={i} className="flex items-center gap-1.5"><span className="text-red-400">✕</span> {ind}</li>)}
              </ul>
            )}
            <div className="border-t border-red-500/20 pt-3">
              <p className="text-xs text-muted-foreground mb-2">Installe les indicateurs officiels :</p>
              <a href="https://www.belkhayate.net/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary text-xs font-mono font-bold rounded-md transition-colors">
                🌐 www.belkhayate.net
              </a>
            </div>
          </div>
        )}

        {!indicateursManquants && latestSignal && (
          <div className={cn("rounded-lg border p-4 flex flex-col gap-4", signalConfig[latestSignal.signal]?.bg ?? "bg-card", signalConfig[latestSignal.signal]?.border ?? "border-border")}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Signal actuel</span>
              <SignalBadge signal={latestSignal.signal} size="md" />
            </div>
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-muted-foreground">Confiance</span>
                <span className="text-foreground font-bold">{latestSignal.confiance}%</span>
              </div>
              <ConfidenceBar value={latestSignal.confiance} />
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed border-t border-white/10 pt-3">{latestSignal.raison}</p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-black/20 rounded p-2"><div className="text-muted-foreground mb-0.5">Énergie</div><div className="text-foreground font-medium">{latestSignal.energie.statut}</div><div className="text-muted-foreground text-[10px] mt-0.5 truncate">{latestSignal.energie.divergence ?? "—"}</div></div>
              <div className="bg-black/20 rounded p-2"><div className="text-muted-foreground mb-0.5">Direction</div><div className="text-foreground font-medium">{latestSignal.direction.points}</div><div className="text-muted-foreground text-[10px] mt-0.5">{latestSignal.direction.tendance}</div></div>
              <div className="bg-black/20 rounded p-2"><div className="text-muted-foreground mb-0.5">Pivot proche</div><div className="text-foreground font-medium">{latestSignal.pivots?.niveau_proche ?? "—"}</div><div className="text-muted-foreground text-[10px] mt-0.5">{latestSignal.pivots?.type ?? "—"}</div></div>
              <div className="bg-black/20 rounded p-2"><div className="text-muted-foreground mb-0.5">Take Profit</div><div className="text-foreground font-medium">{latestSignal.trade?.tp1 ?? latestSignal.pivots?.take_profit_1 ?? "—"}</div>{latestSignal.trade?.stopLoss && <div className="text-muted-foreground text-[10px] mt-0.5">SL: {latestSignal.trade.stopLoss}</div>}</div>
            </div>
            {latestSignal.conditions_manquantes && latestSignal.conditions_manquantes !== "AUCUNE" && (
              <div className="text-[10px] font-mono text-amber-400/70 border-t border-white/10 pt-2">⚠ {latestSignal.conditions_manquantes}</div>
            )}
          </div>
        )}

        {!indicateursManquants && !latestSignal && (
          <div className="rounded-lg border border-border bg-card p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[200px]">
            {isSharing ? (<><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /><p className="text-sm text-muted-foreground font-mono">Première analyse en cours...</p></>) : (<><Wifi className="w-8 h-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground font-mono">En attente du premier signal</p></>)}
          </div>
        )}

        {history.length > 0 && <LiveHistoryList history={history} />}
      </div>
    </div>
  );
}

function MarketCheckboxGroup({
  label, screenMarkets, allMarkets, onChange,
}: {
  label: string;
  screenMarkets: string[];
  allMarkets: readonly string[];
  onChange: (markets: string[]) => void;
}) {
  const toggle = (ticker: string) => {
    if (screenMarkets.includes(ticker)) {
      onChange(screenMarkets.filter(m => m !== ticker));
    } else {
      onChange([...screenMarkets, ticker]);
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-wider">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {allMarkets.map(ticker => {
          const checked = screenMarkets.includes(ticker);
          return (
            <button
              key={ticker}
              onClick={() => toggle(ticker)}
              className={cn(
                "text-[10px] font-mono font-bold px-2 py-0.5 rounded border transition-colors",
                checked
                  ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                  : "bg-black/20 border-border text-muted-foreground/50 line-through"
              )}
            >
              {ticker}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OctogoneMode({
  videoRef1, canvasRef1, videoRef2, canvasRef2,
  isSharing1, isSharing2, onStart1, onStop1, onStart2, onStop2,
  isAnalyzing, octoStatus, onStartAnalysis, onStopAnalysis,
  latestOcto, error, history,
  marketsA, setMarketsA, marketsB, setMarketsB,
}: {
  videoRef1: React.RefObject<HTMLVideoElement | null>;
  canvasRef1: React.RefObject<HTMLCanvasElement | null>;
  videoRef2: React.RefObject<HTMLVideoElement | null>;
  canvasRef2: React.RefObject<HTMLCanvasElement | null>;
  isSharing1: boolean;
  isSharing2: boolean;
  onStart1: () => void;
  onStop1: () => void;
  onStart2: () => void;
  onStop2: () => void;
  isAnalyzing: boolean;
  octoStatus: WsStatus;
  onStartAnalysis: () => void;
  onStopAnalysis: () => void;
  latestOcto: OctogoneSignal | null;
  error: string | null;
  history: HistoryEntry[];
  marketsA: string[];
  setMarketsA: React.Dispatch<React.SetStateAction<string[]>>;
  marketsB: string[];
  setMarketsB: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const bothSharing = isSharing1 && isSharing2;
  const totalPresent = marketsA.length + marketsB.length;

  const handleSetMarketsA = useCallback((markets: string[]) => {
    setMarketsA(markets);
    setMarketsB(prev => prev.filter(m => !markets.includes(m)));
  }, [setMarketsA, setMarketsB]);

  const handleSetMarketsB = useCallback((markets: string[]) => {
    setMarketsB(markets);
    setMarketsA(prev => prev.filter(m => !markets.includes(m)));
  }, [setMarketsA, setMarketsB]);

  return (
    <div className="grid grid-cols-[1fr_340px] gap-6 flex-1 min-h-0">
      <div className="flex flex-col gap-4 min-h-0">
        <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-500/30 rounded-lg px-4 py-2.5 shrink-0">
          <Globe2 className="w-4 h-4 text-violet-400 shrink-0" />
          <span className="text-xs font-mono text-violet-300 flex-1">
            Mode Octogone — Partagez 2 écrans TradingView puis lancez l'analyse inter-corrélée
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-violet-500/20 text-violet-400 border border-violet-500/30">
            {totalPresent}/8 marchés
          </span>
        </div>

        <div className="bg-card border border-border rounded-lg px-4 py-3 shrink-0 flex gap-6">
          <MarketCheckboxGroup
            label="Écran A — marchés visibles"
            screenMarkets={marketsA}
            allMarkets={OCTOGONE_MARKETS}
            onChange={handleSetMarketsA}
          />
          <div className="w-px bg-border shrink-0" />
          <MarketCheckboxGroup
            label="Écran B — marchés visibles"
            screenMarkets={marketsB}
            allMarkets={OCTOGONE_MARKETS}
            onChange={handleSetMarketsB}
          />
        </div>

        {error && <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 shrink-0"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

        <div className="flex gap-4 flex-1 min-h-0">
          <VideoPanel
            label="Écran A"
            markets={marketsA.length > 0 ? marketsA.join(" • ") : "aucun marché sélectionné"}
            videoRef={videoRef1} canvasRef={canvasRef1}
            isSharing={isSharing1} isAnalyzing={isAnalyzing}
            onStart={onStart1} onStop={onStop1}
          />
          <VideoPanel
            label="Écran B"
            markets={marketsB.length > 0 ? marketsB.join(" • ") : "aucun marché sélectionné"}
            videoRef={videoRef2} canvasRef={canvasRef2}
            isSharing={isSharing2} isAnalyzing={isAnalyzing}
            onStart={onStart2} onStop={onStop2}
          />
        </div>

        <div className="flex items-center gap-4 bg-card border border-border rounded-lg p-4 shrink-0">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className={cn("w-2 h-2 rounded-full", isSharing1 ? "bg-emerald-400" : "bg-zinc-500")} />
              <span className="text-xs font-mono text-muted-foreground">
                Écran A {marketsA.length > 0 ? `(${marketsA.join(", ")})` : "(aucun)"}
              </span>
              {isSharing1 && <span className="text-[10px] font-mono text-emerald-400">✓ Partagé</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", isSharing2 ? "bg-emerald-400" : "bg-zinc-500")} />
              <span className="text-xs font-mono text-muted-foreground">
                Écran B {marketsB.length > 0 ? `(${marketsB.join(", ")})` : "(aucun)"}
              </span>
              {isSharing2 && <span className="text-[10px] font-mono text-emerald-400">✓ Partagé</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onStartAnalysis}
              disabled={!bothSharing || isAnalyzing || totalPresent === 0}
              className={cn(
                "flex items-center gap-2 px-5 py-2 text-sm font-mono rounded-md transition-colors font-semibold",
                isAnalyzing
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/30 cursor-not-allowed"
                  : bothSharing && totalPresent > 0
                    ? "bg-violet-600 hover:bg-violet-500 text-white"
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              )}
            >
              {isAnalyzing
                ? <><Activity className="w-4 h-4 animate-pulse" /> Analyse...</>
                : <><Activity className="w-4 h-4" /> Analyser ({totalPresent} marchés)</>
              }
            </button>
            {(isSharing1 || isSharing2) && (
              <button onClick={onStopAnalysis} className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-mono rounded-md transition-colors">
                <Square className="w-3.5 h-3.5 fill-current" /> Arrêter
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto">
        {latestOcto ? (
          <OctogonePanel signal={latestOcto} />
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 flex flex-col items-center justify-center gap-3 text-center min-h-[250px]">
            {isAnalyzing ? (
              <><div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" /><p className="text-sm text-muted-foreground font-mono">Première analyse Octogone en cours...</p></>
            ) : (
              <><Globe2 className="w-10 h-10 text-muted-foreground/20" /><p className="text-sm text-muted-foreground font-mono">Partagez 2 écrans et lancez l'analyse</p><p className="text-xs text-muted-foreground/60">Seuls les marchés sélectionnés seront analysés</p></>
            )}
          </div>
        )}

        {history.length > 0 && <LiveHistoryList history={history} isOctogone />}
      </div>
    </div>
  );
}

function OctogonePanel({ signal }: { signal: OctogoneSignal }) {
  const trade = signal.trade_final;
  const isNoTrade = trade.decision === "NO_TRADE";
  const regime = regimeConfig[signal.regime_macro] ?? { label: signal.regime_macro, color: "text-gray-400", bg: "bg-gray-400/10" };
  const tradeSigCfg = signalConfig[trade.decision] ?? signalConfig["NO_SIGNAL"];

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-card border border-violet-500/30 rounded-lg p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5" /> Analyse Octogone
          </span>
          <span className={cn("text-[10px] font-mono font-bold px-2 py-0.5 rounded border", regime.color, regime.bg, "border-current/30")}>
            {regime.label}
          </span>
        </div>

        {signal.tete_du_marche && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-muted-foreground">Tête du marché :</span>
            <span className="font-bold text-violet-400 px-2 py-0.5 bg-violet-500/10 border border-violet-500/30 rounded">{signal.tete_du_marche}</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground/80 leading-relaxed border-t border-white/10 pt-2">{signal.validation_intermarche}</p>

        {signal.divergence_detectee?.presence && (
          <div className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/20 rounded p-2">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-mono font-bold text-amber-400">{signal.divergence_detectee.actif} — {signal.divergence_detectee.type?.replace(/_/g, " ")}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">{signal.divergence_detectee.detail}</p>
            </div>
          </div>
        )}

        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider pt-1">État des marchés</div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-1.5 text-[9px] font-mono text-muted-foreground/60 px-2 mb-0.5">
            <span className="w-6">TKR</span>
            <span className="w-5">SIG</span>
            <span className="text-gray-700">|</span>
            <span className="w-5">I1</span>
            <span className="w-7">I2</span>
            <span className="w-7">I3</span>
            <span className="flex-1">PIVOT</span>
          </div>
          {OCTOGONE_MARKETS.map(ticker => (
            <MarketRow key={ticker} ticker={ticker} state={signal.marches?.[ticker]} />
          ))}
        </div>
      </div>

      <div className={cn(
        "rounded-lg border p-4 flex flex-col gap-3",
        isNoTrade ? "bg-gray-400/5 border-gray-400/20" : (tradeSigCfg.bg + " " + tradeSigCfg.border),
      )}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Trade final
          </span>
          <SignalBadge signal={trade.decision} size="md" />
        </div>

        {!isNoTrade && trade.actif && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-muted-foreground">Actif :</span>
            <span className="font-bold text-foreground px-2 py-0.5 bg-black/20 rounded">{trade.actif}</span>
            <span className="text-muted-foreground text-[10px] opacity-60">{trade.type?.replace(/_/g, " ")}</span>
          </div>
        )}

        {!isNoTrade && (
          <div>
            <div className="flex justify-between text-xs font-mono mb-1.5">
              <span className="text-muted-foreground">Confiance</span>
              <span className="font-bold text-foreground">{trade.confiance}%</span>
            </div>
            <ConfidenceBar value={trade.confiance} />
          </div>
        )}

        <p className="text-xs text-foreground/80 leading-relaxed border-t border-white/10 pt-2">{trade.logique}</p>

        {!isNoTrade && (trade.entry || trade.stopLoss || trade.tp1) && (
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {trade.entry && <div className="bg-black/20 rounded p-2"><div className="text-muted-foreground text-[10px] mb-0.5">Entrée</div><div className="text-foreground font-medium">{trade.entry}</div></div>}
            {trade.stopLoss && <div className="bg-black/20 rounded p-2"><div className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1"><ShieldAlert className="w-2.5 h-2.5 text-red-400" />Stop Loss</div><div className="text-red-400 font-medium">{trade.stopLoss}</div></div>}
            {trade.tp1 && <div className="bg-black/20 rounded p-2"><div className="text-muted-foreground text-[10px] mb-0.5">TP 1</div><div className="text-emerald-400 font-medium">{trade.tp1}</div></div>}
            {trade.tp2 && <div className="bg-black/20 rounded p-2"><div className="text-muted-foreground text-[10px] mb-0.5">TP 2</div><div className="text-emerald-400 font-medium">{trade.tp2}</div></div>}
          </div>
        )}

        {isNoTrade && signal.raisons_no_trade && signal.raisons_no_trade.length > 0 && (
          <ul className="text-[10px] font-mono text-muted-foreground space-y-1 border-t border-white/10 pt-2">
            {signal.raisons_no_trade.map((r, i) => <li key={i} className="flex items-center gap-1.5"><span className="text-gray-500">·</span>{r}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

function LiveHistoryList({ history, isOctogone = false }: { history: HistoryEntry[]; isOctogone?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider px-1">
        Historique live {isOctogone ? "— Octogone" : "— Solo"}
      </div>
      {history.map((entry, i) => {
        const cfg = signalConfig[entry.signal] ?? signalConfig["NO_SIGNAL"];
        const modeColor = entry.mode === "OCTOGONE" ? "text-blue-400 border-blue-400/30" : "text-gray-500 border-gray-500/30";
        return (
          <div key={i} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
            <div className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-xs font-mono font-bold", cfg.color)}>{cfg.label}</span>
                {entry.actif && <span className="text-xs font-mono text-muted-foreground">{entry.actif}</span>}
                <span className="text-xs text-muted-foreground">{entry.confiance}%</span>
                <span className={cn("text-[9px] font-mono border rounded px-1 py-0.5 leading-none shrink-0", modeColor)}>
                  {entry.mode ?? "SOLO"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.raison}</p>
            </div>
            <span className="text-xs font-mono text-muted-foreground shrink-0">{formatTime(entry.timestamp)}</span>
          </div>
        );
      })}
    </div>
  );
}
