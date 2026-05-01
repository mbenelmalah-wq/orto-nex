import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  signal: text("signal").notNull(),
  asset: text("asset"),
  timeframe: text("timeframe"),
  synthesis: text("synthesis").notNull(),
  rawAnalysis: text("raw_analysis").notNull(),
  imageBase64: text("image_base64"),
  energyState: text("energy_state").notNull(),
  directionTrend: text("direction_trend").notNull(),
  nearestPivot: text("nearest_pivot").notNull(),
  entry: text("entry"),
  stopLoss: text("stop_loss"),
  tp1: text("tp1"),
  tp2: text("tp2"),
  mode: text("mode").default("SOLO"),
  sessionId: text("session_id"),
  tp_mismatch: boolean("tp_mismatch").notNull().default(false),
  tp_mismatch_detail: text("tp_mismatch_detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({ id: true, createdAt: true });
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
