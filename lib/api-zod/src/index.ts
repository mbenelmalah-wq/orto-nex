// Only export the Zod schemas from generated/api — do NOT re-export generated/types.
// Orval generates TypeScript interfaces in generated/types/ that share names with the
// Zod schemas in generated/api.ts (e.g. both export "AnalyzeChartBody"). Re-exporting
// both barrels causes a duplicate-export TS error. Since all consumers use the Zod
// schemas (and TypeScript infers the types from them), the generated/types barrel is
// intentionally omitted here.
export * from "./generated/api";
