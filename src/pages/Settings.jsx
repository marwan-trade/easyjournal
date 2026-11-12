import { useEffect, useState } from 'react';
import { saveSettings, wipeAll, deleteTradesWhere, snapshotNow, getSnapshots, restoreSnapshot } from '../store.js';
import { download, downloadBackup, daysSince } from '../components/backup.js';
import { isDemo } from '../core/demo.js';
import { stringifyCSV } from '../core/io/csv.js';
import { tradesToRows } from '../core/io/mapping.js';
import { buildJournalXlsx, JOURNAL_FILENAME } from '../core/io/journalXlsx.js';
import Dialog from '../components/Dialog.jsx';
import ImportFlow, { prepareImport } from '../components/ImportFlow.jsx';
import { toast } from '../components/toast.jsx';
import { MODE_LABELS } from '../core/domain/trade.js';
import About from '../components/About.jsx';
import { pipValueInfo } from '../core/domain/money.js';

const num = (v) => { const n = Number(String(v).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** Journal Excel « version finale » : tes trades (Réel et Backtesting), tes dépôts et tes réglages dans le modèle. */
async function exportJournal(state) {
  try {
    const res = await fetch(new URL('assets/modele-journal.xlsx', document.baseURI));
    if (!res.ok) throw new Error('Modèle Excel introuvable. Vérifie ta connexion et réessaie.');
    const bytes = await buildJournalXlsx({ trades: state.trades, settings: state.settings, template: new Uint8Array(await res.arrayBuffer()) });
    download(JOURNAL_FILENAME, bytes, XLSX_TYPE);
    toast('Journal Excel téléchargé.');
  } catch (err) { console.error(err); toast(err.message || 'Export impossible.', 'error'); }
}
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

const THEMES = [['light', '☀', 'Clair'], ['dark', '☾', 'Sombre'], ['auto', '◐', 'Auto']];

/** Apparence : clair, sombre ou automatique (suit le réglage de l'appareil). */
function ThemeCard({ settings: s }) {
  const pick = async (theme) => { if (theme !== s.theme) await saveSettings({ theme }); };
  return (
    <section className="card" id="sec-apparence" style={{ '--i': 1 }}>
      <h2>Apparence</h2>
      <p className="sub">Choisis le thème. « Auto » suit le réglage clair ou sombre de ton appareil.</p>
      <div className="themes" role="radiogroup" aria-label="Thème">
        {THEMES.map(([k, icon, label]) => <button key={k} type="button" role="radio" aria-checked={s.theme === k} className={`themeopt ${k}${s.theme === k ? ' on' : ''}`} onClick={() => pick(k)}><i aria-hidden="true">{icon}</i><b>{label}</b></button>)}
      </div>
    </section>
  );
}

/** Valeur du pip par paire : calculée automatiquement, modifiable si ton courtier donne autre chose. */
function PipCard({ settings: s }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(s.pairs.map((p) => [p, s.pipValues[p] ? String(s.pipValues[p]) : ''])));
  const commit = async (pair) => {
    const raw = String(draft[pair] ?? '').trim();
    const v = raw === '' ? 0 : num(raw);
    const next = { ...s.pipValues };
    if (v > 0) next[pair] = v; else delete next[pair];
    if ((next[pair] ?? 0) === (s.pipValues[pair] ?? 0)) return;
    await saveSettings({ pipValues: next });
    toast(v > 0 ? `Valeur du pip ${pair} : ${v} ${s.currency} par lot.` : `${pair} : calcul automatique rétabli.`);
  };
  return (
    <section className="card" id="sec-pips" style={{ '--i': 2 }}>
      <h2>Valeur du pip par paire</h2>
      <p className="sub">Pour 1 lot. Laisse vide pour le calcul automatique (affiché en gris) ; renseigne une valeur si ton courtier en donne une autre.</p>
      <div className="capform">
        {s.pairs.map((p) => (
          <label className="f" key={p}>{p}
            <input inputMode="decimal" placeholder={`auto : ${pipValueInfo(p, { ...s, pipValues: {} }).value.toFixed(2)}`} value={draft[p] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [p]: e.target.value }))}
              onBlur={() => commit(p)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
          </label>
        ))}
      </div>
    </section>
  );
}

const asList = (text, upper) => [...new Set(String(text).split(/\n|,/).map((x) => x.trim()).filter(Boolean).map((x) => (upper ? x.toUpperCase() : x)))];

/** Listes proposées dans le formulaire de trade : paires, scénarios, timeframes de confirmation. */
function ListsCard({ settings: s }) {
  const defs = [['pairs', 'Paires', true], ['scenarios', 'Scénarios', false], ['timeframes', 'Timeframes de confirmation', false]];
  const [draft, setDraft] = useState(() => Object.fromEntries(defs.map(([k]) => [k, s[k].join('\n')])));
  const commit = async (k, upper) => {
    const list = asList(draft[k], upper);
    if (!list.length) { setDraft((d) => ({ ...d, [k]: s[k].join('\n') })); toast('La liste ne peut pas être vide.', 'error'); return; }
    if (list.join('|') === s[k].join('|')) return;
    await saveSettings({ [k]: list });
    setDraft((d) => ({ ...d, [k]: list.join('\n') }));
    toast('Liste enregistrée.');
  };
  return (
    <section className="card" id="sec-listes" style={{ '--i': 3 }}>
      <h2>Listes du formulaire</h2>
      <p className="sub">Une valeur par ligne. Elles sont proposées quand tu ajoutes un trade ; les trades déjà enregistrés ne changent pas.</p>
      <div className="capform">
        {defs.map(([k, label, upper]) => (
          <label className="f" key={k}>{label}
            <textarea rows={6} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} onBlur={() => commit(k, upper)} />
          </label>
        ))}
      </div>
    </section>
  );
}

const dateFr = (t) => new Date(t).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Instantanés automatiques (dans ce navigateur) : revenir à une version d'un jour précédent. */
function SnapshotsCard({ state }) {
  const [list, setList] = useState([]);
  const [pick, setPick] = useState(null);
  useEffect(() => { getSnapshots().then(setList).catch(() => setList([])); }, [state.trades.length, state.rev]);
  const last = daysSince(state.settings.lastBackupAt);
  return (
    <>
      <h3>Sauvegardes</h3>
      <p className="sub" style={{ marginBottom: 8 }}>{last === null ? "Aucune sauvegarde JSON téléchargée pour l'instant." : last === 0 ? "Dernière sauvegarde JSON : aujourd'hui." : `Dernière sauvegarde JSON : il y a ${last} jour(s).`} Chaque jour, une copie de tes trades est aussi gardée dans ce navigateur (7 dernières, sans les captures) : elle sert à revenir en arrière après une erreur. Elle reste sur cet appareil.</p>
      {list.length === 0 ? <p className="muted">Aucun instantané pour l'instant : le premier est créé dès que tu as des trades.</p> : (
        <ul className="snaps">{list.map((x) => <li key={x.at}><span><b>{dateFr(x.at)}</b><small>{x.counts.trades} trade(s){x.reason !== 'auto' ? ` · ${x.reason}` : ''}</small></span><button type="button" className="btn" onClick={() => setPick(x)}>Restaurer</button></li>)}</ul>
      )}
      {pick && (
        <Dialog title="Restaurer cet instantané ?" onClose={() => setPick(null)} footer={<>
          <button className="btn" onClick={() => setPick(null)}>Annuler</button>
          <button className="btn primary" onClick={async () => { try { const c = await restoreSnapshot(pick.at); setPick(null); toast(`Instantané restauré : ${c.trades} trade(s).`); } catch (err) { toast(err.message, 'error'); } }}>Restaurer</button></>}>
          <p>Tes trades, idées et réglages reviendront à l'état du <b>{dateFr(pick.at)}</b> ({pick.counts.trades} trade(s)). Ce qui a été ajouté depuis sera retiré. Un instantané de l'état actuel est gardé d'abord : tu pourras revenir en arrière.</p>
        </Dialog>
      )}
    </>
  );
}

export default function Settings({ state }) {
  const { settings: s } = state;
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
      <nav className="pnav sticky" aria-label="Sections des paramètres">{[['sec-apparence', 'Apparence'], ['sec-capital', 'Trading'], ['sec-pips', 'Pips'], ['sec-backtest', 'Backtesting'], ['sec-listes', 'Listes'], ['sec-donnees', 'Données'], ['sec-apropos', 'À propos']].map(([id, l]) => <button key={id} type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{l}</button>)}</nav>
      <ThemeCard settings={s} />
      <div id="sec-capital">
      <CapitalCard settings={s} />
      <PipCard settings={s} />
      <BacktestCard settings={s} />
      <ListsCard settings={s} />
      </div>
      <section className="card" id="sec-donnees" style={{ '--i': 1 }}>
        <h2>Données</h2>
        <p className="sub" style={{ margin: '4px 0 12px' }}>{state.persistent ? 'Tes trades sont enregistrés dans ce navigateur. Fais une sauvegarde régulière. Le journal Excel contient tes trades, tes dépôts et tes réglages de pip ; la sauvegarde JSON garde aussi les captures, les idées et tout le reste.' : 'Attention : stockage permanent indisponible (navigation privée ?). Exporte une sauvegarde.'}</p>
        <div className="row">
          <button className="btn primary" onClick={() => exportJournal(state)}>Journal Excel (version finale)</button>
          <button className="btn" onClick={() => downloadBackup(state)}>Sauvegarde complète (JSON)</button>
          <button className="btn" onClick={() => { download(`easyjournal-trades-${day()}.csv`, stringifyCSV(tradesToRows([...state.trades].sort((a, b) => (a.date < b.date ? -1 : 1)), s.customFields)), 'text/csv'); toast('CSV téléchargé.'); }}>Tous les trades (CSV)</button>
        </div>
        <SnapshotsCard state={state} />
        {state.trades.some(isDemo) && <>
          <h3>Anciennes données de démonstration</h3>
          <p className="sub" style={{ marginBottom: 8 }}>Des trades fictifs ajoutés par une ancienne version sont encore là. Tu peux les supprimer sans toucher à tes vrais trades.</p>
          <div className="row"><button className="btn danger" onClick={async () => { const n = await deleteTradesWhere(isDemo); toast(`${n} trade(s) fictif(s) supprimé(s).`); }}>Supprimer les données de démo ({state.trades.filter(isDemo).length})</button></div></>}
        <h3>Importer</h3>
        <p className="sub" style={{ marginBottom: 8 }}>Journal Excel (.xlsx, feuilles « Réel » et « Backtesting »), CSV ou sauvegarde JSON. Un aperçu s'affiche avant toute modification.</p>
        <input type="file" accept=".xlsx,.csv,.txt,.json" onChange={onFile} aria-label="Fichier à importer" />
        <h3>Supprimer les trades d'un mode</h3>
        <p className="sub" style={{ marginBottom: 8 }}>Le Réel et le Backtesting se suppriment séparément : l'autre mode n'est pas touché. Ton dépôt reste enregistré.</p>
        <div className="row">
          {['reel', 'backtest'].map((m) => <button key={m} className="btn danger" disabled={!state.trades.some((t) => t.mode === m)} onClick={() => { setConfirm(''); setWipeMode(m); }}>Supprimer le {MODE_LABELS[m]} ({state.trades.filter((t) => t.mode === m).length})</button>)}
        </div>
        <h3>Zone dangereuse</h3>
        <button className="btn danger" onClick={() => { setConfirm(''); setWipe(true); }}>Effacer toutes mes données</button>
      </section>
      <About />
      <p className="muted" style={{ textAlign: 'center' }}>EasyJournal v0.3</p>
      {prepared && <ImportFlow prepared={prepared} onClose={() => setPrepared(null)} />}
      {wipeMode && (
        <Dialog title={`Supprimer tous les trades ${MODE_LABELS[wipeMode]} ?`} onClose={() => setWipeMode(null)} footer={<>
          <button className="btn" onClick={() => setWipeMode(null)}>Annuler</button>
          <button className="btn danger" disabled={confirm.trim().toUpperCase() !== 'SUPPRIMER'} onClick={async () => { const m = wipeMode; await snapshotNow(`avant suppression du ${MODE_LABELS[m]}`); const n = await deleteTradesWhere((t) => t.mode === m); setWipeMode(null); toast(`${n} trade(s) ${MODE_LABELS[m]} supprimé(s).`); }}>Supprimer</button></>}>
          <p>Les {state.trades.filter((t) => t.mode === wipeMode).length} trades du mode {MODE_LABELS[wipeMode]} seront supprimés de cet appareil, et aussi de ton compte en ligne si tu es connecté. Les trades de l'autre mode et ton dépôt ne changent pas. Action définitive : exporte d'abord une sauvegarde.</p>
          <label className="f" style={{ marginTop: 12 }}>Tape SUPPRIMER pour confirmer<input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
        </Dialog>
      )}
      {wipe && (
        <Dialog title="Effacer toutes les données ?" onClose={() => setWipe(false)} footer={<>
          <button className="btn" onClick={() => setWipe(false)}>Annuler</button>
          <button className="btn danger" disabled={confirm.trim() !== 'EFFACER'} onClick={async () => { await snapshotNow('avant effacement total'); await wipeAll(); setWipe(false); toast('Toutes les données ont été effacées.'); }}>Tout effacer</button></>}>
          <p>Tous tes trades, idées et réglages seront supprimés de cet appareil, et aussi de ton compte en ligne si tu es connecté. Action définitive : exporte d'abord une sauvegarde.</p>
          <label className="f" style={{ marginTop: 12 }}>Tape EFFACER pour confirmer<input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></label>
        </Dialog>
      )}
    </div>
  );
}
