import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOutcome, type MarketParams, type Mode, type PolicyParams } from "./economics.ts";
import { explain, type Change } from "./explain.ts";
import { CONTEXTS, PRESETS } from "./presets.ts";

const generic = CONTEXTS.generic;
const base: MarketParams = { a: 90, b: 1, c: 10, d: 1 };
const policy: PolicyParams = { tax: 10, subsidy: 10, ceiling: 40, floor: 60 };
const initial: Change = { kind: "initial", from: base };

const say = (m: MarketParams, mode: Mode, p: PolicyParams = policy, change: Change = initial, ctx = generic) =>
  explain(m, p, mode, computeOutcome(m, p, mode), ctx, change);

test("free market sentence", () => {
  assert.equal(
    say(base, "none"),
    "With no intervention, the market clears at a price of $50.00 with 40 units traded, so all $1,600 of potential surplus is realized.",
  );
});

test("tax sentence matches the worked example", () => {
  assert.equal(
    say(base, "tax"),
    "The $10.00 tax raised the price buyers pay to $55.00, cut the price sellers keep to $45.00, and reduced trade by 5 units.",
  );
});

test("subsidy sentence", () => {
  assert.equal(
    say(base, "subsidy"),
    "The $10.00 subsidy cut the price buyers pay to $45.00, raised the price sellers receive to $55.00, and increased trade by 5 units at a cost of $450.",
  );
});

test("ceiling and floor sentences", () => {
  assert.equal(
    say(base, "ceiling"),
    "The $40.00 price ceiling holds the price below its $50.00 equilibrium, so buyers want 50 units but sellers offer only 30, a shortage of 20 units.",
  );
  assert.equal(
    say(base, "floor"),
    "The $60.00 price floor holds the price above its $50.00 equilibrium, so sellers offer 50 units but buyers want only 30, a surplus of 20 units.",
  );
  assert.match(say(base, "ceiling", { ...policy, ceiling: 70 }), /does not bind/);
  assert.match(say(base, "floor", { ...policy, floor: 30 }), /does not bind/);
});

test("demand and supply shifts describe the direction of change", () => {
  const up = { ...base, a: 100 };
  assert.equal(
    say(up, "none", policy, { kind: "demand-shift", from: base }),
    "Demand increased, so the equilibrium price rose to $55.00 and trade rose to 45 units.",
  );
  const moreSupply = { ...base, c: 0 };
  assert.equal(
    say(moreSupply, "none", policy, { kind: "supply-shift", from: base }),
    "Supply increased, so the equilibrium price fell to $45.00 and trade rose to 45 units.",
  );
});

test("every preset produces a single sentence", () => {
  for (const preset of PRESETS) {
    const ctx = CONTEXTS[preset.contextId];
    const s = say(preset.market, preset.mode, preset.policy, { kind: "preset", from: preset.market }, ctx);
    assert.ok(s.endsWith("."), s);
    assert.equal(s.split(". ").length, 1, `one sentence: ${s}`);
    assert.ok(!s.includes("NaN") && !s.includes("undefined"), s);
  }
});
