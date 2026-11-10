import { useEffect, useRef, useState } from 'react';
import { compressImage, imageFromTransfer } from '../core/io/images.js';
import { toast } from './toast.jsx';

/** Capture d'écran d'un trade : ajout par bouton, collage (Ctrl+V) ou glisser-déposer. */
export default function ShotField({ value, onChange, onView }) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef(null);

  const take = async (file) => {
    if (!file) return;
    setBusy(true);
    try { onChange(await compressImage(file)); toast('Capture ajoutée.'); }
    catch (e) { toast(e.message || 'Image illisible.', 'error'); }
    finally { setBusy(false); }
  };
  // Collage n'importe où dans le formulaire (hors champs de texte contenant du texte copié)
  useEffect(() => {
    const onPaste = (e) => { const f = imageFromTransfer(e.clipboardData); if (f) { e.preventDefault(); take(f); } };
    document.addEventListener('paste', onPaste); return () => document.removeEventListener('paste', onPaste);
  });

  return (
    <div className={`shot ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(imageFromTransfer(e.dataTransfer)); }}>
      <span className="lbl">Capture d'écran</span>
      {value ? (
        <div className="shotprev">
          <button type="button" onClick={onView} aria-label="Voir la capture en grand"><img src={value} alt="Capture du trade" /></button>
          <div className="row">
            <button type="button" className="btn" onClick={onView}>Agrandir</button>
            <button type="button" className="btn" onClick={() => input.current?.click()}>Remplacer</button>
            <button type="button" className="btn danger" onClick={() => onChange('')}>Retirer</button>
          </div>
        </div>
      ) : (
        <button type="button" className="drop" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? 'Traitement…' : <><b>Ajouter une capture</b><small>Colle-la avec Ctrl+V, glisse-la ici, ou clique pour choisir un fichier</small></>}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
