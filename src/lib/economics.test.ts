/**
 * Verifies the closed-form formulas in economics.ts against
 *   1. hand-worked textbook examples, and
 *   2. direct numerical integration of the curves over a randomized sweep.
 *
 * Run with: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeOutcome,
  demandPrice,
  equilibrium,
  polygonArea,
  supplyPrice,
  type MarketParams,
  type Mode,
  type Outcome,
  type PolicyParams,
} from "./economics.ts";

const close = (actual: number, expected: number, tol = 1e-6, label = "") => {
  const ok = Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected));
  assert.ok(ok, `${label} expected ${expected}, got ${actual}`);
};

/** Midpoint-rule integral of f over [lo, hi]. */
function integrate(f: (q: number) => number, lo: number, hi: number, n = 4000): number {
  if (hi <= lo) return 0;
  const h = (hi - lo) / n;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += f(lo + (i + 0.5) * h);
  return sum * h;
}

const policy = (p: Partial<PolicyParams>): PolicyParams => ({
  tax: 0,
  subsidy: 0,
  ceiling: 0,
  floor: 0,
  ...p,
});

const base: MarketParams = { a: 90, b: 1, c: 10, d: 1 };

/* ------------------------------------------------------------------ */
/* Hand-worked examples                                                */
/* ------------------------------------------------------------------ */

test("free market: P = 90 − Q, P = 10 + Q", () => {
  const o = computeOutcome(base, policy({}), "none");
  close(o.qStar, 40, 1e-12, "Q*");
  close(o.pStar, 50, 1e-12, "P*");
  close(o.cs, 800, 1e-12, "CS"); // ½ · 40 · (90 − 50)
  close(o.ps, 800, 1e-12, "PS"); // ½ · 40 · (50 − 10)
  close(o.ts, 1600, 1e-12, "TS");
  close(o.dwl, 0, 1e-12, "DWL");
});

test("tax of $10 on P = 90 − Q, P = 10 + Q", () => {
  const o = computeOutcome(base, policy({ tax: 10 }), "tax");
  close(o.quantity, 35, 1e-12, "Q_t"); // (90 − 10 − 10) / 2
  close(o.buyerPrice, 55, 1e-12, "P_b");
  close(o.sellerPrice, 45, 1e-12, "P_s");
  close(o.govt, 350, 1e-12, "revenue"); // 10 · 35
  close(o.cs, 612.5, 1e-12, "CS"); // ½ · 35 · 35
  close(o.ps, 612.5, 1e-12, "PS");
  close(o.dwl, 25, 1e-12, "DWL"); // ½ · 10 · 5
  close(o.buyerShare, 0.5, 1e-12, "incidence");
});

test("subsidy of $10 on P = 90 − Q, P = 10 + Q", () => {
  const o = computeOutcome(base, policy({ subsidy: 10 }), "subsidy");
  close(o.quantity, 45, 1e-12, "Q_s");
  close(o.buyerPrice, 45, 1e-12, "P_b");
  close(o.sellerPrice, 55, 1e-12, "P_s");
  close(o.govt, -450, 1e-12, "cost"); // −10 · 45
  close(o.cs, 1012.5, 1e-12, "CS"); // ½ · 45 · 45
  close(o.ps, 1012.5, 1e-12, "PS");
  close(o.dwl, 25, 1e-12, "DWL"); // ½ · 10 · 5
});

test("rent control preset: ceiling $35 on P = 100 − 1.25Q, P = 10 + Q", () => {
  const m = { a: 100, b: 1.25, c: 10, d: 1 };
  const o = computeOutcome(m, policy({ ceiling: 35 }), "ceiling");
  close(o.qStar, 40, 1e-12, "Q*");
  close(o.pStar, 50, 1e-12, "P*");
  close(o.qSupplied, 25, 1e-12, "Q_s");
  close(o.qDemanded, 52, 1e-12, "Q_d");
  close(o.shortage, 27, 1e-12, "shortage");
  close(o.quantity, 25, 1e-12, "Q traded");
  // CS: trapezoid between demand and $35 from 0 to 25 = 25 · (65 + 33.75) / 2
  close(o.cs, 1234.375, 1e-12, "CS");
  close(o.ps, 312.5, 1e-12, "PS"); // ½ · 25 · 25
  close(o.dwl, 253.125, 1e-12, "DWL"); // ½ · 2.25 · 15²
});

test("minimum wage preset: floor $60 on P = 85 − Q, P = 15 + Q", () => {
  const m = { a: 85, b: 1, c: 15, d: 1 };
  const o = computeOutcome(m, policy({ floor: 60 }), "floor");
  close(o.qStar, 35, 1e-12, "Q*");
  close(o.pStar, 50, 1e-12, "P*");
  close(o.qDemanded, 25, 1e-12, "Q_d");
  close(o.qSupplied, 45, 1e-12, "Q_s");
  close(o.excessSupply, 20, 1e-12, "unemployment");
  close(o.cs, 312.5, 1e-12, "CS"); // ½ · 25 · 25
  close(o.ps, 812.5, 1e-12, "PS"); // 25 · (45 + 20) / 2
  close(o.dwl, 100, 1e-12, "DWL"); // ½ · 2 · 10²
});

test("cigarette tax preset: $20 on P = 100 − 2Q, P = 25 + 0.5Q", () => {
  const m = { a: 100, b: 2, c: 25, d: 0.5 };
  const o = computeOutcome(m, policy({ tax: 20 }), "tax");
  close(o.qStar, 30, 1e-12, "Q*");
  close(o.pStar, 40, 1e-12, "P*");
  close(o.quantity, 22, 1e-12, "Q_t");
  close(o.buyerPrice, 56, 1e-12, "P_b");
  close(o.sellerPrice, 36, 1e-12, "P_s");
  close(o.govt, 440, 1e-12, "revenue");
  close(o.dwl, 80, 1e-12, "DWL");
  close(o.buyerShare, 0.8, 1e-12, "buyers bear b/(b+d)");
});

test("non-binding controls leave the market unchanged", () => {
  const free = computeOutcome(base, policy({}), "none");
  for (const [mode, p] of [
    ["ceiling", policy({ ceiling: 60 })],
    ["floor", policy({ floor: 40 })],
    ["tax", policy({ tax: 0 })],
    ["subsidy", policy({ subsidy: 0 })],
  ] as const) {
    const o = computeOutcome(base, p, mode);
    assert.equal(o.binding, false, mode);
    close(o.quantity, free.quantity, 1e-12, `${mode} Q`);
    close(o.cs, free.cs, 1e-12, `${mode} CS`);
    close(o.dwl, 0, 1e-12, `${mode} DWL`);
  }
});

test("extreme policies shut the market down and lose all surplus", () => {
  const tax = computeOutcome(base, policy({ tax: 95 }), "tax");
  close(tax.quantity, 0, 0, "tax Q");
  close(tax.dwl, 1600, 1e-12, "tax DWL");
  close(tax.govt, 0, 0, "tax revenue");

  const ceiling = computeOutcome(base, policy({ ceiling: 5 }), "ceiling");
  close(ceiling.quantity, 0, 0, "ceiling Q");
  close(ceiling.dwl, 1600, 1e-12, "ceiling DWL");
  close(ceiling.shortage, 85, 1e-12, "ceiling shortage");

  const floor = computeOutcome(base, policy({ floor: 95 }), "floor");
  close(floor.quantity, 0, 0, "floor Q");
  close(floor.dwl, 1600, 1e-12, "floor DWL");
});

test("no trade when demand lies entirely below supply", () => {
  const o = computeOutcome({ a: 20, b: 1, c: 30, d: 1 }, policy({}), "none");
  assert.equal(o.hasTrade, false);
  close(o.quantity, 0, 0);
  close(o.ts, 0, 0);
  assert.ok(Number.isNaN(o.pStar));
});

/* ------------------------------------------------------------------ */
/* Randomized cross-check against numerical integration                */
/* ------------------------------------------------------------------ */

/** Small deterministic PRNG so failures are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function checkAgainstIntegrals(m: MarketParams, o: Outcome, label: string) {
  const D = (q: number) => demandPrice(m, q);
  const S = (q: number) => supplyPrice(m, q);
  const eq = equilibrium(m);
  const tol = 1e-6;

  // Free-market benchmark from integrals.
  close(o.ts0, integrate((q) => D(q) - S(q), 0, eq.q), tol, `${label} TS0`);

  const Q = o.quantity;
  if (Q > 0) {
    // Consumer surplus: value to buyers minus what they pay.
    close(o.cs, integrate((q) => D(q) - o.buyerPrice, 0, Q), tol, `${label} CS`);
    // Producer surplus: what sellers keep minus their cost.
    close(o.ps, integrate((q) => o.sellerPrice - S(q), 0, Q), tol, `${label} PS`);
    // Government: wedge times quantity.
    close(o.govt, (o.buyerPrice - o.sellerPrice) * Q, tol, `${label} G`);
  }

  // Deadweight loss: surplus forgone between Q and Q*, from the integral.
  const lo = Math.min(Q, eq.q);
  const hi = Math.max(Q, eq.q);
  const dwlIntegral = integrate((q) => Math.abs(D(q) - S(q)), lo, hi);
  close(o.dwl, dwlIntegral, tol, `${label} DWL integral`);
  close(o.dwl, 0.5 * (m.b + m.d) * (eq.q - Q) ** 2, tol, `${label} DWL closed form`);

  // Accounting identity: nothing is created or destroyed except the DWL.
  close(o.cs + o.ps + o.govt + o.dwl, o.ts0, tol, `${label} identity`);
  close(o.ts, o.cs + o.ps + o.govt, tol, `${label} TS`);

  // The shaded regions drawn on the chart must match the reported numbers.
  close(polygonArea(o.regions.cs), o.cs, tol, `${label} CS region`);
  close(polygonArea(o.regions.ps), o.ps, tol, `${label} PS region`);
  close(polygonArea(o.regions.govt), Math.abs(o.govt), tol, `${label} G region`);
  close(polygonArea(o.regions.dwl), o.dwl, tol, `${label} DWL region`);

  assert.ok(o.cs >= -1e-9 && o.ps >= -1e-9 && o.dwl >= -1e-9, `${label} non-negative`);
}

test("randomized sweep: every mode matches numerical integration", () => {
  const rand = rng(20261123);
  const modes: Mode[] = ["none", "tax", "subsidy", "ceiling", "floor"];
  let checked = 0;

  for (let i = 0; i < 400; i++) {
    const m: MarketParams = {
      a: 20 + rand() * 120,
      b: 0.2 + rand() * 3.8,
      c: rand() * 60,
      d: 0.2 + rand() * 3.8,
    };
    if (m.a <= m.c + 1) continue;
    const eq = equilibrium(m);

    const p: PolicyParams = {
      tax: rand() * 60,
      subsidy: rand() * 30,
      ceiling: rand() * eq.p * 1.4,
      floor: eq.p * (0.6 + rand() * 1.2),
    };

    for (const mode of modes) {
      const o = computeOutcome(m, p, mode);
      checkAgainstIntegrals(m, o, `#${i} ${mode}`);

      if (mode === "tax" && o.quantity > 0) {
        // Buyer price on demand, seller price on supply, wedge equals the tax.
        close(o.buyerPrice, demandPrice(m, o.quantity), 1e-9, "P_b on D");
        close(o.sellerPrice, supplyPrice(m, o.quantity), 1e-9, "P_s on S");
        close(o.buyerPrice - o.sellerPrice, p.tax, 1e-9, "wedge");
        close(o.buyerShare, m.b / (m.b + m.d), 1e-9, "incidence");
        close(o.buyerPrice - eq.p + (eq.p - o.sellerPrice), p.tax, 1e-9, "burden sums to t");
      }
      if (mode === "subsidy" && p.subsidy > 0) {
        close(o.sellerPrice - o.buyerPrice, p.subsidy, 1e-9, "subsidy wedge");
        assert.ok(o.quantity > eq.q, "subsidy raises quantity");
      }
      if (mode === "ceiling" && o.binding) {
        close(o.shortage, Math.max(0, (m.a - p.ceiling) / m.b) - Math.max(0, (p.ceiling - m.c) / m.d), 1e-9, "shortage");
        assert.ok(o.quantity <= eq.q + 1e-9, "ceiling reduces trade");
      }
      if (mode === "floor" && o.binding) {
        close(o.excessSupply, Math.max(0, (p.floor - m.c) / m.d) - Math.max(0, (m.a - p.floor) / m.b), 1e-9, "excess");
        assert.ok(o.quantity <= eq.q + 1e-9, "floor reduces trade");
      }
      checked++;
    }
  }
  assert.ok(checked > 1500, `checked ${checked} cases`);
});
