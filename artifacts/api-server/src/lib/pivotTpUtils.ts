// Ordre des pivots Belkhayate du plus bas au plus haut
export const PIVOT_ORDER = ["DO", "RE", "MI", "FA", "SOL", "LA", "SI"] as const;
export type Pivot = (typeof PIVOT_ORDER)[number];

const PIVOT_SET = new Set<string>(PIVOT_ORDER);

export function isPivot(value: string | null | undefined): value is Pivot {
  return !!value && PIVOT_SET.has(value.toUpperCase());
}

export function normalizePivot(value: string): Pivot | null {
  const upper = value.trim().toUpperCase();
  const normalized = upper.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return isPivot(normalized) ? (normalized as Pivot) : null;
}

export function pivotIndex(pivot: Pivot): number {
  return PIVOT_ORDER.indexOf(pivot);
}

export interface TpValidationResult {
  valid: boolean;
  detail?: string;
}

export function validateAiTp(
  signal: "BUY" | "SELL",
  entryPivot: string,
  tp1: string | null | undefined,
  tp2: string | null | undefined
): TpValidationResult {
  const entry = normalizePivot(entryPivot);
  if (!entry) return { valid: false, detail: `Entry pivot invalide: "${entryPivot}"` };
  if (!tp1) return { valid: false, detail: "tp1 absent" };

  const tp1Pivot = normalizePivot(tp1);
  if (!tp1Pivot) return { valid: false, detail: `tp1 non reconnu: "${tp1}"` };

  const entryIdx = pivotIndex(entry);
  const tp1Idx = pivotIndex(tp1Pivot);

  if (signal === "BUY" && tp1Idx <= entryIdx)
    return { valid: false, detail: `BUY: tp1 (${tp1Pivot}) doit être supérieur à entry (${entry})` };
  if (signal === "SELL" && tp1Idx >= entryIdx)
    return { valid: false, detail: `SELL: tp1 (${tp1Pivot}) doit être inférieur à entry (${entry})` };

  if (tp2) {
    const tp2Pivot = normalizePivot(tp2);
    if (!tp2Pivot) return { valid: false, detail: `tp2 non reconnu: "${tp2}"` };
    const tp2Idx = pivotIndex(tp2Pivot);
    if (signal === "BUY" && tp2Idx <= tp1Idx)
      return { valid: false, detail: `BUY: tp2 (${tp2Pivot}) doit être supérieur à tp1 (${tp1Pivot})` };
    if (signal === "SELL" && tp2Idx >= tp1Idx)
      return { valid: false, detail: `SELL: tp2 (${tp2Pivot}) doit être inférieur à tp1 (${tp1Pivot})` };
  }

  return { valid: true };
}
