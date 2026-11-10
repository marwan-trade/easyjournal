import { useState } from 'react';
import Dialog from './Dialog.jsx';
import { toast } from './toast.jsx';
import { readXlsx } from '../core/io/xlsx.js';
import { parseCSV } from '../core/io/csv.js';
import { workbookToTrades, rowsToTrades } from '../core/io/mapping.js';
import { parseBackup } from '../core/io/json.js';
import { importTrades, restoreBackup } from '../store.js';
import { compressImage } from '../core/io/images.js';

/** Lit un fichier et prépare un aperçu. N'écrit rien avant la confirmation de l'utilisateur. */
export async function prepareImport(file, settings) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head[0] === 0x50 && head[1] === 0x4b) { // « PK » : un .xlsx est un ZIP
    const res = workbookToTrades(await readXlsx(await file.arrayBuffer()), { customFields: settings.customFields });
    return { kind: 'trades', res, note: res.ignoredSheets.length ? `Feuilles ignorées : ${res.ignoredSheets.join(', ')} (seules « Backtesting » et « Réel » sont lues).` : '' };
  }
  const text = await file.text();
  if (file.name.toLowerCase().endsWith('.json') || text.trimStart().startsWith('{')) return { kind: 'backup', data: parseBackup(text) };
  if (/[;,]/.test(text)) {
    const res = rowsToTrades(parseCSV(text), { customFields: settings.customFields });
    return { kind: 'trades', res, askMode: res.needsMode, note: '' };
  }
  throw new Error('Format non pris en charge. Utilise .xlsx, .csv ou .json.');
}

export default function ImportFlow({ prepared, onClose }) {
  const [strategy, setStrategy] = useState('append');
  const [mode, setMode] = useState('reel');
  const [busy, setBusy] = useState(false);

  if (prepared.kind === 'backup') {
    const d = prepared.data;
    return (
      <Dialog title="Restaurer une sauvegarde" onClose={onClose} footer={<>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn danger" disabled={busy} onClick={async () => { setBusy(true); await restoreBackup(d); toast('Sauvegarde restaurée.'); onClose(); }}>Remplacer mes données</button></>}>
        <p>Cette sauvegarde contient {d.trades.length} trade(s) et {d.ideas.length} idée(s).</p>
        <p className="banner" style={{ marginTop: 12 }}>Elle REMPLACERA toutes les données actuelles.</p>
      </Dialog>
    );
  }
  const { res, note, askMode } = prepared;
  const trades = askMode ? res.trades.map((t) => ({ ...t, mode })) : res.trades;
  const counts = { reel: trades.filter((t) => t.mode === 'reel').length, backtest: trades.filter((t) => t.mode === 'backtest').length };
  const noPips = trades.filter((t) => (t.result === 'Gagnant' || t.result === 'Perdant') && t.pips === null).length;
  const imgCount = (res.images ?? []).filter(Boolean).length;
  const [progress, setProgress] = useState('');
  const go = async () => {
    setBusy(true);
    try {
      const withShots = [];
      for (let i = 0; i < trades.length; i++) {
        const im = res.images?.[i];
        if (im) setProgress(`Images : ${withShots.filter((t) => t.screenshot).length + 1} / ${imgCount}`);
        let screenshot = '';
        if (im) { try { screenshot = await compressImage(im); } catch { /* image illisible : le trade est importé sans */ } }
        withShots.push(screenshot ? { ...trades[i], screenshot } : trades[i]);
      }
      const r = await importTrades(withShots, strategy);
      toast(`${r.added} trade(s) importé(s)${r.attached ? `, ${r.attached} capture(s) ajoutée(s) à des trades existants` : ''}${r.ignored ? `, ${r.ignored} doublon(s) ignoré(s)` : ''}.`);
      onClose();
    } catch (e) { setBusy(false); setProgress(''); toast(`Import impossible : ${e.message}`); }
  };
  return (
    <Dialog title="Aperçu de l'import" onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" disabled={busy || !trades.length} onClick={go}>{busy ? (progress || 'Import…') : `Importer ${trades.length} trade(s)`}</button></>}>
      {trades.length === 0 ? <p className="banner">{res.skipped[0]?.reason ?? 'Aucun trade lisible dans ce fichier.'}</p> : (
        <div className="set">
          <p>{trades.length} trade(s) prêts : {counts.reel} en réel, {counts.backtest} en backtest.</p>
          {askMode && <label className="f">Ce fichier ne précise pas le mode. Importer en :<select value={mode} onChange={(e) => setMode(e.target.value)}><option value="reel">Réel</option><option value="backtest">Backtest</option></select></label>}
          {imgCount > 0 && <p>🖼 {imgCount} capture(s) d'écran détectée(s) : elles seront importées avec leur trade.</p>}
          {noPips > 0 && <p className="muted">{noPips} trade(s) terminé(s) sans pips (cellule vide dans ton fichier) : ils comptent dans les gagnants/perdants, mais l'argent ne peut pas être calculé. Tu pourras compléter les pips ensuite.</p>}
          {note && <p className="muted">{note}</p>}
          {res.unknownColumns.filter((c) => !/reference|repere/i.test(c.normalize('NFD').replace(/[̀-ͯ]/g, ''))).length > 0 && <p className="muted">Colonnes non reprises : {res.unknownColumns.filter((c) => !/reference|repere/i.test(c.normalize('NFD').replace(/[̀-ͯ]/g, ''))).join(', ')}.</p>}
          {res.skipped.length > 0 && <div className="banner">{res.skipped.length} ligne(s) ignorée(s) :<ul style={{ margin: '6px 0 0 18px', padding: 0 }}>{res.skipped.slice(0, 5).map((s, i) => <li key={i}>{s.sheet ? `${s.sheet}, ` : ''}ligne {s.line} : {s.reason}</li>)}</ul></div>}
          <label style={{ display: 'flex', gap: 10 }}><input type="radio" style={{ width: 'auto' }} checked={strategy === 'append'} onChange={() => setStrategy('append')} /><span><b>Ajouter</b> à mes trades (les doublons exacts sont ignorés)</span></label>
          <label style={{ display: 'flex', gap: 10 }}><input type="radio" style={{ width: 'auto' }} checked={strategy === 'replace'} onChange={() => setStrategy('replace')} /><span><b>Remplacer</b> les trades du ou des modes concernés</span></label>
        </div>
      )}
    </Dialog>
  );
}
