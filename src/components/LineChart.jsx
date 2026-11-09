import { useMemo, useRef, useState } from 'react';

const W = 640, H = 250, PAD = { l: 54, r: 14, t: 14, b: 26 };

/** Courbe interactive : survole ou touche pour lire chaque point. */
export default function LineChart({ points, formatY, label }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const geo = useMemo(() => {
    if (!points.length) return null;
    const vals = points.map((p) => p.value);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const padv = (max - min) * 0.12; min -= padv; max += padv;
    const x = (i) => PAD.l + (points.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (points.length - 1)) * (W - PAD.l - PAD.r));
    const y = (v) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
    const ticks = [0, 1, 2, 3].map((k) => min + ((max - min) * k) / 3);
    return { x, y, d, ticks, base: H - PAD.b };
  }, [points]);
  if (!geo) return <p className="muted" style={{ padding: '30px 0' }}>Pas encore assez de données pour tracer cette courbe.</p>;
  const last = points.length - 1;
  const move = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    points.forEach((_, i) => { const dd = Math.abs(geo.x(i) - px); if (dd < bd) { bd = dd; best = i; } });
    setHover(best);
  };
  const hp = hover !== null ? points[hover] : null;
  return (
    <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onPointerMove={move} onPointerLeave={() => setHover(null)}>
      <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f5b942" stopOpacity=".28" /><stop offset="1" stopColor="#f5b942" stopOpacity="0" /></linearGradient></defs>
      {geo.ticks.map((t, i) => (
        <g key={i}><line className="gl" x1={PAD.l} x2={W - PAD.r} y1={geo.y(t)} y2={geo.y(t)} /><text className="ax" x={PAD.l - 8} y={geo.y(t) + 4} textAnchor="end">{formatY(t)}</text></g>
      ))}
      <text className="ax" x={PAD.l} y={H - 6}>{points[0].date}</text>
      <text className="ax" x={W - PAD.r} y={H - 6} textAnchor="end">{points[last].date}</text>
      <path className="area" fill="url(#ga)" d={`${geo.d} L${geo.x(last)} ${geo.base} L${geo.x(0)} ${geo.base}Z`} />
      <path className="eq" d={geo.d} pathLength="1" strokeDasharray="1" strokeDashoffset="1"><animate attributeName="stroke-dashoffset" from="1" to="0" dur="1.6s" fill="freeze" calcMode="spline" keySplines=".2 .8 .2 1" keyTimes="0;1" /></path>
      <line className="scan" style={{ '--w': `${W - PAD.l - PAD.r}px` }} x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={geo.base} />
      <circle className="dot" cx={geo.x(last)} cy={geo.y(points[last].value)} r="4.5" />
      {hp && (
        <g pointerEvents="none">
          <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.t} y2={geo.base} stroke="rgba(245,185,66,.5)" />
          <circle cx={geo.x(hover)} cy={geo.y(hp.value)} r="5" className="tip" />
          <g transform={`translate(${Math.min(Math.max(geo.x(hover) - 62, PAD.l), W - 130)},${PAD.t + 2})`}>
            <rect width="124" height="38" rx="8" fill="#1d1815" stroke="#f5b942" strokeOpacity=".5" />
            <text x="10" y="16" fill="#f3ece1" fontSize="12" fontWeight="600">{formatY(hp.value, true)}</text>
            <text x="10" y="31" fill="#a39a8d" fontSize="11">{hp.date}{hp.trade?.pair ? ` · ${hp.trade.pair}` : ''}</text>
          </g>
        </g>
      )}
    </svg>
  );
}
