import type { MarketParams, Mode, PolicyParams } from "./economics.ts";

/** Fixed chart domain. Curves are clipped to this box. */
export const Q_MAX = 100;
export const P_MAX = 100;

export interface Range {
  min: number;
  max: number;
  step: number;
}

export const LIMITS = {
  a: { min: 10, max: 150, step: 0.5 },
  b: { min: 0.2, max: 4, step: 0.05 },
  c: { min: 0, max: 90, step: 0.5 },
  d: { min: 0.2, max: 4, step: 0.05 },
  tax: { min: 0, max: 50, step: 0.5 },
  subsidy: { min: 0, max: 40, step: 0.5 },
  ceiling: { min: 0, max: 100, step: 0.5 },
  floor: { min: 0, max: 100, step: 0.5 },
} satisfies Record<string, Range>;

export type LimitKey = keyof typeof LIMITS;

export function clampTo(key: LimitKey, value: number): number {
  const { min, max } = LIMITS[key];
  return Math.min(max, Math.max(min, value));
}

/** Round to the slider step and clamp to range. */
export function snapTo(key: LimitKey, value: number): number {
  const { step } = LIMITS[key];
  return clampTo(key, Math.round(value / step) * step);
}

/* ------------------------------------------------------------------ */
/* Market contexts: the nouns used in labels and explanations          */
/* ------------------------------------------------------------------ */

export type ContextId = "generic" | "housing" | "cigarettes" | "labor";

export interface MarketContext {
  id: ContextId;
  name: string;
  /** Axis label, e.g. "Price ($)". */
  priceAxis: string;
  /** Axis label, e.g. "Quantity". */
  quantityAxis: string;
  /** Lowercase price noun: "price", "rent", "wage". */
  priceWord: string;
  /** Plural quantity unit used after numbers: "units", "thousand workers". */
  unit: string;
  buyers: string;
  buyer: string;
  sellers: string;
  seller: string;
  /** "trade", "rentals", "sales", "employment". */
  tradeWord: string;
  /** "traded", "rented", "sold", "employed". */
  tradedVerb: string;
  /** "nothing is traded", "no one is hired". */
  noneTraded: string;
  ceilingName: string;
  floorName: string;
  shortageLabel: string;
  excessLabel: string;
  shortageClause: (qd: string, qs: string, gap: string) => string;
  excessClause: (qs: string, qd: string, gap: string) => string;
}

export const CONTEXTS: Record<ContextId, MarketContext> = {
  generic: {
    id: "generic",
    name: "Generic market",
    priceAxis: "Price ($)",
    quantityAxis: "Quantity",
    priceWord: "price",
    unit: "units",
    buyers: "buyers",
    buyer: "buyer",
    sellers: "sellers",
    seller: "seller",
    tradeWord: "trade",
    tradedVerb: "traded",
    noneTraded: "nothing is traded",
    ceilingName: "price ceiling",
    floorName: "price floor",
    shortageLabel: "Shortage",
    excessLabel: "Surplus",
    shortageClause: (qd, qs, gap) =>
      `buyers want ${qd} units but sellers offer only ${qs}, a shortage of ${gap} units`,
    excessClause: (qs, qd, gap) =>
      `sellers offer ${qs} units but buyers want only ${qd}, a surplus of ${gap} units`,
  },
  housing: {
    id: "housing",
    name: "Rental housing",
    priceAxis: "Rent ($)",
    quantityAxis: "Apartments (thousands)",
    priceWord: "rent",
    unit: "thousand apartments",
    buyers: "tenants",
    buyer: "tenant",
    sellers: "landlords",
    seller: "landlord",
    tradeWord: "rentals",
    tradedVerb: "rented",
    noneTraded: "no apartments are rented",
    ceilingName: "rent ceiling",
    floorName: "rent floor",
    shortageLabel: "Shortage",
    excessLabel: "Vacancies",
    shortageClause: (qd, qs, gap) =>
      `tenants want ${qd} thousand apartments but landlords offer only ${qs} thousand, a shortage of ${gap} thousand`,
    excessClause: (qs, qd, gap) =>
      `landlords offer ${qs} thousand apartments but tenants want only ${qd} thousand, leaving ${gap} thousand vacant`,
  },
  cigarettes: {
    id: "cigarettes",
    name: "Cigarettes",
    priceAxis: "Price per pack ($)",
    quantityAxis: "Packs (millions)",
    priceWord: "price",
    unit: "million packs",
    buyers: "smokers",
    buyer: "smoker",
    sellers: "sellers",
    seller: "seller",
    tradeWord: "sales",
    tradedVerb: "sold",
    noneTraded: "nothing is sold",
    ceilingName: "price ceiling",
    floorName: "price floor",
    shortageLabel: "Shortage",
    excessLabel: "Surplus",
    shortageClause: (qd, qs, gap) =>
      `smokers want ${qd} million packs but sellers offer only ${qs} million, a shortage of ${gap} million`,
    excessClause: (qs, qd, gap) =>
      `sellers offer ${qs} million packs but smokers want only ${qd} million, a surplus of ${gap} million`,
  },
  labor: {
    id: "labor",
    name: "Low-wage labor",
    priceAxis: "Wage ($)",
    quantityAxis: "Workers (thousands)",
    priceWord: "wage",
    unit: "thousand workers",
    buyers: "employers",
    buyer: "employer",
    sellers: "workers",
    seller: "worker",
    tradeWord: "employment",
    tradedVerb: "employed",
    noneTraded: "no one is hired",
    ceilingName: "wage ceiling",
    floorName: "minimum wage",
    shortageLabel: "Labor shortage",
    excessLabel: "Unemployment",
    shortageClause: (qd, qs, gap) =>
      `employers want ${qd} thousand workers but only ${qs} thousand will work at that wage, a shortage of ${gap} thousand`,
    excessClause: (qs, qd, gap) =>
      `${qs} thousand people want jobs but employers hire only ${qd} thousand, leaving ${gap} thousand unemployed`,
  },
};

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export type PresetId = "free" | "rent" | "cigarette" | "minwage";

export interface Preset {
  id: PresetId;
  label: string;
  contextId: ContextId;
  summary: string;
  market: MarketParams;
  mode: Mode;
  policy: PolicyParams;
}

export const PRESETS: Preset[] = [
  {
    id: "free",
    label: "Free market",
    contextId: "generic",
    summary: "No intervention. Drag either curve or use the sliders to see how the equilibrium responds.",
    market: { a: 90, b: 1, c: 10, d: 1 },
    mode: "none",
    policy: { tax: 10, subsidy: 10, ceiling: 40, floor: 60 },
  },
  {
    id: "rent",
    label: "Rent control",
    contextId: "housing",
    summary: "A legal maximum rent below the market rate. Landlords offer fewer apartments than tenants want.",
    market: { a: 100, b: 1.25, c: 10, d: 1 },
    mode: "ceiling",
    policy: { tax: 10, subsidy: 10, ceiling: 35, floor: 60 },
  },
  {
    id: "cigarette",
    label: "Cigarette tax",
    contextId: "cigarettes",
    summary: "A per-pack excise tax on a product with inelastic demand, so smokers carry most of the burden.",
    market: { a: 100, b: 2, c: 25, d: 0.5 },
    mode: "tax",
    policy: { tax: 20, subsidy: 10, ceiling: 30, floor: 50 },
  },
  {
    id: "minwage",
    label: "Minimum wage",
    contextId: "labor",
    summary: "A wage floor above the market wage. More people want jobs than employers choose to fill.",
    market: { a: 85, b: 1, c: 15, d: 1 },
    mode: "floor",
    policy: { tax: 10, subsidy: 10, ceiling: 40, floor: 60 },
  },
];

export const PRESET_BY_ID: Record<PresetId, Preset> = Object.fromEntries(
  PRESETS.map((p) => [p.id, p]),
) as Record<PresetId, Preset>;
