import { useState, useId } from 'react';
import Logo from './Logo.jsx';
import { signIn, signUp, requestPasswordReset, completePasswordReset } from '../sync.js';

const FEATURES = [
  ['◈', 'Journal clair', 'Pips, lots et argent calculés pour toi, solde mis à jour après chaque trade.'],
  ['▥', 'Analyse précise', 'Taux de réussite, drawdown, séries et performance par setup.'],
  ['⟲', 'Partout avec toi', 'Tes trades synchronisés entre ordinateur et téléphone.'],
  ['✦', 'Discipline', 'Idées, notes et revue : ce qui fait progresser un trader.'],
];

/** Petite courbe décorative animée (aucune donnée réelle). */
function HeroChart() {
  const pts = [[0, 78], [28, 70], [52, 74], [80, 56], [108, 60], [136, 40], [164, 46], [192, 24], [220, 28], [248, 8]];
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  return (
    <svg className="herochart" viewBox="0 0 248 90" aria-hidden="true" preserveAspectRatio="none">
      <defs><linearGradient id="hg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f5b942" stopOpacity=".35" /><stop offset="1" stopColor="#f5b942" stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L248 90 L0 90 Z`} fill="url(#hg)" />
      <path d={d} className="hline" fill="none" stroke="#f5b942" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="248" cy="8" r="3.5" fill="#f5b942" className="hdot" />
    </svg>
  );
}

/** Page d'accueil / connexion. `onGuest` : continuer sans compte (données seulement sur cet appareil). */
export default function AuthPage({ onGuest, recovery = null, onRecovered }) {
  const id = useId();
  const [mode, setMode] = useState(recovery ? (recovery.error ? 'in' : 'newpw') : 'in'); // 'in' | 'up' | 'sent' | 'forgot' | 'resetsent' | 'newpw'
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(recovery?.error ?? '');
  const [pw2, setPw2] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      if (mode === 'forgot') { await requestPasswordReset(email); setMode('resetsent'); }
      else if (mode === 'newpw') {
        if (pw !== pw2) { setMsg('Les deux mots de passe ne sont pas identiques.'); return; }
        await completePasswordReset(recovery, pw); onRecovered?.();
      }
      else if (mode === 'in') await signIn(email, pw);
      else { const r = await signUp(email, pw); if (r.needsConfirmation) setMode('sent'); }
    } catch (err) { setMsg(err.message || 'Échec.'); } finally { setBusy(false); }
  };
  const switchTo = (m) => { setMode(m); setMsg(''); };

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="brand big"><Logo size={44} /><span>Easy<b>Journal</b></span></div>
        <h1>Tradez avec <em>méthode</em>.<br />Progressez avec des <em>chiffres</em>.</h1>
        <p className="lead">Le journal de trading qui remplace ton tableur : saisie rapide, calcul automatique de l'argent, statistiques claires.</p>
        <HeroChart />
        <ul className="features">
          {FEATURES.map(([ic, t, d]) => <li key={t}><span aria-hidden="true">{ic}</span><div><b>{t}</b><small>{d}</small></div></li>)}
        </ul>
      </section>

      <section className="auth-card" aria-labelledby={`${id}-t`}>
        {mode === 'resetsent' ? (
          <div className="sent" role="status">
            <div className="mail" aria-hidden="true">✉</div>
            <h2 id={`${id}-t`}>Vérifie ta boîte mail</h2>
            <p>Si un compte existe avec <b>{email}</b>, un message avec un lien pour choisir un nouveau mot de passe vient d'être envoyé (regarde aussi les courriers indésirables).</p>
            <button className="btn primary" onClick={() => switchTo('in')}>Retour à la connexion</button>
          </div>
        ) : mode === 'forgot' ? (
          <>
            <h2 id={`${id}-t`}>Mot de passe oublié</h2>
            <p className="sub">Écris l'adresse e-mail de ton compte : on t'envoie un lien pour choisir un nouveau mot de passe.</p>
            <form onSubmit={submit}>
              <label className="f">Adresse e-mail
                <input type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" />
              </label>
              {msg && <p className="banner" role="alert">{msg}</p>}
              <button className="btn primary wide" type="submit" disabled={busy}>{busy ? 'Un instant…' : 'Envoyer le lien'}</button>
            </form>
            <button className="btn wide ghost" type="button" onClick={() => switchTo('in')}>Retour à la connexion</button>
          </>
        ) : mode === 'newpw' ? (
          <>
            <h2 id={`${id}-t`}>Nouveau mot de passe</h2>
            <p className="sub">Choisis un nouveau mot de passe (6 caractères minimum). Tu seras connecté juste après.</p>
            <form onSubmit={submit}>
              <label className="f">Nouveau mot de passe
                <span className="pwrow">
                  <input type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={6} autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
                  <button type="button" className="eye" onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{show ? 'Masquer' : 'Afficher'}</button>
                </span>
              </label>
              <label className="f">Confirme le mot de passe
                <input type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </label>
              {msg && <p className="banner" role="alert">{msg}</p>}
              <button className="btn primary wide" type="submit" disabled={busy}>{busy ? 'Un instant…' : 'Enregistrer et me connecter'}</button>
            </form>
          </>
        ) : mode === 'sent' ? (
          <div className="sent" role="status">
            <div className="mail" aria-hidden="true">✉</div>
            <h2 id={`${id}-t`}>Vérifie ta boîte mail</h2>
            <p>Un message de confirmation a été envoyé à <b>{email}</b>. Clique sur le lien, puis reviens te connecter.</p>
            <button className="btn primary" onClick={() => switchTo('in')}>Aller à la connexion</button>
          </div>
        ) : (
          <>
            <div className="tabs" role="tablist" aria-label="Connexion ou inscription">
              <button role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => switchTo('in')}>Connexion</button>
              <button role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => switchTo('up')}>Créer un compte</button>
            </div>
            <h2 id={`${id}-t`}>{mode === 'in' ? 'Content de te revoir' : 'Commence gratuitement'}</h2>
            <p className="sub">{mode === 'in' ? 'Connecte-toi pour retrouver ton journal.' : 'Un compte, et tes trades te suivent sur tous tes appareils.'}</p>
            <form onSubmit={submit}>
              <label className="f">Adresse e-mail
                <input type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.com" />
              </label>
              <label className="f">Mot de passe
                <span className="pwrow">
                  <input type={show ? 'text' : 'password'} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="6 caractères minimum" />
                  <button type="button" className="eye" onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{show ? 'Masquer' : 'Afficher'}</button>
                </span>
              </label>
              {msg && <p className="banner" role="alert">{msg}</p>}
              {mode === 'in' && <button type="button" className="linkbtn" onClick={() => switchTo('forgot')}>Mot de passe oublié ?</button>}
              <button className="btn primary wide" type="submit" disabled={busy}>{busy ? 'Un instant…' : mode === 'in' ? 'Se connecter' : 'Créer mon compte'}</button>
            </form>
            <div className="or"><span>ou</span></div>
            <button className="btn wide ghost" onClick={onGuest}>Essayer sans compte</button>
            <p className="fine">Sans compte, tes données restent uniquement dans ce navigateur.</p>
          </>
        )}
        <p className="trust"><span aria-hidden="true">🔒</span> Connexion chiffrée. Chaque compte ne voit que ses propres données.</p>
      </section>
    </div>
  );
}
