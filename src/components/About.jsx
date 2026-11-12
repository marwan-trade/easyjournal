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

const digits = (s) => s.replace(/[^\d+]/g, '');

/** Carte « À propos de moi » : nom, nationalité et contact. */
export default function About() {
  const tel = digits(AUTHOR.phone);
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
    </section>
  );
}
