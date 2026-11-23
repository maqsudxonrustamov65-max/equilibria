# Equilibria

An interactive supply and demand simulator for learning microeconomics. Drag the curves, add a tax, a subsidy, or a price control, and watch prices, quantities, surplus, and deadweight loss update live, with a one-sentence plain-English explanation of what just happened.

Built with Next.js, TypeScript, and Tailwind CSS. There is no backend; everything runs in the browser.

## What you can do

- **Shift the curves.** Drag the demand or supply line (or its D / S handle) on the chart, or use the intercept and slope sliders.
- **Add one intervention at a time.**
  - **Tax:** supply shifts up by the tax. Shows the price buyers pay, the price sellers keep, tax revenue, deadweight loss, and who bears the tax.
  - **Subsidy:** supply shifts down by the subsidy. Shows both prices, the government's cost, and the deadweight loss from overproduction.
  - **Price ceiling / price floor:** a draggable horizontal line. Shows the shortage or surplus and the deadweight loss.
- **Load a scenario:** Free market, Rent control, Cigarette tax, or Minimum wage. Scenarios also change the wording (tenants and landlords, smokers, employers and workers).
- **Read the numbers:** the side panel lists P\*, Q\*, consumer surplus, producer surplus, tax revenue (or subsidy cost), total surplus, and deadweight loss, with changes versus the free market.

It works on phones: the chart stays pinned at the top while you scroll the controls, and the curves can be dragged by touch.

## The model

Linear curves:

| | Formula |
|---|---|
| Demand | P = a − bQ |
| Supply | P = c + dQ |
| Equilibrium quantity | Q\* = (a − c) / (b + d) |
| Equilibrium price | P\* = a − bQ\* |
| Consumer surplus | CS = ½ · Q\* · (a − P\*) |
| Producer surplus | PS = ½ · Q\* · (P\* − c) |

**Tax t per unit** (on sellers): Q = (a − c − t) / (b + d), buyers pay P_b = a − bQ, sellers keep P_s = P_b − t, revenue = t · Q. Buyers bear the share b / (b + d) of the tax.

**Subsidy s per unit** is treated as a negative tax: Q = (a − c + s) / (b + d), sellers receive P_s = P_b + s, cost = s · Q.

**Price ceiling** P_c below P\*: quantity traded is what sellers supply, Q_s = (P_c − c) / d. Shortage = Q_d − Q_s.
**Price floor** P_f above P\*: quantity traded is what buyers demand, Q_d = (a − P_f) / b. Surplus = Q_s − Q_d.
Under price controls the units that trade are assumed to go to the buyers who value them most and come from the lowest-cost sellers (the usual textbook assumption).

**Deadweight loss** for every intervention is the triangle between the curves from the traded quantity Q to Q\*:

DWL = ½ · (b + d) · (Q\* − Q)²

This always equals the free-market total surplus minus the total surplus with the policy, where total surplus with a policy is CS + PS + tax revenue (or CS + PS − subsidy cost).

### How the math is checked

`src/lib/economics.test.ts` verifies the formulas three ways:

1. Hand-worked textbook examples, including each preset.
2. A 400-case randomized sweep comparing every closed-form result against direct numerical integration of the curves.
3. Checks that the shaded regions drawn on the chart have exactly the areas reported in the side panel.

## Running it

Requires Node.js 22.18 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # math and explanation tests (Node's built-in test runner)
npm run typecheck
npm run build
```

## Deploying to Vercel

Push the folder to a Git repository and import it in Vercel. It is detected as a Next.js app automatically; no environment variables or settings are needed. You can also run `npx vercel` from the project folder.

## Project layout

```
src/
  app/                  Next.js app router entry, layout, global styles
  components/
    Simulator.tsx       State, layout, presets, intervention switcher
    SupplyDemandChart.tsx  SVG chart: curves, shading, dragging, hover readout
    Controls.tsx        Sliders for curves and the active policy
    StatsPanel.tsx      Live numbers and the explanation card
  hooks/useTween.ts     Eases values so curves animate smoothly
  lib/
    economics.ts        The model (pure functions)
    explain.ts          The plain-English sentence
    presets.ts          Scenarios, wording, slider ranges
```
