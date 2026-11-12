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
import SyncPanel from '../components/SyncPanel.jsx';
import { MODE_LABELS } from '../core/domain/trade.js';
import { useSyncStatus } from '../sync.js';

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const num = (v) => { const n = Number(String(v).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const day = () => new Date().toISOString().slice(0, 10);


/** Argent mis au départ : réel (ton compte) et backtest (argent virtuel). Le solde actuel = capital + résultat net. */
function CapitalCard({ settings: s }) {
  const [draft, setDraft] = useState({ reel: String(s.initialCapital.reel || ''), backtest: String(s.initialCapital.backtest || ''), lots: String(s.defaultLots ?? '') });
  const commit = async (mode) => {
    const v = Math.max(0, num(draft[mode]));
    if (v === (s.initialCapital[mode] || 0)) return;
    await saveSettings({ initialCapital: { ...s.initialCapital, [mode]: v } });
    toast(s.backtest ? `Capital ${MODE_LABELS[mode].toLowerCase()} enregistré.` : "Argent en dépôt enregistré.");
  };
  const commitLots = async () => {
    const v = Math.max(0, num(draft.lots));
    if (v === s.defaultLots) return;
    await saveSettings({ defaultLots: v });
    toast(v > 0 ? `Lot par défaut : ${v}.` : "Lot par défaut désactivé : l'argent ne sera calculé que si tu saisis les lots.");
  };
  const field = (mode, label, hint) => (
    <label className="f">{label} ({s.currency})
      <input inputMode="decimal" placeholder="ex. 1000" value={draft[mode]} onChange={(e) => setDraft((d) => ({ ...d, [mode]: e.target.value }))}
        onBlur={() => commit(mode)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
      <small>{hint}</small>
    </label>
  );
  return (
    <section className="card" style={{ '--i': 1 }}>
      <h2>Argent en dépôt et lot</h2>
      <p className="sub">L'argent mis sur ton compte de trading. Le tableau de bord affiche l'argent actuel : dépôt + gains − pertes réels (le « Solde réel » de chaque trade).</p>
      <div className="capform">
        {field('reel', 'Argent en dépôt', "L'argent réellement déposé chez ton courtier : il s'affiche en haut du tableau de bord.")}
        {s.backtest && field('backtest', 'Capital backtest (virtuel)', "L'argent fictif avec lequel tu fais tes backtests.")}
        <label className="f">Lot par défaut
          <input inputMode="decimal" placeholder="0,01" value={draft.lots} onChange={(e) => setDraft((d) => ({ ...d, lots: e.target.value }))}
            onBlur={commitLots} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
          <small>Utilisé pour calculer l'argent quand tu ne saisis pas les lots d'un trade (0 = ne pas estimer).</small>
        </label>
      </div>
    </section>
  );
}

/** Ouvre ou ferme l'interface Backtesting (mêmes fonctionnalités que le réel, avec son propre dépôt virtuel). */
function BacktestCard({ settings: s }) {
  const open = async () => { await saveSettings({ backtest: true, mode: 'backtest' }); window.location.hash = '#/'; toast('Interface Backtesting ouverte. Tu peux revenir au réel avec le sélecteur en haut.'); };
  const toReal = async () => { await saveSettings({ mode: 'reel' }); window.location.hash = '#/'; };
  const close = async () => { await saveSettings({ backtest: false, mode: 'reel' }); toast('Interface Backtesting masquée (tes trades de backtest sont gardés).'); };
  return (
    <section className="card" id="sec-backtest" style={{ '--i': 2 }}>
      <h2>Backtesting</h2>
      <p className="sub">Un espace séparé du réel, avec les mêmes fonctionnalités (journal, tableau de bord, import) et son propre dépôt virtuel. Rien n'est mélangé avec ton compte réel.</p>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {!s.backtest
          ? <button type="button" className="btn primary" onClick={open}>Ouvrir l'interface Backtesting →</button>
          : <>
            {s.mode !== 'backtest' ? <button type="button" className="btn primary" onClick={open}>Aller au Backtesting →</button> : <button type="button" className="btn primary" onClick={toReal}>Revenir au réel →</button>}
            <button type="button" className="btn" onClick={close}>Masquer le Backtesting</button></>}
      </div>
    </section>
  );
}

export default function Profile({ state }) {
  const { settings: s } = state;
  const sync = useSyncStatus();
  const initial = (sync.signedIn && sync.email ? sync.email[0] : 'I').toUpperCase();
  const status = !sync.configured ? 'Données sur cet appareil' : !sync.signedIn ? 'Non connecté' : sync.status === 'error' ? 'Erreur de synchronisation' : sync.status === 'offline' ? 'Hors ligne' : sync.status === 'syncing' ? 'Synchronisation…' : 'Synchronisé';
  const [prepared, setPrepared] = useState(null);
  const [wipe, setWipe] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [wipeMode, setWipeMode] = useState(null); // 'reel' | 'backtest' : suppression d'un seul mode
  const onFile = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { setPrepared(await prepareImport(f, s)); } catch (err) { console.error(err); toast(err.message || 'Import impossible.', 'error'); }
  };
  return (
    <div className="set">
      <section className="card phero" style={{ '--i': 0 }}>
        <span className="av big" aria-hidden="true">{initial}</span>
        <div><h2>{sync.signedIn && sync.email ? sync.email : 'Mode invité'}</h2><p className="sub">{status} · tous les réglages de ta plateforme sont ici.</p></div>
        <nav className="pnav" aria-label="Sections du profil">{[['sec-compte', 'Compte'], ['sec-capital', 'Dépôt et lot'], ['sec-backtest', 'Backtesting'], ['sec-donnees', 'Données']].map(([id, l]) => <button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{l}</button>)}</nav>
      </section>
      <div id="sec-compte"><SyncPanel /></div>
      <div id="sec-capital">
      <CapitalCard settings={s} />
      <BacktestCard settings={s} />
      </div>
      <section className="card" id="sec-donnees" style={{ '--i': 1 }}>
        <h2>Données</h2>
        <p className="sub" style={{ margin: '4px 0 12px' }}>{state.persistent ? 'Tes trades sont enregistrés dans ce navigateur. Fais une sauvegarde régulière.' : 'Attention : stockage permanent indisponible (navigation privée ?). Exporte une sauvegarde.'}</p>
        <div className="row">
          <button className="btn primary" onClick={async () => { download(`easyjournal-sauvegarde-${day()}.json`, JSON.stringify(buildBackup({ trades: state.trades, ideas: state.ideas, settings: s }), null, 2), 'application/json'); await saveSettings({ lastBackupAt: Date.now() }); toast('Sauvegarde téléchargée.'); }}>Sauvegarde complète (JSON)</button>
          <button className="btn" onClick={() => { download(`easyjournal-trades-${day()}.csv`, stringifyCSV(tradesToRows([...state.trades].sort((a, b) => (a.date < b.date ? -1 : 1)), s.customFields)), 'text/csv'); toast('CSV téléchargé.'); }}>Tous les trades (CSV)</button>
        </div>
        <h3>Données de démonstration</h3>
        <p className="sub" style={{ marginBottom: 8 }}>18 trades fictifs pour voir l'application remplie. Ils sont repérés et se suppriment sans toucher à tes vrais trades.</p>
        <div className="row">
          <button className="btn primary" onClick={loadDemoData}>Charger les données de démo</button>
          <button className="btn danger" disabled={!state.trades.some(isDemo)} onClick={async () => { const n = await deleteTradesWhere(isDemo); toast(`${n} trade(s) fictif(s) supprimé(s).`); }}>Supprimer les données de démo ({state.trades.filter(isDemo).length})</button>
        </div>
        <h3>Importer</h3>
        <p className="sub" style={{ marginBottom: 8 }}>Journal Excel (.xlsx, feuille « Réel »), CSV ou sauvegarde JSON. Un aperçu s'affiche avant toute modification.</p>
        <input type="file" accept=".xlsx,.csv,.txt,.json" onChange={onFile} aria-label="Fichier à importer" />
        <h3>Supprimer les trades d'un mode</h3>
        <p className="sub" style={{ marginBottom: 8 }}>Le Réel et le Backtesting se suppriment séparément : l'autre mode n'est pas touché. Ton dépôt reste enregistré.</p>
        <div className="row">
          {['reel', 'backtest'].map((m) => <button key={m} className="btn danger" disabled={!state.trades.some((t) => t.mode === m)} onClick={() => { setConfirm(''); setWipeMode(m); }}>Supprimer le {MODE_LABELS[m]} ({state.trades.filter((t) => t.mode === m).length})</button>)}
        </div>
        <h3>Zone dangereuse</h3>
        <button className="btn danger" onClick={() => { setConfirm(''); setWipe(true); }}>Effacer toutes mes données</button>
      </section>
      <p className="muted" style={{ textAlign: 'center' }}>EasyJournal v0.3</p>
      {prepared && <ImportFlow prepared={prepared} onClose={() => setPrepared(null)} />}
      {wipeMode && (
        <Dialog title={`Supprimer tous les trades ${MODE_LABELS[wipeMode]} ?`} onClose={() => setWipeMode(null)} footer={<>
          <button className="btn" onClick={() => setWipeMode(null)}>Annuler</button>
          <button className="btn danger" disabled={confirm.trim().toUpperCase() !== 'SUPPRIMER'} onClick={async () => { const m = wipeMode; const n = await deleteTradesWhere((t) => t.mode === m); setWipeMode(null); toast(`${n} trade(s) ${MODE_LABELS[m]} supprimé(s).`); }}>Supprimer</button></>}>
          <p>Les {state.trades.filter((t) => t.mode === wipeMode).length} trades du mode {MODE_LABELS[wipeMode]} seront supprimés de cet appareil, et aussi de ton compte en ligne si tu es connecté. Les trades de l'autre mode et ton dépôt ne changent pas. Action définitive : exporte d'abord une sauvegarde.</p>
          <label className="f" style={{ marginTop: 12 }}>Tape SUPPRIMER pour confirmer<input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
        </Dialog>
      )}
      {wipe && (
        <Dialog title="Effacer toutes les données ?" onClose={() => setWipe(false)} footer={<>
          <button className="btn" onClick={() => setWipe(false)}>Annuler</button>
          <button className="btn danger" disabled={confirm.trim() !== 'EFFACER'} onClick={async () => { await wipeAll(); setWipe(false); toast('Toutes les données ont été effacées.'); }}>Tout effacer</button></>}>
          <p>Tous tes trades, idées et réglages seront supprimés de cet appareil, et aussi de ton compte en ligne si tu es connecté. Action définitive : exporte d'abord une sauvegarde.</p>
          <label className="f" style={{ marginTop: 12 }}>Tape EFFACER pour confirmer<input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
        </Dialog>
      )}
    </div>
  );
}
