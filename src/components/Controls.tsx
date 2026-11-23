"use client";

import type { MarketParams, Mode, PolicyParams } from "@/lib/economics";
import { fixed, minus, money } from "@/lib/format";
import { LIMITS, type MarketContext } from "@/lib/presets";
import { Slider } from "./Slider";
import { CHART_COLORS } from "./SupplyDemandChart";

interface ControlsProps {
  market: MarketParams;
  policy: PolicyParams;
  mode: Mode;
  ctx: MarketContext;
  onMarket: (key: keyof MarketParams, value: number) => void;
  onPolicy: (key: keyof PolicyParams, value: number) => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Equation({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-subtle px-2 py-0.5 text-[12px] font-medium tabular-nums text-ink-2">{children}</span>;
}

function Group({
  title,
  aside,
  swatch,
  dashed,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  swatch: string;
  dashed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-3.5"
            style={{ borderTop: `2.5px ${dashed ? "dashed" : "solid"} ${swatch}` }}
            aria-hidden
          />
          <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        </div>
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

export function Controls({ market, policy, mode, ctx, onMarket, onPolicy }: ControlsProps) {
  const taxedIntercept = market.c + (mode === "tax" ? policy.tax : mode === "subsidy" ? -policy.subsidy : 0);

  const policyControl = (() => {
    switch (mode) {
      case "tax":
        return (
          <Group
            title="Per-unit tax"
            swatch={CHART_COLORS.supply}
            dashed
            aside={
              <Equation>
                S + tax: P = {fixed(taxedIntercept, 1)} + {fixed(market.d, 2)}Q
              </Equation>
            }
          >
            <Slider
              id="tax"
              label="Tax per unit"
              hint="paid by sellers"
              value={policy.tax}
              {...LIMITS.tax}
              format={(v) => money(v)}
              onChange={(v) => onPolicy("tax", v)}
            />
          </Group>
        );
      case "subsidy":
        return (
          <Group
            title="Per-unit subsidy"
            swatch={CHART_COLORS.supply}
            dashed
            aside={
              <Equation>
                S {minus} subsidy: P = {fixed(taxedIntercept, 1)} + {fixed(market.d, 2)}Q
              </Equation>
            }
          >
            <Slider
              id="subsidy"
              label="Subsidy per unit"
              hint="paid to sellers"
              value={policy.subsidy}
              {...LIMITS.subsidy}
              format={(v) => money(v)}
              onChange={(v) => onPolicy("subsidy", v)}
            />
          </Group>
        );
      case "ceiling":
        return (
          <Group title={cap(ctx.ceilingName)} swatch={CHART_COLORS.policy}>
            <Slider
              id="ceiling"
              label={`Maximum legal ${ctx.priceWord}`}
              value={policy.ceiling}
              {...LIMITS.ceiling}
              color={CHART_COLORS.policy}
              format={(v) => money(v)}
              onChange={(v) => onPolicy("ceiling", v)}
            />
          </Group>
        );
      case "floor":
        return (
          <Group title={cap(ctx.floorName)} swatch={CHART_COLORS.policy}>
            <Slider
              id="floor"
              label={`Minimum legal ${ctx.priceWord}`}
              value={policy.floor}
              {...LIMITS.floor}
              color={CHART_COLORS.policy}
              format={(v) => money(v)}
              onChange={(v) => onPolicy("floor", v)}
            />
          </Group>
        );
      default:
        return null;
    }
  })();

  return (
    <section aria-label="Curve and policy controls" className="rounded-xl border border-line bg-white">
      {policyControl && <div className="border-b border-line p-4 sm:p-5">{policyControl}</div>}
      <div className="grid gap-6 p-4 sm:grid-cols-2 sm:gap-8 sm:p-5">
        <Group
          title="Demand"
          swatch={CHART_COLORS.demand}
          aside={
            <Equation>
              P = {fixed(market.a, 1)} {minus} {fixed(market.b, 2)}Q
            </Equation>
          }
        >
          <Slider
            id="demand-a"
            label="Intercept"
            hint="a"
            value={market.a}
            {...LIMITS.a}
            color={CHART_COLORS.demand}
            format={(v) => money(v)}
            onChange={(v) => onMarket("a", v)}
          />
          <Slider
            id="demand-b"
            label="Slope"
            hint="b"
            value={market.b}
            {...LIMITS.b}
            color={CHART_COLORS.demand}
            format={(v) => fixed(v, 2)}
            onChange={(v) => onMarket("b", v)}
          />
        </Group>
        <Group
          title="Supply"
          swatch={CHART_COLORS.supply}
          aside={
            <Equation>
              P = {fixed(market.c, 1)} + {fixed(market.d, 2)}Q
            </Equation>
          }
        >
          <Slider
            id="supply-c"
            label="Intercept"
            hint="c"
            value={market.c}
            {...LIMITS.c}
            format={(v) => money(v)}
            onChange={(v) => onMarket("c", v)}
          />
          <Slider
            id="supply-d"
            label="Slope"
            hint="d"
            value={market.d}
            {...LIMITS.d}
            format={(v) => fixed(v, 2)}
            onChange={(v) => onMarket("d", v)}
          />
        </Group>
      </div>
    </section>
  );
}
