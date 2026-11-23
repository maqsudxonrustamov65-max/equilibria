"use client";

import type { CSSProperties } from "react";

interface SliderProps {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  color?: string;
  format: (v: number) => string;
  onChange: (v: number) => void;
}

export function Slider({ id, label, hint, value, min, max, step, color = "#142A66", format, onChange }: SliderProps) {
  const clamped = Math.min(max, Math.max(min, value));
  const fraction = (clamped - min) / (max - min);

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="truncate text-[13px] font-medium text-ink">
          {label}
          {hint && <span className="ml-1.5 font-normal text-ink-3">{hint}</span>}
        </label>
        <output htmlFor={id} className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">
          {format(value)}
        </output>
      </div>
      <div className="range-wrap mt-1.5" style={{ "--p": fraction, "--accent": color } as CSSProperties}>
        <div className="range-track" aria-hidden />
        <div className="range-fill" aria-hidden />
        <input
          id={id}
          type="range"
          className="range"
          min={min}
          max={max}
          step={step}
          value={clamped}
          aria-valuetext={format(value)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
