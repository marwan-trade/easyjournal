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
import { getApiKey, setApiKey, clearCache, isDemoCalendar, setDemoCalendar } from '../core/calendar/cache.js';
import { fetchFmpEvents } from '../core/calendar/fmp.js';
import { weekRange } from '../core/calendar/events.js';

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
  const [apiKey, setKey] = useState(getApiKey);
  const [test, setTest] = useState(null);
  const runTest = async () => {
    setTest({ busy: true });
    try { const { from, to } = weekRange(); const ev = await fetchFmpEvents({ from, to, key: apiKey.trim() }); setTest({ ok: `Connexion réussie : ${ev.length} annonce(s) cette semaine (${ev.filter((e) => e.impact === 'high').length} à fort impact).` }); }
    catch (e) { setTest({ err: e.message }); }
  };
  const onFile = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { setPrepared(await prepareImport(f, s)); } catch (err) { console.error(err); toast(err.message || 'Import impossible.', 'error'); }
  };
  return (
    <div className="set">
      <section className="card" style={{ '--i': 0 }}>
        <h2>Compte et calculs</h2>
        <p className="sub">Ces réglages servent aux chiffres de ton tableau de bord. Rien n'est obligatoire : tu peux les laisser tels quels.</p>
        <div className="formgrid" style={{ marginTop: 10 }}>
          <label className="f">Devise du compte<input defaultValue={s.currency} onBlur={(e) => saveSettings({ currency: e.target.value.trim().toUpperCase() || 'USD' })} /></label>
          <label className="f">Capital de départ · Réel (argent de départ du compte réel)<input inputMode="decimal" defaultValue={s.initialCapital.reel} onBlur={(e) => saveSettings({ initialCapital: { ...s.initialCapital, reel: num(e.target.value) } })} /></label>
          <label className="f">Capital de départ · Backtest (capital fictif)<input inputMode="decimal" defaultValue={s.initialCapital.backtest} onBlur={(e) => saveSettings({ initialCapital: { ...s.initialCapital, backtest: num(e.target.value) } })} /></label>
          <label className="f">Valeur d'un pip pour 1 lot<input inputMode="decimal" defaultValue={s.defaultPipValue} onBlur={(e) => saveSettings({ defaultPipValue: num(e.target.value) || 10 })} /></label>
        </div>
        <p className="sub" style={{ marginTop: 8 }}><b>Capital de départ</b> : la courbe d'argent part de ce montant et le drawdown en % se calcule dessus. <b>Valeur du pip</b> : sert seulement à estimer le gain ou la perte (pips × lots × valeur du pip) quand tu ne saisis pas le montant réel de ton courtier.</p>
      </section>
      <section className="card" style={{ '--i': 1 }}>
        <h2>Calendrier économique</h2>
        <p className="sub">Pour afficher les annonces (inflation, emploi, taux des banques centrales…) avec leur impact faible, moyen ou très fort.</p>
        <ol className="sub" style={{ margin: '10px 0 12px 18px', padding: 0 }}>
          <li>Crée un compte gratuit sur <b>financialmodelingprep.com</b> (sans carte bancaire).</li>
          <li>Copie ta clé API depuis ton tableau de bord, colle-la ci-dessous, puis clique sur « Tester ».</li>
          <li>Si le test réussit, ouvre l'onglet Calendrier.</li>
        </ol>
        <div className="row">
          <input type="password" autoComplete="off" spellCheck="false" value={apiKey} onChange={(e) => setKey(e.target.value)} placeholder="Ta clé API" aria-label="Clé API du calendrier" style={{ flex: '1 1 240px' }} />
          <button className="btn primary" onClick={() => { setApiKey(apiKey); clearCache(); setDemoCalendar(false); toast(apiKey.trim() ? 'Clé enregistrée sur cet appareil.' : 'Clé supprimée.'); }}>Enregistrer</button>
          <button className="btn" disabled={!apiKey.trim() || test?.busy} onClick={runTest}>Tester</button>
        </div>
        {test?.ok && <p className="banner" role="status" style={{ marginTop: 10 }}>{test.ok}</p>}
        {test?.err && <p className="banner" role="alert" style={{ marginTop: 10 }}>{test.err}</p>}
        <p className="sub" style={{ marginTop: 10 }}>La clé reste dans ce navigateur : elle n'est jamais envoyée ailleurs que chez le fournisseur et n'apparaît pas dans tes sauvegardes.{isDemoCalendar() ? ' Les exemples fictifs sont actifs.' : ''}</p>
      </section>
      <section className="card" style={{ '--i': 2 }}>
        <h2>Listes de suggestions</h2><p className="sub">Ce sont les choix proposés quand tu remplis un trade (paires, scénarios, confirmations). Une valeur par ligne.</p>
        <div className="formgrid" style={{ marginTop: 10 }}>
          {[['pairs', 'Paires'], ['scenarios', 'Scénarios'], ['timeframes', 'Confirmations']].map(([k, l]) => (
            <label className="f" key={k}>{l}<textarea defaultValue={s[k].join('\n')} onBlur={(e) => saveSettings({ [k]: list(e.target.value) })} /></label>
          ))}
        </div>
      </section>
      <section className="card" style={{ '--i': 3 }}>
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
