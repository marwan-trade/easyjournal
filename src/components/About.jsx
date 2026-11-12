import { AUTHOR } from '../config.js';

/** Drapeau de Djibouti en SVG (les drapeaux emoji ne s'affichent pas sous Windows). */
export function DjiboutiFlag({ width = 42 }) {
  const star = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 1.7 : 4.2; const a = (-90 + i * 36) * (Math.PI / 180);
    return `${(7.2 + r * Math.cos(a)).toFixed(2)},${(14 + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return (
    <svg className="flag" width={width} height={(width * 2) / 3} viewBox="0 0 42 28" role="img" aria-label="Drapeau de Djibouti">
      <rect width="42" height="14" fill="#6ab2e7" /><rect y="14" width="42" height="14" fill="#12ad2b" />
      <polygon points="0,0 24,14 0,28" fill="#fff" /><polygon points={star} fill="#d7141a" />
      <rect width="42" height="28" fill="none" stroke="rgba(0,0,0,.25)" />
    </svg>
  );
}

const A = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const T = (c) => <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor" fontFamily="Arial,sans-serif">{c}</text>;
const NETS = {
  instagram: { label: 'Instagram', icon: <g {...A}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" fill="currentColor" /></g> },
  facebook: { label: 'Facebook', icon: <path {...A} d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" /> },
  tiktok: { label: 'TikTok', icon: <path {...A} d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.3 2.4 1.9 4 4.5 4.2" /> },
  x: { label: 'X', icon: <path {...A} d="M4 4l16 16M20 4L4 20" /> },
  youtube: { label: 'YouTube', icon: <g><rect {...A} x="2.5" y="6" width="19" height="12" rx="4" /><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" /></g> },
  telegram: { label: 'Telegram', icon: <path {...A} d="M21 4L3 11l6 2.5L11 20l3-4 5 3.5z M9 13.5L21 4" /> },
  linkedin: { label: 'LinkedIn', icon: T('in') },
  snapchat: { label: 'Snapchat', icon: T('S') },
};
const digits = (s) => s.replace(/[^\d+]/g, '');

/** Carte « À propos de moi » : nom, nationalité et contact. */
export default function About() {
  const tel = digits(AUTHOR.phone);
  const nets = Object.entries(AUTHOR.socials ?? {}).filter(([k, u]) => NETS[k] && /^https?:\/\//.test(u));
  return (
    <section className="card about" id="sec-apropos" style={{ '--i': 4 }}>
      <h2>À propos de moi</h2>
      <div className="aboutrow">
        <DjiboutiFlag width={56} />
        <div>
          <b className="aname">{AUTHOR.name}</b>
          <div className="sub">Nationalité : {AUTHOR.nationality}</div>
        </div>
      </div>
      <div className="aboutcontact">
        <span className="k">Contact</span>
        <a className="btn" href={`tel:${tel}`}>📞 {AUTHOR.phone}</a>
        <a className="btn" href={`https://wa.me/${tel.replace('+', '')}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      </div>
      {nets.length > 0 && (
        <div className="aboutcontact">
          <span className="k">Réseaux</span>
          {nets.map(([k, url]) => <a key={k} className="btn social" href={url} target="_blank" rel="noopener noreferrer" aria-label={NETS[k].label} title={NETS[k].label}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">{NETS[k].icon}</svg></a>)}
        </div>
      )}
    </section>
  );
}
