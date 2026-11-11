import { useState } from 'react';
import { saveSettings } from '../store.js';
import Logo from './Logo.jsx';

const num = (s) => Number(String(s).replace(/[\s ]/g, '').replace(',', '.'));

/**
 * Écran obligatoire tant que l'argent mis sur le compte n'est pas renseigné :
 * le solde actuel = dépôt + gains − pertes ne peut pas se calculer sans lui.
 */
export default function DepositGate({ settings, onSkip, onGuestLogout }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault();
    const n = num(v);
    if (!Number.isFinite(n) || n <= 0) { setErr('Écris le montant que tu as mis sur ton compte (supérieur à 0).'); return; }
    await saveSettings({ initialCapital: { ...settings.initialCapital, reel: n } });
  };
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <form className="gatecard" onSubmit={save}>
        <Logo size={44} />
        <h1 id="gate-title">Connecte ton compte de trading</h1>
        <p>Avant de commencer, écris l'<b>argent mis sur ton compte</b> ({settings.currency}). Ton solde actuel se calcule ensuite tout seul : dépôt + gains − pertes.</p>
        <label className="f"><span>Argent mis sur le compte ({settings.currency})</span>
          <input autoFocus inputMode="decimal" value={v} onChange={(e) => { setV(e.target.value); setErr(''); }} placeholder="ex. 12,58" aria-invalid={!!err} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary" type="submit">Valider mon dépôt</button>
        <button className="btn" type="button" onClick={onSkip}>Passer pour l'instant</button>
        <p className="fine">Tu pourras l'écrire plus tard dans Réglages ; l'argent actuel sera calculé une fois le dépôt renseigné.</p>
        {onGuestLogout && <button className="btn" type="button" onClick={onGuestLogout}>Se déconnecter</button>}
      </form>
    </div>
  );
}
