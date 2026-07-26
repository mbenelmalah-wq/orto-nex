import { Router, type IRouter } from "express";
import { desc, eq, gte, sql } from "drizzle-orm";
import { db, analysesTable } from "@workspace/db";
import {
  AnalyzeChartBody,
  GetAnalysisParams,
  DeleteAnalysisParams,
  AnalyzeChartResponse,
  GetAnalysisResponse,
  GetAnalysisStatsResponse,
  ListAnalysisHistoryResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { BELKHAYATE_SYSTEM_PROMPT, BELKHAYATE_JSON_SCHEMA } from "../lib/belkhayatePrompt";
import { validateAiTp } from "../lib/pivotTpUtils";

const router: IRouter = Router();

const FULL_SYSTEM_PROMPT = `${BELKHAYATE_SYSTEM_PROMPT}

Réponds UNIQUEMENT avec ce JSON valide (aucun texte avant ou après) :
${BELKHAYATE_JSON_SCHEMA}`;

router.post("/analysis/analyze", async (req, res): Promise<void> => {
  const parsed = AnalyzeChartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { imageBase64, asset, timeframe, mode } = parsed.data;

  let imageUrl: string;
  if (imageBase64.startsWith("data:")) {
    imageUrl = imageBase64;
  } else {
    imageUrl = `data:image/png;base64,${imageBase64}`;
  }

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content: FULL_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: "high" },
          },
          {
            type: "text",
            text: `Applique l'algorithme Belkhayate en 6 étapes sur ce graphique TradingView.${asset ? ` Actif connu: ${asset}.` : " Détecte également l'actif visible sur le graphique et inscris-le dans actif_detecte."}${timeframe ? ` Timeframe: ${timeframe}.` : " Détecte également le timeframe visible."} Réponds UNIQUEMENT avec le JSON demandé, sans texte avant ou après.`,
          },
        ],
      },
    ],
  });

  const rawContent = response.choices[0]?.message?.content ?? "";

  let parsed2: {
    signal: string;
    asset?: string | null;
    timeframe?: string | null;
    energy: { state: string; intensity: string; divergence: string; detail: string };
    direction: { trend: string; points: string; bands: string; springEffect: string };
    pivots: { currentPrice?: string | null; nearestPivot: string; pivotType: string; nextPivot: string };
    trade?: { entry: string; stopLoss: string; tp1: string; tp2: string } | null;
    missingConditions?: string;
    synthesis: string;
  };

  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawContent;
    parsed2 = JSON.parse(jsonStr);
  } catch {
    req.log.error({ rawContent }, "Failed to parse AI response as JSON");
    res.status(500).json({ error: "Failed to parse AI analysis response" });
    return;
  }

  const validSignals = ["BUY", "SELL", "WAIT", "NO_SIGNAL"];
  const signal = validSignals.includes(parsed2.signal) ? parsed2.signal : "NO_SIGNAL";

  const resolvedMode = mode ?? "SOLO";

  let tpMismatch = false;
  let tpMismatchDetail: string | null = null;
  const tpCorrected = false;

  if ((signal === "BUY" || signal === "SELL") && parsed2.trade?.entry) {
    const validation = validateAiTp(
      signal,
      parsed2.trade.entry,
      parsed2.trade.tp1 ?? null,
      parsed2.trade.tp2 ?? null,
    );
    if (!validation.valid) {
      tpMismatch = true;
      tpMismatchDetail = validation.detail ?? null;
    }
  }

  const [record] = await db.insert(analysesTable).values({
    signal,
    asset: asset ?? parsed2.asset ?? null,
    timeframe: timeframe ?? parsed2.timeframe ?? null,
    synthesis: parsed2.synthesis,
    rawAnalysis: rawContent,
    imageBase64: imageBase64.length < 500000 ? imageBase64 : null,
    energyState: parsed2.energy?.state ?? "Absent",
    directionTrend: parsed2.direction?.trend ?? "NEUTRE",
    nearestPivot: parsed2.pivots?.nearestPivot ?? "FA",
    entry: parsed2.trade?.entry ?? null,
    stopLoss: parsed2.trade?.stopLoss ?? null,
    tp1: parsed2.trade?.tp1 ?? null,
    tp2: parsed2.trade?.tp2 ?? null,
    mode: resolvedMode,
    tp_mismatch: tpMismatch,
    tp_mismatch_detail: tpMismatchDetail,
  }).returning();

  const result = {
    signal,
    asset: record.asset ?? null,
    timeframe: record.timeframe ?? null,
    energy: parsed2.energy,
    direction: parsed2.direction,
    pivots: parsed2.pivots,
    trade: parsed2.trade ?? null,
    missingConditions: parsed2.missingConditions ?? "AUCUNE",
    synthesis: parsed2.synthesis,
    rawAnalysis: rawContent,
    analyzedAt: record.createdAt.toISOString(),
    mode: record.mode ?? resolvedMode,
    tpMismatch,
    tpMismatchDetail,
    tpCorrected,
  };

  res.json(AnalyzeChartResponse.parse(result));
});

router.get("/analysis/history", async (_req, res): Promise<void> => {
  const records = await db
    .select()
    .from(analysesTable)
    .orderBy(desc(analysesTable.createdAt))
    .limit(100);

  res.json(ListAnalysisHistoryResponse.parse(records));
});

router.get("/analysis/history/:id", async (req, res): Promise<void> => {
  const params = GetAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [record] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, params.data.id));

  if (!record) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.json(GetAnalysisResponse.parse(record));
});

router.delete("/analysis/history/:id", async (req, res): Promise<void> => {
  const params = DeleteAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [record] = await db
    .delete(analysesTable)
    .where(eq(analysesTable.id, params.data.id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/analysis/stats", async (_req, res): Promise<void> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [statsRaw] = await db
    .select({
      total: sql<number>`count(*)::int`,
      buySignals: sql<number>`count(*) filter (where signal = 'BUY')::int`,
      sellSignals: sql<number>`count(*) filter (where signal = 'SELL')::int`,
      waitSignals: sql<number>`count(*) filter (where signal = 'WAIT')::int`,
      noSignals: sql<number>`count(*) filter (where signal = 'NO_SIGNAL')::int`,
      soloTotal: sql<number>`count(*) filter (where coalesce(mode, 'SOLO') = 'SOLO')::int`,
      octogoneTotal: sql<number>`count(*) filter (where mode = 'OCTOGONE')::int`,
      tpMismatchTotal: sql<number>`count(*) filter (where tp_mismatch = true)::int`,
    })
    .from(analysesTable);

  const [todayRaw] = await db
    .select({
      todayCount: sql<number>`count(*)::int`,
    })
    .from(analysesTable)
    .where(gte(analysesTable.createdAt, todayStart));

  const macroRegimesRaw = await db
    .select({
      regime: analysesTable.energyState,
      count: sql<number>`count(*)::int`,
    })
    .from(analysesTable)
    .where(eq(analysesTable.mode, "OCTOGONE"))
    .groupBy(analysesTable.energyState)
    .orderBy(desc(sql`count(*)`));

  const stats = {
    total: statsRaw?.total ?? 0,
    buySignals: statsRaw?.buySignals ?? 0,
    sellSignals: statsRaw?.sellSignals ?? 0,
    waitSignals: statsRaw?.waitSignals ?? 0,
    noSignals: statsRaw?.noSignals ?? 0,
    todayCount: todayRaw?.todayCount ?? 0,
    soloTotal: statsRaw?.soloTotal ?? 0,
    octogoneTotal: statsRaw?.octogoneTotal ?? 0,
    octogoneMacroRegimes: macroRegimesRaw.map((r) => ({ regime: r.regime, count: r.count })),
    tpMismatchTotal: statsRaw?.tpMismatchTotal ?? 0,
    tpCorrectedTotal: 0,
  };

  res.json(GetAnalysisStatsResponse.parse(stats));
});

export default router;
