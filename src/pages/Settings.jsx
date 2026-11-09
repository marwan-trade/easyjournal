import { useState } from 'react';
import { saveSettings, wipeAll, deleteTradesWhere } from '../store.js';
import { isDemo } from '../core/demo.js';
import { loadDemoData } from '../components/shared.jsx';
import { buildBackup } from '../core/io/json.js';
import { stringifyCSV } from '../core/io/csv.js';
import { tradesToRows } from '../core/io/mapping.js';
import Dialog from '../components/Dialog.jsx';
import ImportFlow, { prepareImport } from '../components/ImportFlow.jsx';
import { toast } from '../components/toast.jsx';

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const day = () => new Date().toISOString().slice(0, 10);

export default function Settings({ state }) {
  const { settings: s } = state;
  const [prepared, setPrepared] = useState(null);
  const [wipe, setWipe] = useState(false);
  const [confirm, setConfirm] = useState('');
  const onFile = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { setPrepared(await prepareImport(f, s)); } catch (err) { console.error(err); toast(err.message || 'Import impossible.', 'error'); }
  };
  return (
    <div className="set">
      <section className="card" style={{ '--i': 0 }}>
        <h2>Données</h2>
        <p className="sub" style={{ margin: '4px 0 12px' }}>{state.persistent ? 'Tes trades sont enregistrés dans ce navigateur. Fais une sauvegarde régulière.' : 'Attention : stockage permanent indisponible (navigation privée ?). Exporte une sauvegarde.'}</p>
        <div className="row">
          <button className="btn primary" onClick={async () => { download(`easyjournal-sauvegarde-${day()}.json`, JSON.stringify(buildBackup({ trades: state.trades, ideas: state.ideas, settings: s }), null, 2), 'application/json'); await saveSettings({ lastBackupAt: Date.now() }); toast('Sauvegarde téléchargée.'); }}>Sauvegarde complète (JSON)</button>
          <button className="btn" onClick={() => { download(`easyjournal-trades-${day()}.csv`, stringifyCSV(tradesToRows([...state.trades].sort((a, b) => (a.date < b.date ? -1 : 1)), s.customFields)), 'text/csv'); toast('CSV téléchargé.'); }}>Tous les trades (CSV)</button>
        </div>
        <h3>Données de démonstration</h3>
        <p className="sub" style={{ marginBottom: 8 }}>60 trades fictifs (42 en backtest, 18 en réel) pour voir l'application remplie. Ils sont repérés et se suppriment sans toucher à tes vrais trades.</p>
        <div className="row">
          <button className="btn primary" onClick={loadDemoData}>Charger les données de démo</button>
          <button className="btn danger" disabled={!state.trades.some(isDemo)} onClick={async () => { const n = await deleteTradesWhere(isDemo); toast(`${n} trade(s) fictif(s) supprimé(s).`); }}>Supprimer les données de démo ({state.trades.filter(isDemo).length})</button>
        </div>
        <h3>Importer</h3>
        <p className="sub" style={{ marginBottom: 8 }}>Journal Excel (.xlsx avec feuilles « Backtesting » et « Réel »), CSV ou sauvegarde JSON. Un aperçu s'affiche avant toute modification.</p>
        <input type="file" accept=".xlsx,.csv,.txt,.json" onChange={onFile} aria-label="Fichier à importer" />
        <h3>Zone dangereuse</h3>
        <button className="btn danger" onClick={() => { setConfirm(''); setWipe(true); }}>Effacer toutes mes données</button>
      </section>
      <p className="muted" style={{ textAlign: 'center' }}>EasyJournal v0.2 · données stockées sur cet appareil</p>
      {prepared && <ImportFlow prepared={prepared} onClose={() => setPrepared(null)} />}
      {wipe && (
        <Dialog title="Effacer toutes les données ?" onClose={() => setWipe(false)} footer={<>
          <button className="btn" onClick={() => setWipe(false)}>Annuler</button>
          <button className="btn danger" disabled={confirm.trim() !== 'EFFACER'} onClick={async () => { await wipeAll(); setWipe(false); toast('Toutes les données ont été effacées.'); }}>Tout effacer</button></>}>
          <p>Tous tes trades, idées et réglages seront supprimés. Action définitive : exporte d'abord une sauvegarde.</p>
          <label className="f" style={{ marginTop: 12 }}>Tape EFFACER pour confirmer<input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
        </Dialog>
      )}
    </div>
  );
}
