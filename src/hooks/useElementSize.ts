"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Tracks an element's content-box width with a ResizeObserver. */
export function useElementWidth<T extends HTMLElement>(initial = 0) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w != null) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}

/** Tracks the window's inner height (used to cap the chart height on phones). */
export function useViewportHeight(initial = 800) {
  const [h, setH] = useState(initial);
  useLayoutEffect(() => {
    const update = () => setH(window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return h;
}
