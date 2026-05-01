import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { randomUUID } from "crypto";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, analysesTable } from "@workspace/db";
import { logger } from "./logger";
import { OCTOGONE_SYSTEM_PROMPT, OCTOGONE_JSON_SCHEMA, buildOctogoneUserText } from "./octogonePrompt";

const OCTOGONE_FULL_SYSTEM = `${OCTOGONE_SYSTEM_PROMPT}

Réponds UNIQUEMENT avec ce JSON valide (aucun texte avant ou après) :
${OCTOGONE_JSON_SCHEMA}`;

const DEFAULT_MARKETS_A = ["DX", "BTC", "ZN", "6J"];
const DEFAULT_MARKETS_B = ["ES", "CL", "GC", "HG"];
const ALL_MARKETS = ["ZN", "DX", "ES", "BTC", "CL", "GC", "HG", "6J"];

const INVALID_MARKET_STATE = {
  valide: false,
  signal_local: "NO_SIGNAL",
  i1: "NEUTRE",
  i2: "NULLE",
  i3: "NEUTRE",
  energie: { statut: "ABSENT", intensite: "FAIBLE", divergence: "AUCUNE" },
  direction: { tendance: "NEUTRE", points: "INDETERMINES", effet_ressort: false },
  pivots: { niveau_proche: "AUCUN", type: "neutre", reaction_prix: "AUCUNE" },
};

function normalizeAbsentMarkets(
  parsed: Record<string, unknown>,
  marketsA: string[],
  marketsB: string[],
): void {
  const presentSet = new Set([...marketsA, ...marketsB]);
  const existing = parsed.marches;
  const marches: Record<string, unknown> =
    existing !== null && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  for (const ticker of ALL_MARKETS) {
    if (!presentSet.has(ticker)) {
      marches[ticker] = { ...INVALID_MARKET_STATE };
    } else if (!(ticker in marches)) {
      marches[ticker] = { ...INVALID_MARKET_STATE };
    }
  }
  parsed.marches = marches;
}

interface DualFrame {
  type: "dual_frame";
  frame1: string;
  frame2: string;
  marketsA?: string[];
  marketsB?: string[];
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function toImageUrl(data: string): string {
  return data.startsWith("data:") ? data : `data:image/png;base64,${data}`;
}

export function createOctogoneAnalysisWss() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    logger.info("Octogone analysis WebSocket client connected");

    sendJson(ws, { type: "connected", message: "Octogone analysis ready — flexible markets" });

    ws.on("message", async (raw) => {
      let msg: DualFrame;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        sendJson(ws, { type: "error", message: "Invalid JSON message" });
        return;
      }

      if (msg.type !== "dual_frame" || !msg.frame1 || !msg.frame2) {
        sendJson(ws, { type: "error", message: "Expected { type: 'dual_frame', frame1: '<base64>', frame2: '<base64>' }" });
        return;
      }

      const canonicalSet = new Set(ALL_MARKETS);
      const rawMarketsA = Array.isArray(msg.marketsA)
        ? [...new Set(msg.marketsA.filter((m) => canonicalSet.has(m)))]
        : DEFAULT_MARKETS_A;
      const rawMarketsB = Array.isArray(msg.marketsB)
        ? [...new Set(msg.marketsB.filter((m) => canonicalSet.has(m)))]
        : DEFAULT_MARKETS_B;
      const usedInA = new Set(rawMarketsA);
      const marketsA = rawMarketsA;
      const marketsB = rawMarketsB.filter((m) => !usedInA.has(m));

      const sessionId = randomUUID();
      sendJson(ws, { type: "analyzing" });

      try {
        const imageUrl1 = toImageUrl(msg.frame1);
        const imageUrl2 = toImageUrl(msg.frame2);

        const userText = buildOctogoneUserText(marketsA, marketsB);
        const screenALabel = `IMAGE 1 — Écran A (${marketsA.join(", ")}) :`;
        const screenBLabel = `IMAGE 2 — Écran B (${marketsB.join(", ")}) :`;

        const response = await openai.chat.completions.create({
          model: "gpt-5.2",
          max_completion_tokens: 3000,
          messages: [
            { role: "system", content: OCTOGONE_FULL_SYSTEM },
            {
              role: "user",
              content: [
                { type: "text", text: screenALabel },
                { type: "image_url", image_url: { url: imageUrl1, detail: "high" } },
                { type: "text", text: screenBLabel },
                { type: "image_url", image_url: { url: imageUrl2, detail: "high" } },
                { type: "text", text: userText },
              ],
            },
          ],
        });

        const rawContent = response.choices[0]?.message?.content ?? "";
        logger.info({ ts: new Date().toISOString(), marketsA, marketsB }, "Octogone analysis cycle complete");

        let parsed: Record<string, unknown>;
        try {
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
        } catch {
          sendJson(ws, {
            type: "octogone_signal",
            payload: { error: "parse_error", raw: rawContent },
            timestamp: Date.now(),
          });
          return;
        }

        normalizeAbsentMarkets(parsed, marketsA, marketsB);

        const tradeFinal = parsed.trade_final as {
          decision?: string;
          actif?: string;
          logique?: string;
          entry?: string;
          stopLoss?: string;
          tp1?: string;
          tp2?: string;
          confiance?: number;
        } | null;

        const rawDecision = tradeFinal?.decision ?? "NO_TRADE";
        const validSignals = ["BUY", "SELL", "NO_TRADE"];
        const dbSignal = validSignals.includes(rawDecision) ? rawDecision : "NO_TRADE";

        const regime = (parsed.regime_macro as string) ?? "CHAOS_DESYNCHRONISE";

        await db.insert(analysesTable).values({
          signal: dbSignal,
          asset: tradeFinal?.actif ?? null,
          timeframe: "30",
          synthesis: tradeFinal?.logique ?? `Analyse Octogone (${[...marketsA, ...marketsB].join(", ")})`,
          rawAnalysis: JSON.stringify(parsed),
          imageBase64: null,
          energyState: regime,
          directionTrend: (parsed.tete_du_marche as string) ?? "NEUTRE",
          nearestPivot: tradeFinal?.entry ?? "aucun",
          entry: tradeFinal?.entry ?? null,
          stopLoss: tradeFinal?.stopLoss ?? null,
          tp1: tradeFinal?.tp1 ?? null,
          tp2: tradeFinal?.tp2 ?? null,
          mode: "OCTOGONE",
          sessionId,
        });

        sendJson(ws, {
          type: "octogone_signal",
          payload: parsed,
          timestamp: Date.now(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logger.error({ err }, "Octogone analysis error");
        sendJson(ws, { type: "error", message });
      }
    });

    ws.on("close", () => {
      logger.info("Octogone analysis WebSocket client disconnected");
    });
  });

  logger.info("Octogone analysis WebSocket server created (noServer)");
  return wss;
}
