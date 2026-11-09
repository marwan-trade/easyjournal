import { h, icon, toast, openDialog, confirmDialog, downloadFile, field } from '../components/ui.js';
import { state, saveSettings, importTrades, restoreBackup, wipeAll } from '../store/state.js';
import { parseNum, MODE_LABELS } from '../domain/trade.js';
import { readXlsx } from '../io/xlsx.js';
import { parseCSV, stringifyCSV } from '../io/csv.js';
import { rowsToTrades, workbookToTrades, tradesToRows } from '../io/mapping.js';
import { buildBackup, parseBackup } from '../io/json.js';
import { applyTheme } from '../app-theme.js';

const lines = (text) => [...new Set(text.split('\n').map((l) => l.trim()).filter(Boolean))];

/** Cette vue gère elle-même son redessin (live: false) pour ne pas voler le focus pendant la saisie. */
export function render(root) {
  const page = h('div', { class: 'page' });
  root.append(page);
  const redraw = () => { root.replaceChildren(); render(root); };
  const s = state.settings;

  // ---------- Apparence
  const themeSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Thème' },
    [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(s.theme === v), onClick: async () => { await saveSettings({ theme: v }); applyTheme(v); redraw(); } }, l)));
  page.append(card('Apparence', h('div', {}, themeSeg)));

  // ---------- Compte
  const currency = h('input', { type: 'text', value: s.currency, maxlength: 6, list: 'dl-cur', onChange: (e) => saveSettings({ currency: e.target.value }).then(() => toast('Devise enregistrée.')) });
  const capital = (mode) => h('input', { type: 'text', inputmode: 'decimal', value: s.initialCapital[mode] || '', placeholder: '0',
    onChange: async (e) => {
      const v = parseNum(e.target.value);
      if (e.target.value.trim() !== '' && (v === null || v < 0)) { e.target.setAttribute('aria-invalid', 'true'); toast('Capital invalide.', 'error'); return; }
      e.target.removeAttribute('aria-invalid');
      await saveSettings({ initialCapital: { ...state.settings.initialCapital, [mode]: v ?? 0 } });
      toast('Capital enregistré.');
    } });
  page.append(card('Compte',
    h('div', { class: 'form-grid' },
      field('Devise du compte', currency, { hint: 'Code à 3 lettres : USD, EUR, GBP…' }),
      field('Capital initial — Réel', capital('reel'), { hint: 'Point de départ de la courbe d’équité.' }),
      field('Capital initial — Backtest', capital('backtest')),
      h('datalist', { id: 'dl-cur' }, ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'DJF'].map((c) => h('option', { value: c }))),
    )));

  // ---------- Valeur du pip
  const pipDefault = h('input', { type: 'text', inputmode: 'decimal', value: s.defaultPipValue, onChange: async (e) => {
    const v = parseNum(e.target.value);
    if (v === null || v <= 0) { toast('Valeur du pip invalide.', 'error'); e.target.value = state.settings.defaultPipValue; return; }
    await saveSettings({ defaultPipValue: v }); toast('Valeur du pip enregistrée.');
  } });
  const pipPair = h('select', { 'aria-label': 'Paire' }, s.pairs.map((p) => h('option', { value: p }, p)));
  const pipVal = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'ex. 6,5', 'aria-label': 'Valeur du pip pour cette paire' });
  page.append(card('Estimation de l’argent à partir des pips',
    h('p', { class: 'muted', style: 'margin-bottom:12px' }, 'Quand tu ne saisis pas le montant réel, EasyJournal estime : pips × lots × valeur du pip. Pour 1 lot standard, un pip vaut environ 10 dans la devise du compte sur les paires cotées en USD, mais moins sur USDJPY ou les croisements. Corrige la valeur paire par paire ; les estimations sont toujours marquées « ≈ ».'),
    h('div', { class: 'form-grid' }, field('Valeur du pip par défaut (1 lot)', pipDefault)),
    Object.keys(s.pipValues).length ? h('div', { class: 'table-wrap', style: 'margin-top:12px' }, h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Paire'), h('th', { class: 'r' }, 'Valeur du pip'), h('th', {}, ''))),
      h('tbody', {}, Object.entries(s.pipValues).map(([pair, v]) => h('tr', {}, h('td', {}, pair), h('td', { class: 'r num' }, v),
        h('td', { class: 'r' }, h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': `Retirer ${pair}`, onClick: async () => {
          const next = { ...state.settings.pipValues }; delete next[pair]; await saveSettings({ pipValues: next }); redraw();
        } }, icon('trash'))))))),
    ) : null,
    h('div', { class: 'filters', style: 'margin-top:12px' },
      field('Paire', pipPair), field('Valeur du pip', pipVal),
      h('button', { class: 'btn', type: 'button', onClick: async () => {
        const v = parseNum(pipVal.value);
        if (v === null || v <= 0) { toast('Valeur du pip invalide.', 'error'); pipVal.focus(); return; }
        await saveSettings({ pipValues: { ...state.settings.pipValues, [pipPair.value]: v } }); redraw();
      } }, icon('plus'), 'Ajouter / modifier'),
    ),
  ));

  // ---------- Listes
  const listArea = (label, key, hint) => {
    const ta = h('textarea', { rows: 6, onChange: async (e) => { await saveSettings({ [key]: lines(e.target.value) }); toast('Liste enregistrée.'); } }, s[key].join('\n'));
    return field(label, ta, { hint });
  };
  page.append(card('Listes de suggestions',
    h('div', { class: 'form-grid' },
      listArea('Paires', 'pairs', 'Une par ligne.'),
      listArea('Scénarios', 'scenarios', 'Une par ligne. Menu déroulant du formulaire.'),
      listArea('Timeframes de confirmation', 'timeframes', 'Une par ligne.'),
    )));

  // ---------- Champs personnalisés
  const cfLabel = h('input', { type: 'text', maxlength: 40, placeholder: 'ex. Session, Émotion, News' });
  const cfType = h('select', {}, [['text', 'Texte'], ['number', 'Nombre'], ['select', 'Liste de choix']].map(([v, l]) => h('option', { value: v }, l)));
  const cfOptions = h('input', { type: 'text', placeholder: 'Choix séparés par des virgules (liste de choix)' });
  page.append(card('Champs personnalisés',
    h('p', { class: 'muted', style: 'margin-bottom:12px' }, 'Ajoute tes propres colonnes au journal : elles apparaissent dans le formulaire, le tableau et l’export CSV.'),
    s.customFields.length ? h('ul', { class: 'list', style: 'margin-bottom:12px' }, s.customFields.map((cf) => h('li', { class: 'list-item' },
      h('div', {}, h('strong', {}, cf.label), h('span', { class: 'muted' }, ` · ${cf.type === 'select' ? `liste (${(cf.options ?? []).join(', ')})` : cf.type === 'number' ? 'nombre' : 'texte'}`)),
      h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': `Retirer le champ ${cf.label}`, onClick: async () => {
        if (!(await confirmDialog({ title: 'Retirer ce champ ?', message: `« ${cf.label} » disparaît du formulaire et du tableau. Les valeurs déjà saisies restent enregistrées dans tes trades.`, confirmLabel: 'Retirer', danger: true }))) return;
        await saveSettings({ customFields: state.settings.customFields.filter((c) => c.key !== cf.key) }); redraw();
      } }, icon('trash'))))) : null,
    h('div', { class: 'filters' },
      field('Nom du champ', cfLabel), field('Type', cfType), field('Choix', cfOptions),
      h('button', { class: 'btn', type: 'button', onClick: async () => {
        const label = cfLabel.value.trim();
        if (!label) { cfLabel.focus(); toast('Donne un nom au champ.', 'error'); return; }
        if (state.settings.customFields.some((c) => c.label.toLowerCase() === label.toLowerCase())) { toast('Ce champ existe déjà.', 'error'); return; }
        const options = cfOptions.value.split(',').map((x) => x.trim()).filter(Boolean);
        if (cfType.value === 'select' && options.length < 2) { toast('Une liste de choix demande au moins 2 options.', 'error'); cfOptions.focus(); return; }
        const key = `${label.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'champ'}-${Math.random().toString(36).slice(2, 6)}`;
        await saveSettings({ customFields: [...state.settings.customFields, { key, label, type: cfType.value, options: cfType.value === 'select' ? options : [] }] });
        redraw();
      } }, icon('plus'), 'Ajouter'),
    ),
  ));

  // ---------- Données
  const file = h('input', { type: 'file', accept: '.xlsx,.csv,.json,application/json,text/csv', 'aria-label': 'Choisir un fichier à importer', onChange: async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) await startImport(f, redraw);
  } });
  page.append(card('Données',
    h('p', { class: 'muted', style: 'margin-bottom:12px' }, state.persistent
      ? 'Tes trades sont enregistrés dans ce navigateur, sur cet appareil. Ils ne sont envoyés nulle part. Fais une sauvegarde régulière.'
      : 'Attention : le stockage permanent est indisponible (navigation privée ?). Tes données seront perdues à la fermeture. Exporte une sauvegarde.'),
    h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
      h('button', { class: 'btn primary', type: 'button', onClick: async () => {
        const json = JSON.stringify(buildBackup({ trades: state.trades, ideas: state.ideas, settings: state.settings }), null, 2);
        downloadFile(`easyjournal-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json');
        await saveSettings({ lastBackupAt: Date.now() });
        toast('Sauvegarde téléchargée.');
      } }, icon('download'), 'Sauvegarde complète (JSON)'),
      h('button', { class: 'btn', type: 'button', onClick: () => {
        const csv = stringifyCSV(tradesToRows([...state.trades].sort((a, b) => (a.date < b.date ? -1 : 1)), state.settings.customFields));
        downloadFile(`easyjournal-trades-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
        toast('CSV téléchargé (s’ouvre dans Excel).');
      } }, icon('download'), 'Tous les trades (CSV)'),
    ),
    h('div', { class: 'fieldset-title' }, 'Importer'),
    h('p', { class: 'muted', style: 'margin-bottom:8px' }, 'Journal Excel (.xlsx avec feuilles « Backtesting » et « Réel »), CSV ou sauvegarde JSON. Tu verras un aperçu avant que quoi que ce soit soit modifié.'),
    field('Fichier', file),
    h('div', { class: 'fieldset-title' }, 'Zone dangereuse'),
    h('button', { class: 'btn danger', type: 'button', onClick: () => wipeFlow(redraw) }, icon('trash'), 'Effacer toutes mes données'),
  ));

  page.append(h('p', { class: 'muted', style: 'text-align:center' }, 'EasyJournal v0.1 · données stockées localement'));
}

function card(title, ...children) {
  return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, title)), ...children);
}

async function wipeFlow(redraw) {
  const confirmInput = h('input', { type: 'text', placeholder: 'EFFACER', 'aria-label': 'Tape EFFACER pour confirmer', autocomplete: 'off' });
  const go = h('button', { class: 'btn danger', type: 'button', disabled: true }, 'Tout effacer');
  confirmInput.addEventListener('input', () => { go.disabled = confirmInput.value.trim() !== 'EFFACER'; });
  const dlg = openDialog({
    title: 'Effacer toutes les données ?',
    body: h('div', {},
      h('p', {}, 'Tous tes trades, idées et réglages seront supprimés de ce navigateur. Cette action est définitive : exporte d’abord une sauvegarde si tu en as besoin.'),
      h('div', { style: 'margin-top:12px' }, field('Tape EFFACER pour confirmer', confirmInput))),
    footer: [h('button', { class: 'btn', type: 'button', onClick: () => dlg.close() }, 'Annuler'), go],
  });
  go.addEventListener('click', async () => { await wipeAll(); applyTheme(state.settings.theme); dlg.close(); toast('Toutes les données ont été effacées.'); redraw(); });
}

/** Lit le fichier, construit un aperçu, et n'écrit RIEN avant confirmation. */
async function startImport(file, redraw) {
  try {
    // Le type se déduit du CONTENU (et non seulement de l'extension) : un fichier renommé reste lisible.
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isZip = head[0] === 0x50 && head[1] === 0x4b; // « PK » : un .xlsx est un ZIP
    const name = file.name.toLowerCase();
    if (isZip) {
      const res = workbookToTrades(await readXlsx(await file.arrayBuffer()), { customFields: state.settings.customFields });
      return previewImport(res, { note: res.ignoredSheets.length ? `Feuilles ignorées : ${res.ignoredSheets.join(', ')} (seules « Backtesting » et « Réel » sont lues).` : '' }, redraw);
    }
    const text = await file.text();
    if (name.endsWith('.json') || text.trimStart().startsWith('{')) return importJson(text, redraw);
    if (name.endsWith('.csv') || name.endsWith('.txt') || text.includes(';') || text.includes(',')) {
      const res = rowsToTrades(parseCSV(text), { customFields: state.settings.customFields });
      return previewImport(res, { askMode: res.needsMode }, redraw);
    }
    toast('Format non pris en charge. Utilise .xlsx, .csv ou .json.', 'error');
  } catch (err) {
    console.error(err);
    toast(err.message || 'Import impossible.', 'error');
  }
}

function importJson(text, redraw) {
  const data = parseBackup(text);
  const dlg = openDialog({
    title: 'Restaurer une sauvegarde',
    body: h('div', {}, h('p', {}, `Cette sauvegarde contient ${data.trades.length} trade(s) et ${data.ideas.length} idée(s).`),
      h('p', { class: 'banner', style: 'margin-top:12px' }, 'Elle REMPLACERA toutes les données actuelles de ce navigateur.')),
    footer: [
      h('button', { class: 'btn', type: 'button', onClick: () => dlg.close() }, 'Annuler'),
      h('button', { class: 'btn danger', type: 'button', onClick: async () => {
        await restoreBackup(data); applyTheme(state.settings.theme); dlg.close(); toast('Sauvegarde restaurée.'); redraw();
      } }, 'Remplacer mes données'),
    ],
  });
}

function previewImport(res, { note = '', askMode = false } = {}, redraw) {
  if (res.trades.length === 0) {
    toast(res.skipped[0]?.reason ?? 'Aucun trade lisible dans ce fichier.', 'error');
    return;
  }
  const counts = { reel: 0, backtest: 0 };
  res.trades.forEach((t) => { counts[t.mode] += 1; });
  let strategy = 'append';
  const modeSel = h('select', { 'aria-label': 'Mode des trades importés' }, [['reel', 'Réel'], ['backtest', 'Backtest']].map(([v, l]) => h('option', { value: v }, l)));
  const radio = (value, label, hint) => h('label', { style: 'display:flex;gap:10px;align-items:flex-start;margin-top:8px' },
    h('input', { type: 'radio', name: 'strategy', value, checked: value === strategy, onChange: () => { strategy = value; } }),
    h('span', {}, h('strong', {}, label), h('br'), h('span', { class: 'muted' }, hint)));

  const dlg = openDialog({
    title: 'Aperçu de l’import',
    body: h('div', {},
      h('p', {}, `${res.trades.length} trade(s) prêts : `, `${counts.reel} en réel, ${counts.backtest} en backtest.`),
      askMode ? h('div', { style: 'margin-top:12px', class: 'field' }, h('label', {}, 'Ce fichier ne précise pas le mode. Importer en :'), modeSel) : null,
      note ? h('p', { class: 'muted', style: 'margin-top:8px' }, note) : null,
      res.unknownColumns.length ? h('p', { class: 'muted', style: 'margin-top:8px' }, `Colonnes non reprises : ${res.unknownColumns.join(', ')}.`) : null,
      res.skipped.length ? h('div', { class: 'banner', style: 'margin-top:12px;display:block' },
        h('div', {}, `${res.skipped.length} ligne(s) ignorée(s) :`),
        h('ul', { style: 'margin:6px 0 0 18px;padding:0' }, res.skipped.slice(0, 5).map((s) => h('li', {}, `${s.sheet ? s.sheet + ', ' : ''}ligne ${s.line} : ${s.reason}`)),
          res.skipped.length > 5 ? h('li', {}, `… et ${res.skipped.length - 5} autre(s)`) : null)) : null,
      h('div', { class: 'fieldset-title' }, 'Que faire des trades existants ?'),
      radio('append', 'Ajouter', 'Les trades identiques (même date, paire, scénario, résultat, notes) sont ignorés.'),
      radio('replace', 'Remplacer', 'Supprime d’abord les trades existants du ou des modes concernés.'),
    ),
    footer: [
      h('button', { class: 'btn', type: 'button', onClick: () => dlg.close() }, 'Annuler'),
      h('button', { class: 'btn primary', type: 'button', onClick: async () => {
        try {
          const trades = askMode ? res.trades.map((t) => ({ ...t, mode: modeSel.value })) : res.trades;
          const r = await importTrades(trades, strategy);
          dlg.close();
          toast(`${r.added} trade(s) importé(s)${r.ignored ? `, ${r.ignored} doublon(s) ignoré(s)` : ''}.`);
          redraw();
        } catch (e) { console.error(e); toast('Import interrompu : ' + e.message, 'error'); }
      } }, 'Importer'),
    ],
  });
}
