"use client";

import { useCallback, useMemo, useReducer, useSyncExternalStore } from "react";
import { computeOutcome, equilibrium, type MarketParams, type Mode, type PolicyParams } from "@/lib/economics";
import { explain, type Change, type ChangeKind } from "@/lib/explain";
import { CONTEXTS, PRESET_BY_ID, PRESETS, snapTo, type ContextId, type PresetId } from "@/lib/presets";
import { useTween } from "@/hooks/useTween";
import { useViewportHeight } from "@/hooks/useElementSize";
import { CHART_COLORS as C, SupplyDemandChart, type DragKey } from "./SupplyDemandChart";
import { Controls } from "./Controls";
import { StatsPanel, Summary, Swatch } from "./StatsPanel";
import { LogoMark } from "./Logo";

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

interface State {
  market: MarketParams;
  policy: PolicyParams;
  mode: Mode;
  contextId: ContextId;
  presetId: PresetId;
  change: Change;
}

type Action =
  | { type: "market"; kind: ChangeKind; patch: Partial<MarketParams> }
  | { type: "policy"; patch: Partial<PolicyParams> }
  | { type: "mode"; mode: Mode; patch: Partial<PolicyParams> }
  | { type: "preset"; id: PresetId; kind: "preset" | "reset" };

function fromPreset(id: PresetId, kind: ChangeKind): State {
  const p = PRESET_BY_ID[id];
  return {
    market: { ...p.market },
    policy: { ...p.policy },
    mode: p.mode,
    contextId: p.contextId,
    presetId: p.id,
    change: { kind, from: { ...p.market } },
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "market": {
      // Consecutive edits of the same kind (one drag, one slider gesture) are
      // grouped so the explanation compares against where the gesture started.
      const change = state.change.kind === action.kind ? state.change : { kind: action.kind, from: state.market };
      return { ...state, market: { ...state.market, ...action.patch }, change };
    }
    case "policy":
      return { ...state, policy: { ...state.policy, ...action.patch }, change: { kind: "policy", from: state.market } };
    case "mode":
      return {
        ...state,
        mode: action.mode,
        policy: { ...state.policy, ...action.patch },
        change: { kind: "mode", from: state.market },
      };
    case "preset":
      return fromPreset(action.id, action.kind);
  }
}

const MODES: { id: Mode; label: string }[] = [
  { id: "none", label: "None" },
  { id: "tax", label: "Tax" },
  { id: "subsidy", label: "Subsidy" },
  { id: "ceiling", label: "Ceiling" },
  { id: "floor", label: "Floor" },
];

const DESKTOP_QUERY = "(min-width: 1024px)";
function subscribeDesktop(cb: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}
function useIsDesktop() {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function Simulator() {
  const [state, dispatch] = useReducer(reducer, undefined, () => fromPreset("free", "initial"));
  const { market, policy, mode } = state;
  const ctx = CONTEXTS[state.contextId];

  // Everything drawn is derived from eased values so the curves glide.
  const target = useMemo(
    () => ({
      a: market.a,
      b: market.b,
      c: market.c,
      d: market.d,
      tax: mode === "tax" ? policy.tax : 0,
      subsidy: mode === "subsidy" ? policy.subsidy : 0,
      ceiling: policy.ceiling,
      floor: policy.floor,
    }),
    [market.a, market.b, market.c, market.d, policy.tax, policy.subsidy, policy.ceiling, policy.floor, mode],
  );
  const [shown, snap] = useTween(target);

  const shownMarket: MarketParams = { a: shown.a, b: shown.b, c: shown.c, d: shown.d };
  const shownPolicy: PolicyParams = {
    tax: shown.tax,
    subsidy: shown.subsidy,
    ceiling: shown.ceiling,
    floor: shown.floor,
  };
  const shownOutcome = computeOutcome(shownMarket, shownPolicy, mode);

  // The sentence describes where the market is heading, not the in-between frames.
  const finalOutcome = useMemo(() => computeOutcome(market, policy, mode), [market, policy, mode]);
  const sentence = useMemo(
    () => explain(market, policy, mode, finalOutcome, ctx, state.change),
    [market, policy, mode, finalOutcome, ctx, state.change],
  );

  const isDesktop = useIsDesktop();
  const vh = useViewportHeight();
  const chartMaxHeight = isDesktop ? 560 : Math.max(250, Math.round(vh * 0.42));

  /* ---------------------------- handlers --------------------------- */

  const onChartChange = useCallback(
    (key: DragKey, raw: number) => {
      const v = snapTo(key, raw);
      snap({ [key]: v });
      if (key === "a") dispatch({ type: "market", kind: "demand-shift", patch: { a: v } });
      else if (key === "c") dispatch({ type: "market", kind: "supply-shift", patch: { c: v } });
      else dispatch({ type: "policy", patch: { [key]: v } });
    },
    [snap],
  );

  const onMarket = useCallback((key: keyof MarketParams, value: number) => {
    const kind: ChangeKind =
      key === "a" ? "demand-shift" : key === "b" ? "demand-slope" : key === "c" ? "supply-shift" : "supply-slope";
    dispatch({ type: "market", kind, patch: { [key]: snapTo(key, value) } });
  }, []);

  const onPolicy = useCallback((key: keyof PolicyParams, value: number) => {
    dispatch({ type: "policy", patch: { [key]: snapTo(key, value) } });
  }, []);

  const setMode = (next: Mode) => {
    if (next === mode) return;
    const eq = equilibrium(market);
    const patch: Partial<PolicyParams> = {};
    if (next === "tax" && policy.tax <= 0) patch.tax = 10;
    if (next === "subsidy" && policy.subsidy <= 0) patch.subsidy = 10;
    if (eq.hasTrade && next === "ceiling") {
      if (policy.ceiling >= eq.p) patch.ceiling = snapTo("ceiling", eq.p - 10);
      snap({ ceiling: eq.p }); // the line slides down from the equilibrium price
    }
    if (eq.hasTrade && next === "floor") {
      if (policy.floor <= eq.p) patch.floor = snapTo("floor", eq.p + 10);
      snap({ floor: eq.p });
    }
    dispatch({ type: "mode", mode: next, patch });
  };

  const applyPreset = (id: PresetId) => dispatch({ type: "preset", id, kind: id === state.presetId ? "reset" : "preset" });

  const preset = PRESET_BY_ID[state.presetId];
  const modeIndex = MODES.findIndex((m) => m.id === mode);

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <LogoMark size={26} />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Equilibria</span>
            <span className="hidden text-[13px] text-ink-3 sm:inline">Supply and demand simulator</span>
          </div>
          <button
            type="button"
            onClick={() => applyPreset(state.presetId)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-[#CFD6E3] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M2.5 8a5.5 5.5 0 1 0 1.7-3.97" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M2.5 2.5v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Reset
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 pb-16 pt-5 sm:px-6 lg:pt-8">
        <section aria-labelledby="scenario-title" className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <h1 id="scenario-title" className="text-[20px] font-semibold tracking-[-0.015em] text-ink sm:text-[22px]">
              {preset.id === "free" ? "How markets find a price" : preset.label}
            </h1>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2 text-pretty">{preset.summary}</p>
          </div>
          <div role="group" aria-label="Scenario presets" className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
            {PRESETS.map((p) => {
              const on = p.id === state.presetId;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => applyPreset(p.id)}
                  className={`h-9 rounded-md border px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    on
                      ? "border-navy bg-navy text-white"
                      : "border-line bg-white text-ink-2 hover:border-[#CFD6E3] hover:text-ink"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </section>

        <div className="mt-5 flex flex-col gap-4 lg:mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_368px] lg:items-start lg:gap-6">
          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
            {/* Chart */}
            <div className="chart-sticky order-1">
              <section aria-label="Chart" className="rounded-xl border border-line bg-white">
                <div className="flex flex-col gap-2 border-b border-line p-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-3">
                  <div
                    role="radiogroup"
                    aria-label="Intervention"
                    className="relative grid grid-cols-5 rounded-lg bg-subtle p-[3px] sm:w-[400px]"
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                      e.preventDefault();
                      const next = MODES[(modeIndex + (e.key === "ArrowRight" ? 1 : MODES.length - 1)) % MODES.length];
                      setMode(next.id);
                      (e.currentTarget.querySelector(`[data-mode="${next.id}"]`) as HTMLElement | null)?.focus();
                    }}
                  >
                    <span
                      aria-hidden
                      className="mode-indicator absolute bottom-[3px] left-[3px] top-[3px] rounded-md bg-white shadow-[0_1px_2px_rgba(10,26,58,0.08),0_0_0_1px_rgba(10,26,58,0.06)]"
                      style={{ width: "calc((100% - 6px) / 5)", transform: `translateX(${modeIndex * 100}%)` }}
                    />
                    {MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        data-mode={m.id}
                        aria-checked={mode === m.id}
                        tabIndex={mode === m.id ? 0 : -1}
                        onClick={() => setMode(m.id)}
                        className={`relative z-10 h-8 rounded-md text-[12px] font-medium min-[360px]:text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
                          mode === m.id ? "text-ink" : "text-ink-2 hover:text-ink"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <p className="hidden whitespace-nowrap pr-1 text-[12px] text-ink-3 sm:block">Drag any curve to move it</p>
                </div>
                <div className="px-1.5 pt-3 sm:px-3">
                  <SupplyDemandChart
                    market={shownMarket}
                    policy={shownPolicy}
                    mode={mode}
                    outcome={shownOutcome}
                    ctx={ctx}
                    maxHeight={chartMaxHeight}
                    onChange={onChartChange}
                  />
                </div>
                <Legend mode={mode} ceilingName={ctx.ceilingName} floorName={ctx.floorName} />
              </section>
            </div>

            <div className="order-3">
              <Controls market={market} policy={policy} mode={mode} ctx={ctx} onMarket={onMarket} onPolicy={onPolicy} />
            </div>
          </div>

          <div className="contents lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-4">
            <div className="order-2">
              <Summary sentence={sentence} />
            </div>
            <div className="order-4">
              <StatsPanel o={shownOutcome} mode={mode} ctx={ctx} />
            </div>
          </div>
        </div>

        <footer className="mt-10 border-t border-line pt-5 text-[12px] leading-relaxed text-ink-3">
          Linear demand P = a {"−"} bQ and supply P = c + dQ. Surplus and deadweight loss are areas on the chart,
          measured in dollars. Under price controls, the units that trade are assumed to go to the buyers who value them
          most.
        </footer>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Legend                                                              */
/* ------------------------------------------------------------------ */

function Label({ short, long }: { short: string; long: string }) {
  return (
    <>
      <span className="sm:hidden" aria-hidden>
        {short}
      </span>
      <span className="sr-only sm:not-sr-only">{long}</span>
    </>
  );
}

function LineKey({ color, dashed, short, long }: { color: string; dashed?: boolean; short: string; long: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-4" style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }} aria-hidden />
      <Label short={short} long={long} />
    </span>
  );
}

function AreaKey({ kind, short, long }: { kind: Parameters<typeof Swatch>[0]["kind"]; short: string; long: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Swatch kind={kind} />
      <Label short={short} long={long} />
    </span>
  );
}

function Legend({ mode, ceilingName, floorName }: { mode: Mode; ceilingName: string; floorName: string }) {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-3 pb-3 pt-1 text-[12px] text-ink-2 sm:gap-x-4 sm:px-4">
      <LineKey color={C.demand} short="Demand" long="Demand" />
      <LineKey color={C.supply} short="Supply" long="Supply" />
      {mode === "tax" && <LineKey color={C.supply} dashed short="S + tax" long="Supply + tax" />}
      {mode === "subsidy" && <LineKey color={C.supply} dashed short={"S − subsidy"} long={"Supply − subsidy"} />}
      {mode === "ceiling" && <LineKey color={C.policy} short="Ceiling" long={cap(ceilingName)} />}
      {mode === "floor" && <LineKey color={C.policy} short="Floor" long={cap(floorName)} />}
      <AreaKey kind="cs" short="CS" long="Consumer surplus (CS)" />
      <AreaKey kind="ps" short="PS" long="Producer surplus (PS)" />
      {mode === "tax" && <AreaKey kind="govt" short="Revenue" long="Tax revenue" />}
      {mode === "subsidy" && <AreaKey kind="govt-outline" short="Cost" long="Subsidy cost" />}
      {mode !== "none" && <AreaKey kind="dwl" short="DWL" long="Deadweight loss (DWL)" />}
    </div>
  );
}
