"use client";

import { useId } from "react";
import type { Mode, Outcome } from "@/lib/economics";
import { area, deltaArea, deltaQty, money, percent, qty } from "@/lib/format";
import type { MarketContext } from "@/lib/presets";
import { CHART_COLORS as C } from "./SupplyDemandChart";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type SwatchKind = "cs" | "ps" | "govt" | "govt-outline" | "dwl";

export function Swatch({ kind }: { kind: SwatchKind }) {
  const color = kind === "cs" ? C.cs : kind === "ps" ? C.ps : kind === "dwl" ? C.dwl : C.govt;
  const opacity = kind === "cs" ? 0.3 : kind === "ps" ? 0.34 : kind === "govt" ? 0.42 : kind === "dwl" ? 0.24 : 0;
  const hatch = kind === "dwl";
  const pid = `sw-${kind}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className="shrink-0" aria-hidden>
      {hatch && (
        <defs>
          <pattern id={pid} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform={`rotate(${kind === "dwl" ? 45 : -45})`}>
            <line x1="0" y1="0" x2="0" y2="4" stroke={color} strokeWidth="1.5" strokeOpacity="0.8" />
          </pattern>
        </defs>
      )}
      <rect x="0.5" y="0.5" width="11" height="11" rx="2.5" fill={color} fillOpacity={opacity} />
      {hatch && <rect x="0.5" y="0.5" width="11" height="11" rx="2.5" fill={`url(#${pid})`} />}
      {kind === "govt-outline" && (
        <rect x="1" y="1" width="10" height="10" rx="2" fill="none" stroke="#C98500" strokeWidth="1.5" strokeDasharray="2.5 1.5" />
      )}
    </svg>
  );
}

function Delta({ value }: { value: string | null }) {
  return (
    <span className="w-16 shrink-0 text-right text-[12px] tabular-nums text-ink-3">{value ?? ""}</span>
  );
}

function Row({
  label,
  sub,
  value,
  delta,
  swatch,
  strong,
  showDelta,
}: {
  label: string;
  sub?: string;
  value: string;
  delta?: string | null;
  swatch?: SwatchKind;
  strong?: boolean;
  showDelta: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <span className="flex w-3 shrink-0 justify-center">{swatch && <Swatch kind={swatch} />}</span>
      <span className={`min-w-0 flex-1 text-[13px] ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>
        {label}
        {sub && <span className="ml-1 text-ink-3">({sub})</span>}
      </span>
      <span className={`text-[14px] tabular-nums text-ink ${strong ? "font-semibold" : "font-medium"}`}>{value}</span>
      {showDelta && <Delta value={delta ?? null} />}
    </div>
  );
}

function Tile({ label, symbol, value, muted }: { label: string; symbol: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-ink-3">{label}</span>
        <span className="text-[12px] font-medium text-ink-3">{symbol}</span>
      </div>
      <div className={`mt-0.5 text-[22px] font-semibold leading-tight tracking-[-0.01em] tabular-nums ${muted ? "text-ink-2" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1 text-[12px] font-medium text-ink-3">{children}</h3>;
}

export function Summary({ sentence }: { sentence: string }) {
  return (
    <section aria-labelledby="summary-title" className="rounded-xl border border-line bg-white p-4 sm:p-5">
      <h2 id="summary-title" className="text-[12px] font-medium text-ink-3">
        What happened
      </h2>
      <p aria-live="polite" className="mt-1.5 text-[15px] leading-[1.55] text-ink text-pretty">
        {sentence}
      </p>
    </section>
  );
}

export function StatsPanel({ o, mode, ctx }: { o: Outcome; mode: Mode; ctx: MarketContext }) {
  const policyActive = mode !== "none";
  const showDelta = policyActive && o.binding;
  const wedge = mode === "tax" || mode === "subsidy";
  const control = mode === "ceiling" || mode === "floor";
  const traded = o.quantity > 0;
  const policyName =
    mode === "tax" ? "tax" : mode === "subsidy" ? "subsidy" : mode === "ceiling" ? ctx.ceilingName : ctx.floorName;

  return (
    <section aria-label="Market numbers" className="rounded-xl border border-line bg-white p-4 sm:p-5">
      <SectionLabel>Free-market equilibrium</SectionLabel>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <Tile label={cap(ctx.priceWord)} symbol="P*" value={money(o.pStar)} muted={showDelta} />
        <Tile label="Quantity" symbol="Q*" value={qty(o.qStar)} muted={showDelta} />
      </div>

      {policyActive && o.hasTrade && (
        <div className="mt-5">
          <SectionLabel>With the {policyName}</SectionLabel>
          <div className="divide-y divide-line/70">
            {wedge && (
              <>
                <Row
                  label={`${cap(ctx.buyers)} pay`}
                  value={traded ? money(o.buyerPrice) : "—"}
                  delta={traded ? signedMoney(o.buyerPrice - o.pStar) : null}
                  showDelta={showDelta}
                />
                <Row
                  label={`${cap(ctx.sellers)} keep`}
                  value={traded ? money(o.sellerPrice) : "—"}
                  delta={traded ? signedMoney(o.sellerPrice - o.pStar) : null}
                  showDelta={showDelta}
                />
              </>
            )}
            {control && (
              <Row
                label={cap(ctx.priceWord)}
                value={money(o.binding ? o.buyerPrice : o.pStar)}
                delta={o.binding && traded ? signedMoney(o.buyerPrice - o.pStar) : null}
                showDelta={showDelta}
              />
            )}
            <Row label="Quantity traded" value={qty(o.quantity)} delta={deltaQty(o.quantity - o.qStar)} showDelta={showDelta} />
            {control && o.binding && (
              <>
                <Row label="Quantity demanded" value={qty(o.qDemanded)} showDelta={showDelta} />
                <Row label="Quantity supplied" value={qty(o.qSupplied)} showDelta={showDelta} />
                <Row
                  label={mode === "ceiling" ? ctx.shortageLabel : ctx.excessLabel}
                  value={qty(mode === "ceiling" ? o.shortage : o.excessSupply)}
                  strong
                  showDelta={showDelta}
                />
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-5">
        <SectionLabel>Welfare</SectionLabel>
        <div className="divide-y divide-line/70">
          <Row
            swatch="cs"
            label="Consumer surplus"
            sub={ctx.id === "generic" ? undefined : ctx.buyers}
            value={area(o.cs)}
            delta={deltaArea(o.cs - o.cs0)}
            showDelta={showDelta}
          />
          <Row
            swatch="ps"
            label="Producer surplus"
            sub={ctx.id === "generic" ? undefined : ctx.sellers}
            value={area(o.ps)}
            delta={deltaArea(o.ps - o.ps0)}
            showDelta={showDelta}
          />
          {mode === "subsidy" ? (
            <Row swatch="govt-outline" label="Subsidy cost" value={area(-o.govt)} showDelta={showDelta} />
          ) : (
            <Row swatch="govt" label="Tax revenue" value={area(o.govt)} showDelta={showDelta} />
          )}
          <Row label="Total surplus" value={area(o.ts)} delta={deltaArea(o.ts - o.ts0)} strong showDelta={showDelta} />
          <Row swatch="dwl" label="Deadweight loss" value={area(o.dwl)} strong showDelta={showDelta} />
        </div>
      </div>

      {wedge && o.binding && traded && Number.isFinite(o.buyerShare) && (
        <Incidence o={o} mode={mode} ctx={ctx} />
      )}
    </section>
  );
}

function signedMoney(x: number): string | null {
  const r = Math.round(x * 100) / 100;
  if (r === 0) return null;
  return `${r > 0 ? "+" : "−"}${money(Math.abs(r))}`;
}

function Incidence({ o, mode, ctx }: { o: Outcome; mode: Mode; ctx: MarketContext }) {
  const share = Math.min(1, Math.max(0, o.buyerShare));
  const buyerAmt = Math.abs(o.buyerPrice - o.pStar);
  const sellerAmt = Math.abs(o.sellerPrice - o.pStar);
  return (
    <div className="mt-5">
      <SectionLabel>{mode === "tax" ? "Who bears the tax" : "Who gains from the subsidy"}</SectionLabel>
      <div className="mt-2 flex h-2 gap-[2px] overflow-hidden rounded-full" aria-hidden>
        <div className="h-full rounded-l-full" style={{ width: `${share * 100}%`, background: C.demand }} />
        <div className="h-full flex-1 rounded-r-full" style={{ background: C.supply }} />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-[12px] tabular-nums">
        <span className="text-ink-2">
          <span className="font-medium text-ink">{cap(ctx.buyers)}</span> {money(buyerAmt)} ({percent(share)})
        </span>
        <span className="text-right text-ink-2">
          <span className="font-medium text-ink">{cap(ctx.sellers)}</span> {money(sellerAmt)} ({percent(1 - share)})
        </span>
      </div>
    </div>
  );
}
