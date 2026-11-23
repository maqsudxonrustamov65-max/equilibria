const MINUS = "−";

function round(x: number, digits: number): number {
  const f = 10 ** digits;
  const r = Math.round(x * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

function grouped(x: number, min: number, max: number): string {
  return x.toLocaleString("en-US", { minimumFractionDigits: min, maximumFractionDigits: max });
}

/** "$50.00", "−$2.50"; an em dash for undefined values. */
export function money(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return "—";
  const r = round(x, digits);
  return `${r < 0 ? MINUS : ""}$${grouped(Math.abs(r), digits, digits)}`;
}

/** Surplus areas: whole dollars, "$1,600". */
export function area(x: number): string {
  return money(x, 0);
}

/** Quantities: at most one decimal, "40" or "6.7". */
export function qty(x: number): string {
  if (!Number.isFinite(x)) return "—";
  const r = round(x, 1);
  return `${r < 0 ? MINUS : ""}${grouped(Math.abs(r), 0, 1)}`;
}

/** Plain number with fixed decimals, used for slopes and intercepts. */
export function fixed(x: number, digits: number): string {
  if (!Number.isFinite(x)) return "—";
  const r = round(x, digits);
  return `${r < 0 ? MINUS : ""}${grouped(Math.abs(r), digits, digits)}`;
}

/** Signed change: "+$125", "−$40", or null when the change rounds to zero. */
export function deltaArea(x: number): string | null {
  const r = round(x, 0);
  if (r === 0) return null;
  return `${r > 0 ? "+" : MINUS}$${grouped(Math.abs(r), 0, 0)}`;
}

/** Signed quantity change: "+5", "−2.5", or null when it rounds to zero. */
export function deltaQty(x: number): string | null {
  const r = round(x, 1);
  if (r === 0) return null;
  return `${r > 0 ? "+" : MINUS}${grouped(Math.abs(r), 0, 1)}`;
}

export function percent(x: number): string {
  if (!Number.isFinite(x)) return "—";
  return `${Math.round(x * 100)}%`;
}

export const minus = MINUS;
