import { useEffect, useRef, useState } from 'react';

const reduce = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Compte jusqu'à `value` ; `format` met en forme chaque valeur intermédiaire. */
export default function CountUp({ value, format }) {
  const [shown, setShown] = useState(reduce() ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (value === null || value === undefined || !Number.isFinite(value) || reduce()) { setShown(value); return; }
    const start = performance.now(); const a = from.current; let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 1100); const e = 1 - (1 - p) ** 3;
      setShown(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}
