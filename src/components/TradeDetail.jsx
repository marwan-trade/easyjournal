import { useState } from 'react';
import Dialog from './Dialog.jsx';
import ShotViewer from './ShotViewer.jsx';
import { ResultPill, pipsText } from './shared.jsx';
import { effectivePnl, realAmount } from '../core/domain/money.js';
import { money, signClass, shortDate, formatNumber } from '../format.js';

const Info = ({ k, children, wide }) => <div className={wide ? 'info wide' : 'info'}><dt>{k}</dt><dd>{children || '—'}</dd></div>;

/** Fiche d'un trade en lecture seule : rien n'est modifiable tant qu'on n'a pas touché « Modifier ». */
export default function TradeDetail({ trade: t, settings, onEdit, onClose }) {
  const [viewing, setViewing] = useState(false);
  const hideMoney = !((settings.initialCapital[settings.mode] || 0) > 0); // sans dépôt : aucun montant affiché
  const p = effectivePnl(t, settings);
  const real = realAmount(t);
  return (
    <Dialog title={`${t.pair} · ${shortDate(t.date)}`} onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Fermer</button><button type="button" className="btn primary" onClick={onEdit}>Modifier</button></>}>
      <div className="detail-head"><ResultPill result={t.result} />{t.side && <span className="chip">{t.side}</span>}{t.scenario && <span className="chip">{t.scenario}</span>}</div>
      {t.screenshot && <button type="button" className="detail-shot" onClick={() => setViewing(true)} aria-label="Agrandir la capture"><img src={t.screenshot} alt={`Capture du trade ${t.pair} du ${t.date}`} /></button>}
      <dl className="detail">
        <Info k="Date">{t.date}</Info>
        <Info k="Paire">{t.pair}</Info>
        <Info k="Sens">{t.side}</Info>
        <Info k="Scénario">{t.scenario}</Info>
        <Info k="Timeframe de confirmation">{t.timeframe}</Info>
        <Info k="Règles respectées">{t.rulesFollowed === true ? 'Oui' : t.rulesFollowed === false ? 'Non' : ''}</Info>
        <Info k="RR prévu">{t.rr ? `1 : ${formatNumber(t.rr, { digits: 2 })}` : ''}</Info>
        <Info k="Lots">{t.lots ?? ''}</Info>
        <Info k="Pips">{t.pips === null || t.pips === undefined ? '' : pipsText(t)}</Info>
        <Info k="Gain / perte estimé">{p && !hideMoney ? <b className={signClass(p.value)}>{p.estimated ? '≈ ' : ''}{money(p.value, settings, { sign: true })}</b> : ''}</Info>
        <Info k="Solde réel">{real !== null && !hideMoney ? <b className={signClass(real)}>{money(real, settings, { sign: true, digits: 2 })}</b> : ''}</Info>
        <Info k="Risque">{t.risk ? money(t.risk, settings, { digits: 2 }) : ''}</Info>
        <Info k="Frais">{t.fees ? money(t.fees, settings, { digits: 2 }) : ''}</Info>
        <Info k="Étiquettes" wide>{(t.tags ?? []).join(', ')}</Info>
        <Info k="Notes" wide>{t.notes && <span className="pre">{t.notes}</span>}</Info>
      </dl>
      {viewing && t.screenshot && <ShotViewer trade={t} list={[]} onClose={() => setViewing(false)} />}
    </Dialog>
  );
}
