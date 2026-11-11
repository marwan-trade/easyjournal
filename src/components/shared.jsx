import { signedPips } from '../core/domain/trade.js';
import { formatNumber, formatPercent } from '../format.js';
import { addTradesRaw } from '../store.js';
import { demoTrades } from '../core/demo.js';
import { toast } from './toast.jsx';

export async function loadDemoData() {
  const n = await addTradesRaw(demoTrades());
  toast(n ? `${n} trades fictifs ajoutés. Tu pourras les supprimer dans ton profil.` : 'Les données de démo sont déjà chargées.');
}

export const ResultPill = ({ result }) => {
  if (!result) return <span className="pill o">En cours</span>;
  const c = result === 'Gagnant' ? 'w' : result === 'Perdant' ? 'l' : 'e';
  return <span className={`pill ${c}`}>{result}</span>;
};
export const pipsText = (t) => formatNumber(signedPips(t), { digits: 1, sign: true });

export function RateBars({ rows, labelOf = (r) => r.key }) {
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar" key={r.key}>
          <span>{labelOf(r)}</span>
          <div><i style={{ width: `${Math.round((r.winRate ?? 0) * 100)}%` }} /></div>
          <b>{r.winRate === null ? '—' : formatPercent(r.winRate)}</b>
        </div>
      ))}
    </div>
  );
}

export function Empty({ title, text, action, onAction, demo }) {
  return <div className="card empty"><h2>{title}</h2><p>{text}</p>
    <div className="row" style={{ justifyContent: 'center' }}>{action && <button className="btn primary" onClick={onAction}>{action}</button>}
      {demo && <button className="btn" onClick={loadDemoData}>Charger des données de démo</button>}</div></div>;
}
