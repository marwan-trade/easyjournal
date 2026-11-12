import { useEffect, useRef, useState } from 'react';

/** Initiale de l'avatar : le nom choisi, sinon l'e-mail, sinon « I » (invité). */
export const initialOf = (name, email) => (String(name || '').trim()[0] || String(email || '')[0] || 'I').toUpperCase();

/** Bouton profil : menu avec accès aux Réglages et déconnexion (ou connexion si on est en mode invité). */
export default function ProfileMenu({ name, email, signedIn, onSignOut, onSignIn, variant = 'side' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const initial = initialOf(name, signedIn ? email : '');
  return (
    <div className={`profile ${variant}`} ref={ref}>
      <button type="button" aria-label="Profil" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="av" aria-hidden="true">{initial}</span>
        {variant === 'side' && <span className="nm lbl">{name || (signedIn && email ? email : 'Invité')}</span>}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="who">{name ? <b>{name}</b> : null}{name ? <br /> : null}{signedIn ? email : 'Mode invité : données sur cet appareil'}</div>
          <a role="menuitem" href="#/profile" onClick={() => setOpen(false)}>◉ Mon profil</a>
          <a role="menuitem" href="#/settings" onClick={() => setOpen(false)}>⚙ Paramètres</a>
          {signedIn
            ? <button role="menuitem" className="out" onClick={() => { setOpen(false); onSignOut(); }}>Déconnexion</button>
            : <button role="menuitem" onClick={() => { setOpen(false); onSignIn(); }}>Se connecter</button>}
        </div>
      )}
    </div>
  );
}
