/**
 * Graphiques SVG sans dépendance. Les couleurs viennent des classes CSS (thème clair/sombre automatique).
 * Chaque graphique porte un aria-label et des <title> sur les points pour les lecteurs d'écran et le survol.
 */
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, text) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
};

/** Graduations « rondes » (1, 2, 5 × 10^n). */
export function niceTicks(min, max, target = 5) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { ticks, min: lo, max: hi };
}

const H = 260;
const M = { l: 56, r: 14, t: 14, b: 30 };
/** Largeur de la marge gauche selon la longueur des étiquettes (évite qu'elles soient coupées). */
const leftMargin = (labels) => Math.max(M.l, 14 + 6.6 * Math.max(...labels.map((l) => String(l).length)));

/**
 * @param {{label:string, value:number}[]} points
 * @param {{format?:(n:number)=>string, ariaLabel?:string}} opts
 */
export function lineChart(points, { format = String, ariaLabel = 'Courbe', includeZero = true } = {}) {
  const W = 640;
  const svg = el('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': ariaLabel });
  if (points.length === 0) return svg;

  const values = points.map((p) => p.value);
  const lo = includeZero ? Math.min(0, ...values) : Math.min(...values);
  const hi = includeZero ? Math.max(0, ...values) : Math.max(...values);
  const { ticks, min, max } = niceTicks(lo, hi);
  const L = leftMargin(ticks.map(format));
  const x = (i) => L + (points.length === 1 ? (W - L - M.r) / 2 : (i * (W - L - M.r)) / (points.length - 1));
  const y = (v) => M.t + ((max - v) * (H - M.t - M.b)) / (max - min || 1);

  for (const t of ticks) {
    svg.append(el('line', { class: 'grid', x1: L, x2: W - M.r, y1: y(t), y2: y(t) }));
    svg.append(el('text', { x: L - 8, y: y(t) + 4, 'text-anchor': 'end' }, format(t)));
  }
  if (min < 0 && max > 0) svg.append(el('line', { class: 'axis0', x1: L, x2: W - M.r, y1: y(0), y2: y(0) }));

  const pts = points.map((p, i) => [x(i), y(p.value)]);
  const base = y(Math.max(min, Math.min(0, max)));
  if (points.length > 1) {
    svg.append(el('path', { class: 'area', d: `M${pts[0][0]},${base} ${pts.map((p) => `L${p[0]},${p[1]}`).join(' ')} L${pts.at(-1)[0]},${base} Z` }));
    svg.append(el('path', { class: 'line', d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ') }));
  }
  const showDots = points.length <= 60;
  points.forEach((p, i) => {
    if (!showDots && i !== points.length - 1) return;
    const c = el('circle', { class: 'dot', cx: pts[i][0], cy: pts[i][1], r: showDots ? 3.5 : 4 });
    c.append(el('title', {}, `${p.label} : ${format(p.value)}`));
    svg.append(c);
  });

  // Étiquettes de l'axe X : début, milieu, fin.
  const idxs = points.length === 1 ? [0] : [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  idxs.forEach((i, k) => {
    const anchor = k === 0 && idxs.length > 1 ? 'start' : k === idxs.length - 1 && idxs.length > 1 ? 'end' : 'middle';
    svg.append(el('text', { x: x(i), y: H - 8, 'text-anchor': anchor }, points[i].label));
  });
  return svg;
}

/**
 * Histogramme empilé gagnants / perdants.
 * @param {{label:string, wins:number, losses:number}[]} rows
 */
export function stackedBars(rows, { ariaLabel = 'Gagnants et perdants' } = {}) {
  const W = 460;
  const svg = el('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': ariaLabel });
  const totals = rows.map((r) => r.wins + r.losses);
  const { ticks, max } = niceTicks(0, Math.max(...totals, 1), 4);
  const intTicks = ticks.filter((t) => Number.isInteger(t));
  const y = (v) => M.t + ((max - v) * (H - M.t - M.b)) / max;
  for (const t of intTicks) {
    svg.append(el('line', { class: 'grid', x1: M.l, x2: W - M.r, y1: y(t), y2: y(t) }));
    svg.append(el('text', { x: M.l - 8, y: y(t) + 4, 'text-anchor': 'end' }, String(t)));
  }
  const slot = (W - M.l - M.r) / rows.length;
  const bw = Math.min(64, slot * 0.55);
  rows.forEach((r, i) => {
    const cx = M.l + slot * i + slot / 2;
    const segs = [
      { v: r.wins, cls: 'bar-win', name: 'Gagnants' },
      { v: r.losses, cls: 'bar-loss', name: 'Perdants' },
    ];
    let acc = 0;
    for (const s of segs) {
      if (s.v > 0) {
        const top = y(acc + s.v);
        const height = y(acc) - top;
        const rect = el('rect', { class: s.cls, x: cx - bw / 2, y: top, width: bw, height, rx: 3 });
        rect.append(el('title', {}, `${r.label} — ${s.name} : ${s.v}`));
        svg.append(rect);
        if (height >= 16) svg.append(el('text', { class: 'bar-label', x: cx, y: top + height / 2 + 4, 'text-anchor': 'middle' }, String(s.v)));
      }
      acc += s.v;
    }
    svg.append(el('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, r.label));
  });
  return svg;
}
