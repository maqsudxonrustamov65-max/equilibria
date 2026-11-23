/**
 * Linear partial-equilibrium model.
 *
 *   Demand:  P = a − bQ     (a > 0, b > 0)
 *   Supply:  P = c + dQ     (c ≥ 0, d > 0)
 *
 * Free market:
 *   Q* = (a − c) / (b + d)
 *   P* = a − bQ* = (ad + bc) / (b + d)
 *   CS = ½ · Q* · (a − P*)
 *   PS = ½ · Q* · (P* − c)
 *   TS = CS + PS = ½ · Q* · (a − c)
 *
 * Per-unit tax t (levied on sellers) shifts supply up to P = c + t + dQ.
 * A per-unit subsidy s is a negative tax (t = −s), shifting supply down.
 *   Q_t = (a − c − t) / (b + d)
 *   Buyer price  P_b = a − bQ_t
 *   Seller price P_s = P_b − t = c + dQ_t
 *   Government   G   = t · Q_t     (revenue if t > 0, cost if t < 0)
 *
 * Price ceiling P_c (binds when P_c < P*): Q = Q_s(P_c), shortage = Q_d − Q_s.
 * Price floor   P_f (binds when P_f > P*): Q = Q_d(P_f), surplus  = Q_s − Q_d.
 * Under price controls, the units that do trade are assumed to go to the
 * buyers who value them most and come from the sellers with the lowest cost
 * (the standard textbook assumption).
 *
 * For every intervention, the deadweight loss is the triangle between the two
 * curves from the traded quantity Q to Q*:
 *   DWL = ½ · (b + d) · (Q* − Q)²
 * which equals TS_free − (CS + PS + G). Both are computed and cross-checked in
 * the test suite.
 */

export type Mode = "none" | "tax" | "subsidy" | "ceiling" | "floor";

export interface MarketParams {
  /** Demand intercept (choke price). */
  a: number;
  /** Demand slope, as a positive number. */
  b: number;
  /** Supply intercept (lowest price any seller accepts). */
  c: number;
  /** Supply slope. */
  d: number;
}

export interface PolicyParams {
  tax: number;
  subsidy: number;
  ceiling: number;
  floor: number;
}

export interface Point {
  q: number;
  p: number;
}

export type Polygon = Point[];

export interface Regions {
  cs: Polygon;
  ps: Polygon;
  /** Tax revenue (tax mode) or subsidy outlay (subsidy mode). */
  govt: Polygon;
  dwl: Polygon;
}

export interface Outcome {
  mode: Mode;
  /** Whether the free market trades a positive quantity at all. */
  hasTrade: boolean;

  /** Free-market equilibrium. NaN when there is no trade. */
  pStar: number;
  qStar: number;
  cs0: number;
  ps0: number;
  ts0: number;

  /** Whether the intervention changes the outcome. */
  binding: boolean;

  /** Quantity that actually changes hands. */
  quantity: number;
  /** Price buyers pay per unit (NaN when nothing trades). */
  buyerPrice: number;
  /** Price sellers keep per unit (NaN when nothing trades). */
  sellerPrice: number;

  /** For price controls: quantities demanded and supplied at the controlled price. */
  qDemanded: number;
  qSupplied: number;
  shortage: number;
  excessSupply: number;

  cs: number;
  ps: number;
  /** Net government budget: tax revenue (positive) or subsidy cost (negative). */
  govt: number;
  /** Total surplus including the government budget. */
  ts: number;
  dwl: number;

  /** Share of a tax (or subsidy) borne by (or received by) buyers, 0–1. NaN if not applicable. */
  buyerShare: number;

  regions: Regions;
}

/* ------------------------------------------------------------------ */
/* Curve helpers                                                       */
/* ------------------------------------------------------------------ */

export const demandPrice = (m: MarketParams, q: number): number => m.a - m.b * q;
export const supplyPrice = (m: MarketParams, q: number): number => m.c + m.d * q;

/** Quantity demanded at price p (never negative). */
export const quantityDemanded = (m: MarketParams, p: number): number => Math.max(0, (m.a - p) / m.b);

/** Quantity supplied at price p (never negative). */
export const quantitySupplied = (m: MarketParams, p: number): number => Math.max(0, (p - m.c) / m.d);

export interface Equilibrium {
  hasTrade: boolean;
  q: number;
  p: number;
  cs: number;
  ps: number;
  ts: number;
}

export function equilibrium(m: MarketParams): Equilibrium {
  const hasTrade = m.a > m.c;
  if (!hasTrade) {
    return { hasTrade, q: 0, p: Number.NaN, cs: 0, ps: 0, ts: 0 };
  }
  const q = (m.a - m.c) / (m.b + m.d);
  const p = m.a - m.b * q;
  const cs = 0.5 * q * (m.a - p);
  const ps = 0.5 * q * (p - m.c);
  return { hasTrade, q, p, cs, ps, ts: cs + ps };
}

/** Area of a polygon (shoelace formula), in price × quantity units. */
export function polygonArea(poly: Polygon): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    sum += p1.q * p2.p - p2.q * p1.p;
  }
  return Math.abs(sum) / 2;
}

/** Deadweight-loss triangle between the curves from quantity q to Q*. */
function dwlTriangle(m: MarketParams, q: number, eq: Equilibrium): Polygon {
  if (Math.abs(eq.q - q) < 1e-9) return [];
  return [
    { q, p: demandPrice(m, q) },
    { q: eq.q, p: eq.p },
    { q, p: supplyPrice(m, q) },
  ];
}

const clampZero = (x: number): number => (x < 0 && x > -1e-9 ? 0 : x);

const EMPTY_REGIONS: Regions = { cs: [], ps: [], govt: [], dwl: [] };

/* ------------------------------------------------------------------ */
/* Outcomes                                                            */
/* ------------------------------------------------------------------ */

function freeMarketOutcome(m: MarketParams, mode: Mode, eq: Equilibrium): Outcome {
  const regions: Regions = eq.hasTrade
    ? {
        cs: [
          { q: 0, p: m.a },
          { q: eq.q, p: eq.p },
          { q: 0, p: eq.p },
        ],
        ps: [
          { q: 0, p: eq.p },
          { q: eq.q, p: eq.p },
          { q: 0, p: m.c },
        ],
        govt: [],
        dwl: [],
      }
    : EMPTY_REGIONS;

  return {
    mode,
    hasTrade: eq.hasTrade,
    pStar: eq.p,
    qStar: eq.q,
    cs0: eq.cs,
    ps0: eq.ps,
    ts0: eq.ts,
    binding: false,
    quantity: eq.q,
    buyerPrice: eq.p,
    sellerPrice: eq.p,
    qDemanded: eq.q,
    qSupplied: eq.q,
    shortage: 0,
    excessSupply: 0,
    cs: eq.cs,
    ps: eq.ps,
    govt: 0,
    ts: eq.ts,
    dwl: 0,
    buyerShare: Number.NaN,
    regions,
  };
}

/**
 * A per-unit wedge between what buyers pay and what sellers keep.
 * t > 0 is a tax, t < 0 is a subsidy of size −t.
 */
function wedgeOutcome(m: MarketParams, t: number, mode: Mode, eq: Equilibrium): Outcome {
  const base = freeMarketOutcome(m, mode, eq);
  if (!eq.hasTrade || t === 0) return base;

  const q = Math.max(0, (m.a - m.c - t) / (m.b + m.d));

  if (q === 0) {
    // The tax exceeds the gap between the choke price and the lowest supply
    // price: nothing trades and all of the free-market surplus is lost.
    return {
      ...base,
      binding: true,
      quantity: 0,
      buyerPrice: Number.NaN,
      sellerPrice: Number.NaN,
      qDemanded: 0,
      qSupplied: 0,
      cs: 0,
      ps: 0,
      govt: 0,
      ts: 0,
      dwl: eq.ts,
      buyerShare: m.b / (m.b + m.d),
      regions: { cs: [], ps: [], govt: [], dwl: dwlTriangle(m, 0, eq) },
    };
  }

  const pb = demandPrice(m, q);
  const ps = pb - t; // equals supplyPrice(m, q)
  const cs = 0.5 * q * (m.a - pb);
  const prod = 0.5 * q * (ps - m.c);
  const govt = t * q;
  const ts = cs + prod + govt;
  const dwl = clampZero(eq.ts - ts);

  const regions: Regions = {
    cs: [
      { q: 0, p: m.a },
      { q, p: pb },
      { q: 0, p: pb },
    ],
    ps: [
      { q: 0, p: ps },
      { q, p: ps },
      { q: 0, p: m.c },
    ],
    govt: [
      { q: 0, p: Math.max(pb, ps) },
      { q, p: Math.max(pb, ps) },
      { q, p: Math.min(pb, ps) },
      { q: 0, p: Math.min(pb, ps) },
    ],
    dwl: dwlTriangle(m, q, eq),
  };

  return {
    ...base,
    binding: true,
    quantity: q,
    buyerPrice: pb,
    sellerPrice: ps,
    qDemanded: q,
    qSupplied: q,
    cs,
    ps: prod,
    govt,
    ts,
    dwl,
    // Share of the wedge that shows up in the buyer price: b / (b + d).
    buyerShare: (pb - eq.p) / t,
    regions,
  };
}

function ceilingOutcome(m: MarketParams, pc: number, eq: Equilibrium): Outcome {
  const base = freeMarketOutcome(m, "ceiling", eq);
  const qd = quantityDemanded(m, pc);
  const qs = quantitySupplied(m, pc);
  if (!eq.hasTrade || pc >= eq.p) {
    return { ...base, qDemanded: qd, qSupplied: qs };
  }

  const q = qs; // sellers are the short side of the market
  const cs = (m.a - pc) * q - 0.5 * m.b * q * q; // trapezoid under demand, above P_c
  const prod = 0.5 * q * (pc - m.c);
  const ts = cs + prod;
  const dwl = clampZero(eq.ts - ts);
  const traded = q > 0;

  return {
    ...base,
    binding: true,
    quantity: q,
    buyerPrice: traded ? pc : Number.NaN,
    sellerPrice: traded ? pc : Number.NaN,
    qDemanded: qd,
    qSupplied: qs,
    shortage: qd - qs,
    cs,
    ps: prod,
    ts,
    dwl,
    regions: {
      cs: traded
        ? [
            { q: 0, p: m.a },
            { q, p: demandPrice(m, q) },
            { q, p: pc },
            { q: 0, p: pc },
          ]
        : [],
      ps: traded
        ? [
            { q: 0, p: pc },
            { q, p: pc },
            { q: 0, p: m.c },
          ]
        : [],
      govt: [],
      dwl: dwlTriangle(m, q, eq),
    },
  };
}

function floorOutcome(m: MarketParams, pf: number, eq: Equilibrium): Outcome {
  const base = freeMarketOutcome(m, "floor", eq);
  const qd = quantityDemanded(m, pf);
  const qs = quantitySupplied(m, pf);
  if (!eq.hasTrade || pf <= eq.p) {
    return { ...base, qDemanded: qd, qSupplied: qs };
  }

  const q = qd; // buyers are the short side of the market
  const cs = 0.5 * q * (m.a - pf);
  const prod = (pf - m.c) * q - 0.5 * m.d * q * q; // trapezoid above supply, below P_f
  const ts = cs + prod;
  const dwl = clampZero(eq.ts - ts);
  const traded = q > 0;

  return {
    ...base,
    binding: true,
    quantity: q,
    buyerPrice: traded ? pf : Number.NaN,
    sellerPrice: traded ? pf : Number.NaN,
    qDemanded: qd,
    qSupplied: qs,
    excessSupply: qs - qd,
    cs,
    ps: prod,
    ts,
    dwl,
    regions: {
      cs: traded
        ? [
            { q: 0, p: m.a },
            { q, p: pf },
            { q: 0, p: pf },
          ]
        : [],
      ps: traded
        ? [
            { q: 0, p: pf },
            { q, p: pf },
            { q, p: supplyPrice(m, q) },
            { q: 0, p: m.c },
          ]
        : [],
      govt: [],
      dwl: dwlTriangle(m, q, eq),
    },
  };
}

export function computeOutcome(m: MarketParams, policy: PolicyParams, mode: Mode): Outcome {
  const eq = equilibrium(m);
  switch (mode) {
    case "tax":
      return wedgeOutcome(m, Math.max(0, policy.tax), "tax", eq);
    case "subsidy":
      return wedgeOutcome(m, -Math.max(0, policy.subsidy), "subsidy", eq);
    case "ceiling":
      return ceilingOutcome(m, policy.ceiling, eq);
    case "floor":
      return floorOutcome(m, policy.floor, eq);
    default:
      return freeMarketOutcome(m, "none", eq);
  }
}
