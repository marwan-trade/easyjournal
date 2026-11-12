import { useState } from 'react';
import { saveSettings } from '../store.js';
import Logo from './Logo.jsx';

const num = (s) => Number(String(s).replace(/[\s ]/g, '').replace(',', '.'));

/**
 * Écran obligatoire tant que l'argent mis sur le compte n'est pas renseigné :
 * le solde actuel = dépôt + gains − pertes ne peut pas se calculer sans lui.
 */
export default function DepositGate({ settings, onSkip, onGuestLogout }) {
  const [target, setTarget] = useState(settings.mode === 'backtest' ? 'backtest' : 'reel'); // réel ou backtesting
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault();
    const n = num(v);
    if (!Number.isFinite(n) || n <= 0) { setErr('Écris le montant que tu as mis sur ton compte (supérieur à 0).'); return; }
    const patch = { initialCapital: { ...settings.initialCapital, [target]: n } };
    if (target === 'backtest') { patch.backtest = true; patch.mode = 'backtest'; } // choisir Backtesting ouvre cette interface
    else patch.mode = 'reel';
    await saveSettings(patch);
  };
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <form className="gatecard" onSubmit={save}>
        <Logo size={44} />
        <h1 id="gate-title">Connecte ton compte de trading</h1>
        <div className="seg" role="group" aria-label="Type de compte">
          {[['reel', 'Réel'], ['backtest', 'Backtesting']].map(([k, l]) => <button key={k} type="button" className={target === k ? 'on' : ''} aria-pressed={target === k} onClick={() => { setTarget(k); setErr(''); }}>{l}</button>)}
        </div>
        <p>{target === 'reel'
          ? <>Écris l'<b>argent mis sur ton compte</b> ({settings.currency}). Ton solde actuel se calcule ensuite tout seul : dépôt + gains − pertes.</>
          : <>Écris l'<b>argent virtuel</b> ({settings.currency}) avec lequel tu fais tes backtests. Il reste séparé de ton compte réel, avec les mêmes fonctionnalités.</>}</p>
        <label className="f"><span>{target === 'reel' ? 'Argent mis sur le compte' : 'Argent virtuel du backtesting'} ({settings.currency})</span>
          <input autoFocus inputMode="decimal" value={v} onChange={(e) => { setV(e.target.value); setErr(''); }} placeholder="ex. 12,58" aria-invalid={!!err} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary" type="submit">{target === 'reel' ? 'Valider mon dépôt' : 'Valider et ouvrir le Backtesting'}</button>
        <button className="btn" type="button" onClick={onSkip}>Passer pour l'instant</button>
        <p className="fine">Tu pourras l'écrire plus tard dans les paramètres ; l'argent actuel sera calculé une fois le dépôt renseigné.</p>
        {onGuestLogout && <button className="btn" type="button" onClick={onGuestLogout}>Se déconnecter</button>}
      </form>
    </div>
  );
}
