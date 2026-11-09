import { useState } from 'react';
import Dialog from './Dialog.jsx';
import { toast } from './toast.jsx';
import { readXlsx } from '../core/io/xlsx.js';
import { parseCSV } from '../core/io/csv.js';
import { workbookToTrades, rowsToTrades } from '../core/io/mapping.js';
import { parseBackup } from '../core/io/json.js';
import { importTrades, restoreBackup } from '../store.js';

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
  const go = async () => {
    setBusy(true);
    const r = await importTrades(trades, strategy);
    toast(`${r.added} trade(s) importé(s)${r.ignored ? `, ${r.ignored} doublon(s) ignoré(s)` : ''}.`);
    onClose();
  };
  return (
    <Dialog title="Aperçu de l'import" onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Annuler</button>
      <button className="btn primary" disabled={busy || !trades.length} onClick={go}>Importer {trades.length} trade(s)</button></>}>
      {trades.length === 0 ? <p className="banner">{res.skipped[0]?.reason ?? 'Aucun trade lisible dans ce fichier.'}</p> : (
        <div className="set">
          <p>{trades.length} trade(s) prêts : {counts.reel} en réel, {counts.backtest} en backtest.</p>
          {askMode && <label className="f">Ce fichier ne précise pas le mode. Importer en :<select value={mode} onChange={(e) => setMode(e.target.value)}><option value="reel">Réel</option><option value="backtest">Backtest</option></select></label>}
          {note && <p className="muted">{note}</p>}
          {res.unknownColumns.length > 0 && <p className="muted">Colonnes non reprises : {res.unknownColumns.join(', ')}.</p>}
          {res.skipped.length > 0 && <div className="banner">{res.skipped.length} ligne(s) ignorée(s) :<ul style={{ margin: '6px 0 0 18px', padding: 0 }}>{res.skipped.slice(0, 5).map((s, i) => <li key={i}>{s.sheet ? `${s.sheet}, ` : ''}ligne {s.line} : {s.reason}</li>)}</ul></div>}
          <label style={{ display: 'flex', gap: 10 }}><input type="radio" style={{ width: 'auto' }} checked={strategy === 'append'} onChange={() => setStrategy('append')} /><span><b>Ajouter</b> à mes trades (les doublons exacts sont ignorés)</span></label>
          <label style={{ display: 'flex', gap: 10 }}><input type="radio" style={{ width: 'auto' }} checked={strategy === 'replace'} onChange={() => setStrategy('replace')} /><span><b>Remplacer</b> les trades du ou des modes concernés</span></label>
        </div>
      )}
    </Dialog>
  );
}
