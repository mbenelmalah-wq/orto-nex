import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, analysesTable } from "@workspace/db";
import { logger } from "./logger";
import { BELKHAYATE_SYSTEM_PROMPT, BELKHAYATE_JSON_SCHEMA } from "./belkhayatePrompt";

const LIVE_SYSTEM_PROMPT = `${BELKHAYATE_SYSTEM_PROMPT}

Réponds UNIQUEMENT avec ce JSON valide (aucun texte avant ou après) :
${BELKHAYATE_JSON_SCHEMA}`;

const LIVE_USER_TEXT = `Applique l'algorithme Belkhayate en 6 étapes sur ce graphique TradingView en temps réel.
Détecte automatiquement l'actif et le timeframe visibles en haut à gauche du graphique.
Réponds UNIQUEMENT avec le JSON demandé, sans texte avant ou après.`;

interface LiveFrame {
  type: "frame";
  data: string;
  asset?: string;
  timeframe?: string;
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export function createLiveAnalysisWss() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    logger.info("Live analysis WebSocket client connected");

    sendJson(ws, { type: "connected", message: "Live analysis ready" });

    ws.on("message", async (raw) => {
      let msg: LiveFrame;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        sendJson(ws, { type: "error", message: "Invalid JSON message" });
        return;
      }

      if (msg.type !== "frame" || !msg.data) {
        sendJson(ws, { type: "error", message: "Expected { type: 'frame', data: '<base64>' }" });
        return;
      }

      sendJson(ws, { type: "analyzing" });

      try {
        const imageUrl = msg.data.startsWith("data:")
          ? msg.data
          : `data:image/png;base64,${msg.data}`;

        const response = await openai.chat.completions.create({
          model: "gpt-5.2",
          max_completion_tokens: 1024,
          messages: [
            { role: "system", content: LIVE_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: imageUrl, detail: "high" },
                },
                { type: "text", text: LIVE_USER_TEXT },
              ],
            },
          ],
        });

        const rawContent = response.choices[0]?.message?.content ?? "";
        logger.info({ ts: new Date().toISOString() }, "Live analysis cycle complete");

        let parsed: Record<string, unknown>;
        try {
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
        } catch {
          sendJson(ws, {
            type: "signal",
            payload: { error: "parse_error", raw: rawContent },
            timestamp: Date.now(),
          });
          return;
        }

        const rawSignal = (parsed.signal as string) ?? "NO_SIGNAL";
        const validSignals = ["BUY", "SELL", "WAIT", "NO_SIGNAL"];
        const dbSignal = validSignals.includes(rawSignal) ? rawSignal : "WAIT";

        const detectedAsset = (parsed.actif_detecte as string | null) ?? null;
        const detectedTimeframe = (parsed.timeframe_detecte as string | null) ?? null;

        const energie = parsed.energie as { statut?: string } | null;
        const direction = parsed.direction as { tendance?: string } | null;
        const pivots = parsed.pivots as { niveau_proche?: string; take_profit_1?: string; take_profit_2?: string } | null;
        const trade = parsed.trade as { entry?: string; stopLoss?: string; tp1?: string; tp2?: string } | null;

        await db.insert(analysesTable).values({
          signal: dbSignal,
          asset: detectedAsset ?? msg.asset ?? null,
          timeframe: detectedTimeframe ?? msg.timeframe ?? null,
          synthesis: (parsed.raison as string) ?? "Live analysis",
          rawAnalysis: rawContent,
          imageBase64: null,
          energyState: energie?.statut ?? "ABSENT",
          directionTrend: direction?.tendance ?? "NEUTRE",
          nearestPivot: pivots?.niveau_proche ?? "aucun",
          entry: trade?.entry ?? null,
          stopLoss: trade?.stopLoss ?? null,
          tp1: trade?.tp1 ?? pivots?.take_profit_1 ?? null,
          tp2: trade?.tp2 ?? pivots?.take_profit_2 ?? null,
        });

        sendJson(ws, {
          type: "signal",
          payload: parsed,
          timestamp: Date.now(),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logger.error({ err }, "Live analysis error");
        sendJson(ws, { type: "error", message });
      }
    });

    ws.on("close", () => {
      logger.info("Live analysis WebSocket client disconnected");
    });
  });

  logger.info("Live analysis WebSocket server created (noServer)");
  return wss;
}
