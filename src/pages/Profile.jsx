import { useState } from 'react';
import { saveSettings } from '../store.js';
import SyncPanel from '../components/SyncPanel.jsx';
import { toast } from '../components/toast.jsx';
import { useSyncStatus } from '../sync.js';
import { initialOf } from '../components/ProfileMenu.jsx';

const longDate = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

/** Profil : les informations de l'utilisateur (nom, e-mail, compte, synchronisation). Les réglages de la plateforme sont dans Paramètres. */
export default function Profile({ state }) {
  const { settings: s, trades } = state;
  const sync = useSyncStatus();
  const [name, setName] = useState(s.displayName ?? '');
  const status = !sync.configured ? 'Données sur cet appareil' : !sync.signedIn ? 'Non connecté' : sync.status === 'error' ? 'Erreur de synchronisation' : sync.status === 'offline' ? 'Hors ligne' : sync.status === 'syncing' ? 'Synchronisation…' : 'Synchronisé';
  const saveName = async () => {
    const v = name.trim().slice(0, 40);
    setName(v);
    if (v === (s.displayName ?? '')) return;
    await saveSettings({ displayName: v });
    toast(v ? 'Nom enregistré.' : 'Nom retiré.');
  };
  const count = (m) => trades.filter((t) => t.mode === m).length;
  const first = trades.length ? trades.reduce((a, t) => (t.date < a ? t.date : a), trades[0].date) : null;
  const email = sync.signedIn && sync.email ? sync.email : null;
  return (
    <div className="set">
      <section className="card phero" style={{ '--i': 0 }}>
        <span className="av big" aria-hidden="true">{initialOf(s.displayName, email)}</span>
        <div>
          <h2>{s.displayName || (email ?? 'Mode invité')}</h2>
          <p className="sub">{email ?? 'Tes données restent sur cet appareil'} · {status}</p>
        </div>
        <a className="btn" href="#/settings">⚙ Ouvrir les paramètres</a>
      </section>

      <section className="card" style={{ '--i': 1 }}>
        <h2>Mes informations</h2>
        <div className="capform">
          <label className="f">Nom affiché
            <input value={name} maxLength={40} placeholder="Ton prénom ou pseudo" autoComplete="nickname" onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
            <small>Affiché sur ton profil et dans le menu du haut.</small>
          </label>
          <label className="f">Adresse e-mail
            <input value={email ?? 'Non connecté'} readOnly aria-readonly="true" />
            <small>{email ? "L'adresse de ton compte (connexion et récupération du mot de passe)." : 'Connecte-toi pour retrouver tes trades sur tous tes appareils.'}</small>
          </label>
        </div>
        <div className="pstats">
          <div><span>Trades Réel</span><b>{count('reel')}</b></div>
          {s.backtest && <div><span>Trades Backtest</span><b>{count('backtest')}</b></div>}
          <div><span>Premier trade</span><b>{longDate(first)}</b></div>
        </div>
      </section>

      <SyncPanel />
    </div>
  );
}
