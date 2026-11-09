import { useState } from 'react';
import { useSyncStatus, syncNow, signIn, signUp, signOut } from '../sync.js';
import { toast } from './toast.jsx';

const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : `il y a ${Math.round(m / 60)} h`; };

/** Compte et synchronisation entre appareils (Supabase). */
export default function SyncPanel() {
  const s = useSyncStatus();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = (fn) => async (e) => {
    e?.preventDefault(); setBusy(true); setMsg('');
    try { await fn(); } catch (err) { setMsg(err.message || 'Échec.'); } finally { setBusy(false); }
  };

  if (!s.configured) return (
    <section className="card" style={{ '--i': 0 }}>
      <h2>Compte et synchronisation</h2>
      <p className="sub">La synchronisation entre appareils n'est pas encore activée sur ce site. Tes données restent dans ce navigateur.</p>
    </section>
  );

  if (!s.signedIn) return (
    <section className="card" style={{ '--i': 0 }}>
      <h2>Compte et synchronisation</h2>
      <p className="sub">Connecte-toi pour retrouver tes trades sur tous tes appareils. Tes données actuelles restent intactes : elles sont envoyées dans ton compte à la première connexion.</p>
      <form className="set" style={{ marginTop: 12 }} onSubmit={run(async () => { await signIn(email, pw); toast('Connecté. Synchronisation en cours…'); })}>
        <div className="formgrid">
          <label className="f">Adresse e-mail<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="f">Mot de passe (6 caractères minimum)<input type="password" autoComplete="current-password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        </div>
        <div className="row">
          <button className="btn primary" type="submit" disabled={busy}>Se connecter</button>
          <button className="btn" type="button" disabled={busy || !email || pw.length < 6}
            onClick={run(async () => { const r = await signUp(email, pw); if (r.needsConfirmation) setMsg('Compte créé. Ouvre l\'e-mail de confirmation reçu, puis reviens te connecter.'); else toast('Compte créé et connecté.'); })}>Créer un compte</button>
        </div>
        {msg && <p className="banner" role="alert">{msg}</p>}
      </form>
    </section>
  );

  return (
    <section className="card" style={{ '--i': 0 }}>
      <h2>Compte et synchronisation</h2>
      <p className="sub">Connecté en tant que <b>{s.email}</b>.</p>
      <p style={{ margin: '10px 0' }} role="status">
        {s.status === 'syncing' ? '⟳ Synchronisation en cours…' : s.status === 'offline' ? '⚠ Hors ligne : tes modifications sont gardées et seront envoyées au retour de la connexion.'
          : s.status === 'error' ? null : s.lastSyncAt ? `✓ Synchronisé ${ago(s.lastSyncAt)}` : 'En attente de la première synchronisation…'}
      </p>
      {s.status === 'error' && <p className="banner" role="alert">{s.error}</p>}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" disabled={s.status === 'syncing'} onClick={() => syncNow()}>Synchroniser maintenant</button>
        <button className="btn" onClick={run(async () => { await signOut(); toast('Déconnecté. Tes données restent sur cet appareil.'); })}>Se déconnecter</button>
      </div>
    </section>
  );
}
