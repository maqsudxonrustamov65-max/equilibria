import { equilibrium, type MarketParams, type Mode, type Outcome, type PolicyParams } from "./economics.ts";
import { area, money, qty } from "./format.ts";
import type { MarketContext } from "./presets.ts";

export type ChangeKind =
  | "initial"
  | "preset"
  | "reset"
  | "mode"
  | "policy"
  | "demand-shift"
  | "demand-slope"
  | "supply-shift"
  | "supply-slope";

/** The most recent kind of user action and the market as it was before it began. */
export interface Change {
  kind: ChangeKind;
  from: MarketParams;
}

const EPS = 0.005;

function moved(delta: number): string {
  if (delta > EPS) return "rose to";
  if (delta < -EPS) return "fell to";
  return "stayed at";
}

function freeMarketSentence(o: Outcome, ctx: MarketContext): string {
  return (
    `With no intervention, the market clears at a ${ctx.priceWord} of ${money(o.pStar)} ` +
    `with ${qty(o.qStar)} ${ctx.unit} ${ctx.tradedVerb}, so all ${area(o.ts0)} of potential surplus is realized.`
  );
}

function shiftSentence(market: MarketParams, o: Outcome, ctx: MarketContext, change: Change): string | null {
  const before = equilibrium(change.from);
  if (!before.hasTrade) return null;
  const dP = o.pStar - before.p;
  const dQ = o.qStar - before.q;
  if (Math.abs(dP) < EPS && Math.abs(dQ) < EPS) return null;

  let lead: string;
  switch (change.kind) {
    case "demand-shift":
      lead = market.a > change.from.a ? "Demand increased" : "Demand decreased";
      break;
    case "supply-shift":
      lead = market.c < change.from.c ? "Supply increased" : "Supply decreased";
      break;
    case "demand-slope":
      lead = market.b > change.from.b ? "Demand became steeper" : "Demand became flatter";
      break;
    case "supply-slope":
      lead = market.d > change.from.d ? "Supply became steeper" : "Supply became flatter";
      break;
    default:
      return null;
  }

  return (
    `${lead}, so the equilibrium ${ctx.priceWord} ${moved(dP)} ${money(o.pStar)} ` +
    `and ${ctx.tradeWord} ${moved(dQ)} ${qty(o.qStar)} ${ctx.unit}.`
  );
}

/**
 * One plain-English sentence describing the current state of the market and,
 * where relevant, the change that produced it.
 */
export function explain(
  market: MarketParams,
  policy: PolicyParams,
  mode: Mode,
  o: Outcome,
  ctx: MarketContext,
  change: Change,
): string {
  if (!o.hasTrade) {
    return (
      `No trade takes place: the most any ${ctx.buyer} will pay (${money(market.a)}) ` +
      `is below the least any ${ctx.seller} will accept (${money(market.c)}).`
    );
  }

  switch (mode) {
    case "tax": {
      const t = policy.tax;
      if (t <= 0) {
        return `The tax is set to $0.00, so the market clears at its free-market ${ctx.priceWord} of ${money(o.pStar)}.`;
      }
      if (o.quantity <= 0) {
        return (
          `A ${money(t)} tax is larger than the gap between what ${ctx.buyers} will pay and what ${ctx.sellers} will accept, ` +
          `so trade stops and all ${area(o.ts0)} of surplus is lost.`
        );
      }
      return (
        `The ${money(t)} tax raised the ${ctx.priceWord} ${ctx.buyers} pay to ${money(o.buyerPrice)}, ` +
        `cut the ${ctx.priceWord} ${ctx.sellers} keep to ${money(o.sellerPrice)}, ` +
        `and reduced ${ctx.tradeWord} by ${qty(o.qStar - o.quantity)} ${ctx.unit}.`
      );
    }

    case "subsidy": {
      const s = policy.subsidy;
      if (s <= 0) {
        return `The subsidy is set to $0.00, so the market clears at its free-market ${ctx.priceWord} of ${money(o.pStar)}.`;
      }
      return (
        `The ${money(s)} subsidy cut the ${ctx.priceWord} ${ctx.buyers} pay to ${money(o.buyerPrice)}, ` +
        `raised the ${ctx.priceWord} ${ctx.sellers} receive to ${money(o.sellerPrice)}, ` +
        `and increased ${ctx.tradeWord} by ${qty(o.quantity - o.qStar)} ${ctx.unit} at a cost of ${area(-o.govt)}.`
      );
    }

    case "ceiling": {
      const pc = policy.ceiling;
      if (!o.binding) {
        const where = pc > o.pStar + EPS ? "sits above" : "equals";
        return (
          `The ${money(pc)} ${ctx.ceilingName} ${where} the equilibrium ${ctx.priceWord} of ${money(o.pStar)}, ` +
          `so it does not bind and the market clears normally.`
        );
      }
      if (o.quantity <= 0) {
        return (
          `The ${money(pc)} ${ctx.ceilingName} is below the lowest ${ctx.priceWord} any ${ctx.seller} will accept ` +
          `(${money(market.c)}), so ${ctx.noneTraded} and all ${area(o.ts0)} of surplus is lost.`
        );
      }
      return (
        `The ${money(pc)} ${ctx.ceilingName} holds the ${ctx.priceWord} below its ${money(o.pStar)} equilibrium, so ` +
        `${ctx.shortageClause(qty(o.qDemanded), qty(o.qSupplied), qty(o.shortage))}.`
      );
    }

    case "floor": {
      const pf = policy.floor;
      if (!o.binding) {
        const where = pf < o.pStar - EPS ? "sits below" : "equals";
        return (
          `The ${money(pf)} ${ctx.floorName} ${where} the equilibrium ${ctx.priceWord} of ${money(o.pStar)}, ` +
          `so it does not bind and the market clears normally.`
        );
      }
      if (o.quantity <= 0) {
        return (
          `The ${money(pf)} ${ctx.floorName} is above the most any ${ctx.buyer} will pay ` +
          `(${money(market.a)}), so ${ctx.noneTraded} and all ${area(o.ts0)} of surplus is lost.`
        );
      }
      return (
        `The ${money(pf)} ${ctx.floorName} holds the ${ctx.priceWord} above its ${money(o.pStar)} equilibrium, so ` +
        `${ctx.excessClause(qty(o.qSupplied), qty(o.qDemanded), qty(o.excessSupply))}.`
      );
    }

    default:
      return shiftSentence(market, o, ctx, change) ?? freeMarketSentence(o, ctx);
  }
}
