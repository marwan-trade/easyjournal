import { useEffect, useRef, useState } from 'react';

/** Bouton profil : menu avec accès aux Réglages et déconnexion (ou connexion si on est en mode invité). */
export default function ProfileMenu({ email, signedIn, onSignOut, onSignIn }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const initial = (signedIn && email ? email[0] : 'I').toUpperCase();
  return (
    <div className="profile" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="av" aria-hidden="true">{initial}</span><span className="nm">Profil</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="who">{signedIn ? email : 'Mode invité : données sur cet appareil'}</div>
          <a role="menuitem" href="#/settings" onClick={() => setOpen(false)}>⚙ Menu et réglages</a>
          {signedIn
            ? <button role="menuitem" className="out" onClick={() => { setOpen(false); onSignOut(); }}>Déconnexion</button>
            : <button role="menuitem" onClick={() => { setOpen(false); onSignIn(); }}>Se connecter</button>}
        </div>
      )}
    </div>
  );
}
