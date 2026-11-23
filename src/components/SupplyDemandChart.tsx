"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { MarketParams, Mode, Outcome, PolicyParams, Polygon } from "@/lib/economics";
import { demandPrice, supplyPrice } from "@/lib/economics";
import { money, qty } from "@/lib/format";
import { LIMITS, P_MAX, Q_MAX, type MarketContext } from "@/lib/presets";
import { useElementWidth } from "@/hooks/useElementSize";

export type DragKey = "a" | "c" | "tax" | "subsidy" | "ceiling" | "floor";

export const CHART_COLORS = {
  demand: "#2563EB",
  supply: "#142A66",
  policy: "#0A1A3A",
  cs: "#2A78D6",
  ps: "#1BAF7A",
  govt: "#EDA100",
  dwl: "#E34948",
  grid: "#EEF1F7",
  axis: "#C9D1DF",
  tick: "#7A87A3",
  ink: "#0A1A3A",
  guide: "#98A3BA",
} as const;

const C = CHART_COLORS;
const TICKS = [0, 20, 40, 60, 80, 100];

interface Props {
  market: MarketParams;
  policy: PolicyParams;
  mode: Mode;
  outcome: Outcome;
  ctx: MarketContext;
  maxHeight: number;
  onChange: (key: DragKey, value: number) => void;
}

interface DragState {
  key: DragKey;
  pointerId: number;
  q0: number;
  p0: number;
  v0: number;
}

interface Pill {
  id: string;
  pos: number;
  text: string;
  fill: string;
  textFill: string;
  stroke?: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Spread label positions apart so they never overlap, keeping them within [lo, hi]. */
function spread<T extends { pos: number }>(items: T[], gap: number, lo: number, hi: number): T[] {
  const s = items.map((i) => ({ ...i })).sort((a, b) => a.pos - b.pos);
  for (let i = 1; i < s.length; i++) if (s[i].pos < s[i - 1].pos + gap) s[i].pos = s[i - 1].pos + gap;
  if (s.length && s[s.length - 1].pos > hi) {
    s[s.length - 1].pos = hi;
    for (let i = s.length - 2; i >= 0; i--) if (s[i].pos > s[i + 1].pos - gap) s[i].pos = s[i + 1].pos - gap;
  }
  if (s.length && s[0].pos < lo) {
    s[0].pos = lo;
    for (let i = 1; i < s.length; i++) if (s[i].pos < s[i - 1].pos + gap) s[i].pos = s[i - 1].pos + gap;
  }
  return s;
}

/** Visible part of the line P = p0 + slope·Q inside the chart box, as a Q interval. */
function visibleRange(p0: number, slope: number): [number, number] | null {
  let lo = 0;
  let hi = Q_MAX;
  if (slope === 0) {
    if (p0 < 0 || p0 > P_MAX) return null;
  } else {
    const qa = (0 - p0) / slope;
    const qb = (P_MAX - p0) / slope;
    lo = Math.max(lo, Math.min(qa, qb));
    hi = Math.min(hi, Math.max(qa, qb));
  }
  return hi > lo ? [lo, hi] : null;
}

function textWidth(text: string, size: number): number {
  return text.length * size * 0.58;
}

export function SupplyDemandChart({ market, policy, mode, outcome: o, ctx, maxHeight, onChange }: Props) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const drag = useRef<DragState | null>(null);
  const [active, setActive] = useState<DragKey | null>(null);
  const [focused, setFocused] = useState<DragKey | null>(null);
  const [hoverQ, setHoverQ] = useState<number | null>(null);

  // iOS Safari does not reliably honor `touch-action` on SVG children, so stop
  // the page from scrolling when a touch starts on a draggable curve. React's
  // touch listeners are passive, hence the native listener.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onTouchStart = (e: TouchEvent) => {
      if ((e.target as Element | null)?.closest?.(".chart-drag")) e.preventDefault();
    };
    svg.addEventListener("touchstart", onTouchStart, { passive: false });
    return () => svg.removeEventListener("touchstart", onTouchStart);
  }, [width]);

  const compact = width > 0 && width < 560;
  const height = width ? Math.round(Math.min(maxHeight, Math.max(250, width * (compact ? 0.86 : 0.64)))) : 0;
  const M = compact ? { top: 28, right: 12, bottom: 36, left: 48 } : { top: 34, right: 22, bottom: 44, left: 58 };
  const iw = Math.max(1, width - M.left - M.right);
  const ih = Math.max(1, height - M.top - M.bottom);
  const x = (q: number) => M.left + (q / Q_MAX) * iw;
  const y = (p: number) => M.top + (1 - p / P_MAX) * ih;
  const fs = compact ? 10.5 : 11.5;

  const values: Record<DragKey, number> = {
    a: market.a,
    c: market.c,
    tax: policy.tax,
    subsidy: policy.subsidy,
    ceiling: policy.ceiling,
    floor: policy.floor,
  };

  /* -------------------------- interaction -------------------------- */

  const toData = (clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { q: 0, p: 0 };
    return {
      q: ((clientX - r.left - M.left) / iw) * Q_MAX,
      p: (1 - (clientY - r.top - M.top) / ih) * P_MAX,
    };
  };

  const startDrag = (e: PointerEvent<SVGGElement>, key: DragKey) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = toData(e.clientX, e.clientY);
    drag.current = { key, pointerId: e.pointerId, q0: pt.q, p0: pt.p, v0: values[key] };
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(key);
    setHoverQ(null);
  };

  const moveDrag = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const pt = toData(e.clientX, e.clientY);
    const dq = pt.q - d.q0;
    const dp = pt.p - d.p0;
    // A parallel shift that keeps the grabbed point under the pointer.
    let v = d.v0;
    switch (d.key) {
      case "a":
        v = d.v0 + dp + market.b * dq;
        break;
      case "c":
      case "tax":
        v = d.v0 + dp - market.d * dq;
        break;
      case "subsidy":
        v = d.v0 - dp + market.d * dq;
        break;
      case "ceiling":
      case "floor":
        v = d.v0 + dp;
        break;
    }
    onChange(d.key, v);
  };

  const endDrag = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setActive(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onKey = (e: KeyboardEvent<SVGGElement>, key: DragKey) => {
    const raise: Record<DragKey, number> = { a: 1, c: 1, tax: 1, subsidy: -1, ceiling: 1, floor: 1 };
    const rightward: Record<DragKey, number> = { a: 1, c: -1, tax: -1, subsidy: 1, ceiling: 1, floor: 1 };
    let dir = 0;
    if (e.key === "ArrowUp") dir = raise[key];
    else if (e.key === "ArrowDown") dir = -raise[key];
    else if (e.key === "ArrowRight") dir = rightward[key];
    else if (e.key === "ArrowLeft") dir = -rightward[key];
    else return;
    e.preventDefault();
    const step = LIMITS[key].step * (e.shiftKey ? 10 : 2);
    onChange(key, values[key] + dir * step);
  };

  const onSvgPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "mouse" || drag.current) return;
    const pt = toData(e.clientX, e.clientY);
    if (pt.q < 0 || pt.q > Q_MAX || pt.p < 0 || pt.p > P_MAX) setHoverQ(null);
    else setHoverQ(pt.q);
  };

  /* ---------------------------- geometry --------------------------- */

  const linePath = (p0: number, slope: number) => `M${x(0)},${y(p0)}L${x(Q_MAX)},${y(p0 + slope * Q_MAX)}`;
  const hLine = (p: number) => `M${x(0)},${y(p)}L${x(Q_MAX)},${y(p)}`;
  const polyPath = (poly: Polygon) =>
    poly.length < 3 ? "" : `M${poly.map((pt) => `${x(pt.q)},${y(pt.p)}`).join("L")}Z`;

  const pxArea = (poly: Polygon) => {
    let s = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      s += x(a.q) * y(b.p) - x(b.q) * y(a.p);
    }
    return Math.abs(s) / 2;
  };

  const centroid = (poly: Polygon) => {
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < poly.length; i++) {
      const p1 = { x: x(poly[i].q), y: y(poly[i].p) };
      const nxt = poly[(i + 1) % poly.length];
      const p2 = { x: x(nxt.q), y: y(nxt.p) };
      const cross = p1.x * p2.y - p2.x * p1.y;
      a += cross;
      cx += (p1.x + p2.x) * cross;
      cy += (p1.y + p2.y) * cross;
    }
    if (Math.abs(a) < 1e-6) return null;
    return { x: cx / (3 * a), y: cy / (3 * a) };
  };

  const knobPoint = (p0: number, slope: number, f: number) => {
    const r = visibleRange(p0, slope);
    if (!r) return null;
    const q = r[0] + (r[1] - r[0]) * f;
    return { x: x(q), y: y(p0 + slope * q) };
  };

  const inBox = (q: number, p: number) => q >= 0 && q <= Q_MAX && p >= 0 && p <= P_MAX;

  /* ---------------------------- content ---------------------------- */

  const showTax = policy.tax > 0.05;
  const showSubsidy = policy.subsidy > 0.05;
  const showCeiling = mode === "ceiling";
  const showFloor = mode === "floor";
  const binding = o.binding && o.hasTrade;
  const traded = o.quantity > 0;

  const regions: { id: string; poly: Polygon; color: string; label: string; opacity: number; hatch?: boolean; outline?: boolean }[] = [
    { id: "cs", poly: o.regions.cs, color: C.cs, label: "CS", opacity: 0.17 },
    { id: "ps", poly: o.regions.ps, color: C.ps, label: "PS", opacity: 0.2 },
    {
      id: "govt",
      poly: o.regions.govt,
      color: C.govt,
      label: mode === "subsidy" ? "Cost" : "Revenue",
      opacity: mode === "subsidy" ? 0 : 0.26,
      outline: mode === "subsidy",
      hatch: false,
    },
    { id: "dwl", poly: o.regions.dwl, color: C.dwl, label: "DWL", opacity: 0.16, hatch: true },
  ];

  // Axis value pills.
  const yPills: Pill[] = [];
  const xPills: Pill[] = [];
  if (o.hasTrade) {
    const muted = { fill: "#FFFFFF", textFill: "#46557A", stroke: C.axis };
    if (!binding) {
      yPills.push({ id: "p*", pos: y(o.pStar), text: money(o.pStar), fill: C.supply, textFill: "#FFFFFF" });
      xPills.push({ id: "q*", pos: x(o.qStar), text: qty(o.qStar), fill: C.supply, textFill: "#FFFFFF" });
    } else {
      yPills.push({ id: "p*", pos: y(o.pStar), text: money(o.pStar), ...muted });
      xPills.push({ id: "q*", pos: x(o.qStar), text: qty(o.qStar), ...muted });
      if (traded) xPills.push({ id: "q", pos: x(o.quantity), text: qty(o.quantity), fill: C.supply, textFill: "#FFFFFF" });
      if ((mode === "tax" || mode === "subsidy") && traded) {
        yPills.push({ id: "pb", pos: y(o.buyerPrice), text: money(o.buyerPrice), fill: C.demand, textFill: "#FFFFFF" });
        yPills.push({ id: "ps", pos: y(o.sellerPrice), text: money(o.sellerPrice), fill: C.supply, textFill: "#FFFFFF" });
      }
    }
    if (showCeiling || showFloor) {
      const p = showCeiling ? policy.ceiling : policy.floor;
      yPills.push({ id: "ctrl", pos: y(p), text: money(p), fill: C.policy, textFill: "#FFFFFF" });
    }
  }
  const visibleY = spread(
    yPills.filter((p) => p.pos >= M.top - 1 && p.pos <= M.top + ih + 1),
    fs + 7,
    M.top,
    M.top + ih,
  );
  const xPillMinGap = (fs + 2) * 2.6;
  const visibleX = spread(
    xPills.filter((p) => p.pos >= M.left - 1 && p.pos <= M.left + iw + 1),
    xPillMinGap,
    M.left + 10,
    M.left + iw - 10,
  );

  // Hover readout.
  const hover =
    hoverQ != null && !active
      ? {
          q: hoverQ,
          d: demandPrice(market, hoverQ),
          s: supplyPrice(market, hoverQ),
          t: showTax ? supplyPrice(market, hoverQ) + policy.tax : null,
          sub: showSubsidy ? supplyPrice(market, hoverQ) - policy.subsidy : null,
        }
      : null;

  const lineWidth = (key: DragKey, base: number) => (active === key || focused === key ? base + 1.25 : base);
  const hitWidth = compact ? 34 : 26;

  const draggable = (key: DragKey, label: string, valueText: string, children: ReactNode, focusable = true) => (
    <g
      tabIndex={focusable ? 0 : -1}
      role={focusable ? "slider" : undefined}
      aria-label={focusable ? label : undefined}
      aria-valuemin={focusable ? LIMITS[key].min : undefined}
      aria-valuemax={focusable ? LIMITS[key].max : undefined}
      aria-valuenow={focusable ? Math.round(values[key] * 100) / 100 : undefined}
      aria-valuetext={focusable ? valueText : undefined}
      aria-hidden={focusable ? undefined : true}
      className="chart-drag"
      style={{ touchAction: "none", cursor: active === key ? "grabbing" : "grab" }}
      onPointerDown={(e) => startDrag(e, key)}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={() => {
        if (drag.current?.key === key) {
          drag.current = null;
          setActive(null);
        }
      }}
      onKeyDown={focusable ? (e) => onKey(e, key) : undefined}
      onFocus={focusable ? () => setFocused(key) : undefined}
      onBlur={focusable ? () => setFocused(null) : undefined}
    >
      {children}
    </g>
  );

  const knob = (key: DragKey, pt: { x: number; y: number } | null, text: string, color: string) => {
    if (!pt) return null;
    const size = compact ? 11 : 11.5;
    const w = Math.max(compact ? 24 : 23, textWidth(text, size) + 14);
    const h = compact ? 24 : 23;
    const cx = Math.min(M.left + iw - w / 2 - 2, Math.max(M.left + w / 2 + 2, pt.x));
    const cy = Math.min(M.top + ih - h / 2 - 2, Math.max(M.top + h / 2 + 2, pt.y));
    return draggable(
      key,
      "",
      "",
      <g transform={`translate(${cx},${cy})`}>
        <rect x={-w / 2 - 8} y={-h / 2 - 8} width={w + 16} height={h + 16} fill="transparent" />
        <rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          rx={h / 2}
          fill={color}
          stroke="#FFFFFF"
          strokeWidth={2}
          className="chart-knob"
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size}
          fontWeight={600}
          fill="#FFFFFF"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {text}
        </text>
      </g>,
      false,
    );
  };

  const bracket = (() => {
    if (!o.hasTrade || !o.binding) return null;
    let p: number;
    let q1: number;
    let q2: number;
    let label: string;
    let below: boolean;
    if (mode === "ceiling" && o.shortage > 0.05) {
      p = policy.ceiling;
      q1 = o.qSupplied;
      q2 = o.qDemanded;
      label = `${ctx.shortageLabel} ${qty(o.shortage)}`;
      below = y(p) + 34 < M.top + ih;
    } else if (mode === "floor" && o.excessSupply > 0.05) {
      p = policy.floor;
      q1 = o.qDemanded;
      q2 = o.qSupplied;
      label = `${ctx.excessLabel} ${qty(o.excessSupply)}`;
      below = y(p) - 34 < M.top;
    } else {
      return null;
    }
    const x1 = x(Math.max(0, q1));
    const x2 = Math.min(x(q2), M.left + iw - 2);
    if (x2 - x1 < 6) return null;
    const offset = below ? 12 : -12;
    const by = y(p) + offset;
    const tick = below ? -5 : 5;
    const clippedEnd = x(q2) > M.left + iw - 2;
    const tx = Math.min(Math.max((x1 + x2) / 2, M.left + 50), M.left + iw - 50);
    return (
      <g style={{ pointerEvents: "none" }}>
        <path
          d={`M${x1},${by + tick}V${by}H${x2}${clippedEnd ? "" : `V${by + tick}`}`}
          fill="none"
          stroke={C.ink}
          strokeWidth={1.25}
        />
        <text
          x={tx}
          y={by + (below ? 14 : -7)}
          textAnchor="middle"
          fontSize={fs}
          fontWeight={600}
          fill={C.ink}
          className="chart-halo"
        >
          {label}
        </text>
      </g>
    );
  })();

  const demandKnob = knobPoint(market.a, -market.b, 0.84);
  const supplyKnob = knobPoint(market.c, market.d, 0.88);
  const taxKnob = showTax ? knobPoint(market.c + policy.tax, market.d, 0.66) : null;
  const subsidyKnob = showSubsidy ? knobPoint(market.c - policy.subsidy, market.d, 0.14) : null;
  const controlPrice = showCeiling ? policy.ceiling : policy.floor;
  const controlName = cap(showCeiling ? ctx.ceilingName : ctx.floorName);

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height: height || 300 }}>
      {width > 0 && (
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block overflow-visible"
          onPointerMove={onSvgPointerMove}
          onPointerLeave={() => setHoverQ(null)}
          role="group"
          aria-label={`Supply and demand chart. ${o.hasTrade ? `Equilibrium price ${money(o.pStar)}, quantity ${qty(o.qStar)}.` : "No trade."}`}
        >
          <defs>
            <clipPath id={`plot-${uid}`}>
              <rect x={M.left} y={M.top} width={iw} height={ih} />
            </clipPath>
            <pattern id={`hatch-dwl-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke={C.dwl} strokeWidth="1.6" strokeOpacity="0.6" />
            </pattern>
            <pattern id={`hatch-govt-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke={C.govt} strokeWidth="1.4" strokeOpacity="0.75" />
            </pattern>
          </defs>

          {/* Grid and axes */}
          <g style={{ pointerEvents: "none" }}>
            {TICKS.map((t) => (
              <g key={`gy${t}`}>
                <line x1={M.left} x2={M.left + iw} y1={y(t)} y2={y(t)} stroke={t === 0 ? C.axis : C.grid} />
                {!visibleY.some((p) => Math.abs(p.pos - y(t)) < fs + 4) && (
                  <text x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize={fs} fill={C.tick} className="tabular-nums">
                    {t === 0 ? "0" : `$${t}`}
                  </text>
                )}
              </g>
            ))}
            {TICKS.map((t) => (
              <g key={`gx${t}`}>
                <line x1={x(t)} x2={x(t)} y1={M.top} y2={M.top + ih} stroke={t === 0 ? C.axis : C.grid} />
                {t > 0 &&
                  !visibleX.some(
                    (p) => Math.abs(p.pos - x(t)) < Math.max(textWidth(p.text, fs) + 12, 26) / 2 + textWidth(String(t), fs) / 2 + 3,
                  ) && (
                  <text x={x(t)} y={M.top + ih + (compact ? 14 : 16)} textAnchor="middle" dominantBaseline="central" fontSize={fs} fill={C.tick} className="tabular-nums">
                    {t}
                  </text>
                )}
              </g>
            ))}
            <text x={M.left - 8} y={M.top - (compact ? 15 : 18)} fontSize={fs} fontWeight={500} fill="#46557A">
              {ctx.priceAxis}
            </text>
            <text x={M.left + iw} y={height - 4} textAnchor="end" fontSize={fs} fontWeight={500} fill="#46557A">
              {ctx.quantityAxis}
            </text>
          </g>

          <g clipPath={`url(#plot-${uid})`}>
            {/* Shaded welfare regions */}
            <g key={mode} className="chart-fade" style={{ pointerEvents: "none" }}>
              {regions.map((r) =>
                r.poly.length >= 3 ? (
                  <g key={r.id}>
                    <path d={polyPath(r.poly)} fill={r.color} fillOpacity={r.opacity} />
                    {r.hatch && <path d={polyPath(r.poly)} fill={`url(#hatch-${r.id === "dwl" ? "dwl" : "govt"}-${uid})`} />}
                    {r.outline && (
                      <path d={polyPath(r.poly)} fill="none" stroke="#C98500" strokeWidth={1.75} strokeDasharray="5 3" />
                    )}
                  </g>
                ) : null,
              )}
            </g>

            {/* Guides from equilibrium points to the axes */}
            <g style={{ pointerEvents: "none" }} stroke={C.guide} strokeWidth={1} strokeDasharray="3 3" fill="none">
              {o.hasTrade && (
                <path d={`M${M.left},${y(o.pStar)}H${x(o.qStar)}V${M.top + ih}`} strokeOpacity={binding ? 0.55 : 1} />
              )}
              {binding && traded && (mode === "tax" || mode === "subsidy") && (
                <>
                  <path d={`M${M.left},${y(o.buyerPrice)}H${x(o.quantity)}`} />
                  <path d={`M${M.left},${y(o.sellerPrice)}H${x(o.quantity)}`} />
                  <path d={`M${x(o.quantity)},${y(Math.max(o.buyerPrice, o.sellerPrice))}V${M.top + ih}`} />
                </>
              )}
              {binding && traded && (mode === "ceiling" || mode === "floor") && (
                <path d={`M${x(o.quantity)},${y(controlPrice)}V${M.top + ih}`} />
              )}
            </g>

            {/* Draggable curves (supply first so demand sits on top) */}
            {draggable(
              "c",
              "Supply curve. Use arrow keys to shift.",
              `Supply intercept ${money(market.c)}`,
              <>
                <path d={linePath(market.c, market.d)} stroke="transparent" strokeWidth={hitWidth} fill="none" />
                <path
                  d={linePath(market.c, market.d)}
                  stroke={C.supply}
                  strokeWidth={lineWidth("c", 2.5)}
                  strokeLinecap="round"
                  fill="none"
                  className="chart-line"
                />
              </>,
            )}

            {showSubsidy &&
              draggable(
                "subsidy",
                "Subsidized supply curve. Use arrow keys to change the subsidy.",
                `Subsidy ${money(policy.subsidy)} per unit`,
                <>
                  <path d={linePath(market.c - policy.subsidy, market.d)} stroke="transparent" strokeWidth={hitWidth} fill="none" />
                  <path
                    d={linePath(market.c - policy.subsidy, market.d)}
                    stroke={C.supply}
                    strokeWidth={lineWidth("subsidy", 2)}
                    strokeDasharray="7 5"
                    fill="none"
                  />
                </>,
              )}

            {showTax &&
              draggable(
                "tax",
                "Taxed supply curve. Use arrow keys to change the tax.",
                `Tax ${money(policy.tax)} per unit`,
                <>
                  <path d={linePath(market.c + policy.tax, market.d)} stroke="transparent" strokeWidth={hitWidth} fill="none" />
                  <path
                    d={linePath(market.c + policy.tax, market.d)}
                    stroke={C.supply}
                    strokeWidth={lineWidth("tax", 2)}
                    strokeDasharray="7 5"
                    fill="none"
                  />
                </>,
              )}

            {draggable(
              "a",
              "Demand curve. Use arrow keys to shift.",
              `Demand intercept ${money(market.a)}`,
              <>
                <path d={linePath(market.a, -market.b)} stroke="transparent" strokeWidth={hitWidth} fill="none" />
                <path
                  d={linePath(market.a, -market.b)}
                  stroke={C.demand}
                  strokeWidth={lineWidth("a", 2.5)}
                  strokeLinecap="round"
                  fill="none"
                  className="chart-line"
                />
              </>,
            )}

            {(showCeiling || showFloor) &&
              draggable(
                showCeiling ? "ceiling" : "floor",
                `${controlName} line. Use arrow keys to move it.`,
                `${controlName} ${money(controlPrice)}`,
                <>
                  <path d={hLine(controlPrice)} stroke="transparent" strokeWidth={hitWidth} fill="none" />
                  <path
                    d={hLine(controlPrice)}
                    stroke={C.policy}
                    strokeWidth={lineWidth(showCeiling ? "ceiling" : "floor", 2)}
                    fill="none"
                  />
                </>,
              )}

            {/* Region labels */}
            <g style={{ pointerEvents: "none" }}>
              {regions.map((r) => {
                if (r.poly.length < 3) return null;
                // A label fits comfortably when the region is about four label boxes in area.
                const need = textWidth(r.label, fs) * (fs + 4) * 4;
                if (pxArea(r.poly) < need) return null;
                const c = centroid(r.poly);
                if (!c) return null;
                return (
                  <text
                    key={`l-${r.id}`}
                    x={c.x}
                    y={c.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={fs}
                    fontWeight={600}
                    fill={C.ink}
                    className="chart-halo"
                  >
                    {r.label}
                  </text>
                );
              })}
            </g>

            {bracket}

            {/* Hover crosshair */}
            {hover && (
              <g style={{ pointerEvents: "none" }}>
                <line x1={x(hover.q)} x2={x(hover.q)} y1={M.top} y2={M.top + ih} stroke={C.guide} strokeWidth={1} />
                {inBox(hover.q, hover.d) && <circle cx={x(hover.q)} cy={y(hover.d)} r={4} fill={C.demand} stroke="#fff" strokeWidth={2} />}
                {inBox(hover.q, hover.s) && <circle cx={x(hover.q)} cy={y(hover.s)} r={4} fill={C.supply} stroke="#fff" strokeWidth={2} />}
                {hover.t != null && inBox(hover.q, hover.t) && (
                  <circle cx={x(hover.q)} cy={y(hover.t)} r={3.5} fill="#fff" stroke={C.supply} strokeWidth={1.5} />
                )}
                {hover.sub != null && inBox(hover.q, hover.sub) && (
                  <circle cx={x(hover.q)} cy={y(hover.sub)} r={3.5} fill="#fff" stroke={C.supply} strokeWidth={1.5} />
                )}
              </g>
            )}

            {/* Equilibrium and policy points */}
            <g style={{ pointerEvents: "none" }}>
              {o.hasTrade && (
                <circle
                  cx={x(o.qStar)}
                  cy={y(o.pStar)}
                  r={binding ? 4.5 : 6}
                  fill={binding ? "#FFFFFF" : C.supply}
                  stroke={binding ? C.supply : "#FFFFFF"}
                  strokeWidth={binding ? 1.75 : 2.5}
                />
              )}
              {binding && traded && (mode === "tax" || mode === "subsidy") && (
                <>
                  <circle cx={x(o.quantity)} cy={y(o.buyerPrice)} r={5.5} fill={C.demand} stroke="#FFFFFF" strokeWidth={2.5} />
                  <circle cx={x(o.quantity)} cy={y(o.sellerPrice)} r={5.5} fill={C.supply} stroke="#FFFFFF" strokeWidth={2.5} />
                </>
              )}
              {binding && (mode === "ceiling" || mode === "floor") && (
                <>
                  {o.qSupplied > 0 && o.qSupplied <= Q_MAX && (
                    <circle cx={x(o.qSupplied)} cy={y(controlPrice)} r={5} fill={C.supply} stroke="#FFFFFF" strokeWidth={2.5} />
                  )}
                  {o.qDemanded > 0 && o.qDemanded <= Q_MAX && (
                    <circle cx={x(o.qDemanded)} cy={y(controlPrice)} r={5} fill={C.demand} stroke="#FFFFFF" strokeWidth={2.5} />
                  )}
                </>
              )}
            </g>
          </g>

          {/* Draggable knobs (top layer, larger touch targets) */}
          {knob("c", supplyKnob, "S", C.supply)}
          {knob("a", demandKnob, "D", C.demand)}
          {showTax && knob("tax", taxKnob, "S + tax", C.supply)}
          {showSubsidy && knob("subsidy", subsidyKnob, "S − subsidy", C.supply)}
          {(showCeiling || showFloor) &&
            knob(
              showCeiling ? "ceiling" : "floor",
              { x: M.left + iw - 4 - (textWidth(controlName, compact ? 11 : 11.5) + 14) / 2, y: y(controlPrice) },
              controlName,
              C.policy,
            )}

          {/* Axis value pills */}
          <g style={{ pointerEvents: "none" }} className="tabular-nums">
            {visibleY.map((p) => {
              const w = textWidth(p.text, fs) + 10;
              const h = fs + 7;
              return (
                <g key={p.id} transform={`translate(${M.left - 4 - w},${p.pos - h / 2})`}>
                  <rect width={w} height={h} rx={4} fill={p.fill} stroke={p.stroke} strokeWidth={p.stroke ? 1 : 0} />
                  <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={600} fill={p.textFill}>
                    {p.text}
                  </text>
                </g>
              );
            })}
            {visibleX.map((p) => {
              const w = Math.max(textWidth(p.text, fs) + 12, 26);
              const h = fs + 7;
              return (
                <g key={p.id} transform={`translate(${p.pos - w / 2},${M.top + ih + 4})`}>
                  <rect width={w} height={h} rx={4} fill={p.fill} stroke={p.stroke} strokeWidth={p.stroke ? 1 : 0} />
                  <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={600} fill={p.textFill}>
                    {p.text}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {hover && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-line bg-white px-2.5 py-2 text-[12px] leading-5 text-ink shadow-[0_4px_16px_rgba(10,26,58,0.08)]"
          style={{
            top: M.top + 8,
            left: x(hover.q) > M.left + iw * 0.6 ? undefined : x(hover.q) + 12,
            right: x(hover.q) > M.left + iw * 0.6 ? width - x(hover.q) + 12 : undefined,
          }}
        >
          <div className="mb-0.5 font-medium text-ink-2 tabular-nums">Q = {qty(hover.q)}</div>
          <Readout color={C.demand} label="Demand" value={hover.d >= 0 ? hover.d : Number.NaN} />
          <Readout color={C.supply} label="Supply" value={hover.s} />
          {hover.t != null && <Readout color={C.supply} label="Supply + tax" value={hover.t} dashed />}
          {hover.sub != null && <Readout color={C.supply} label={"Supply − subsidy"} value={hover.sub} dashed />}
        </div>
      )}
    </div>
  );
}

function Readout({ color, label, value, dashed }: { color: string; label: string; value: number; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2 tabular-nums">
      <span
        className="inline-block h-0 w-3"
        style={{ borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}` }}
        aria-hidden
      />
      <span className="text-ink-2">{label}</span>
      <span className="ml-auto pl-3 font-medium">{money(value)}</span>
    </div>
  );
}
