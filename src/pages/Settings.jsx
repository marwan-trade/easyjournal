import { useState } from 'react';
import { saveSettings, wipeAll } from '../store.js';
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
const list = (v) => v.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
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
        <h2>Compte et calculs</h2>
        <div className="formgrid" style={{ marginTop: 10 }}>
          <label className="f">Devise<input defaultValue={s.currency} onBlur={(e) => saveSettings({ currency: e.target.value.trim().toUpperCase() || 'USD' })} /></label>
          <label className="f">Capital de départ · Réel<input inputMode="decimal" defaultValue={s.initialCapital.reel} onBlur={(e) => saveSettings({ initialCapital: { ...s.initialCapital, reel: num(e.target.value) } })} /></label>
          <label className="f">Capital de départ · Backtest<input inputMode="decimal" defaultValue={s.initialCapital.backtest} onBlur={(e) => saveSettings({ initialCapital: { ...s.initialCapital, backtest: num(e.target.value) } })} /></label>
          <label className="f">Valeur d'un pip (1 lot)<input inputMode="decimal" defaultValue={s.defaultPipValue} onBlur={(e) => saveSettings({ defaultPipValue: num(e.target.value) || 10 })} /></label>
        </div>
        <p className="sub" style={{ marginTop: 8 }}>La valeur du pip sert uniquement à estimer le résultat quand tu ne saisis pas le montant réel du courtier.</p>
      </section>
      <section className="card" style={{ '--i': 1 }}>
        <h2>Listes de suggestions</h2><p className="sub">Une valeur par ligne ou séparées par des virgules.</p>
        <div className="formgrid" style={{ marginTop: 10 }}>
          {[['pairs', 'Paires'], ['scenarios', 'Scénarios'], ['timeframes', 'Confirmations']].map(([k, l]) => (
            <label className="f" key={k}>{l}<textarea defaultValue={s[k].join('\n')} onBlur={(e) => saveSettings({ [k]: list(e.target.value) })} /></label>
          ))}
        </div>
      </section>
      <section className="card" style={{ '--i': 2 }}>
        <h2>Données</h2>
        <p className="sub" style={{ margin: '4px 0 12px' }}>{state.persistent ? 'Tes trades sont enregistrés dans ce navigateur. Fais une sauvegarde régulière.' : 'Attention : stockage permanent indisponible (navigation privée ?). Exporte une sauvegarde.'}</p>
        <div className="row">
          <button className="btn primary" onClick={async () => { download(`easyjournal-sauvegarde-${day()}.json`, JSON.stringify(buildBackup({ trades: state.trades, ideas: state.ideas, settings: s }), null, 2), 'application/json'); await saveSettings({ lastBackupAt: Date.now() }); toast('Sauvegarde téléchargée.'); }}>Sauvegarde complète (JSON)</button>
          <button className="btn" onClick={() => { download(`easyjournal-trades-${day()}.csv`, stringifyCSV(tradesToRows([...state.trades].sort((a, b) => (a.date < b.date ? -1 : 1)), s.customFields)), 'text/csv'); toast('CSV téléchargé.'); }}>Tous les trades (CSV)</button>
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
