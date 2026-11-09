import { h, openDialog, field, toast, resizeImage } from '../components/ui.js';
import { state, saveTrade } from '../store/state.js';
import { emptyTrade, normalizeTrade, validateTrade, parseNum, RESULTS, SIDES, todayISO } from '../domain/trade.js';
import { effectivePnl } from '../domain/money.js';
import { money } from './shared.js';

/**
 * Ouvre le formulaire de saisie/édition d'un trade.
 * @param {object|null} trade  trade existant à modifier, ou null pour en créer un
 */
export function openTradeForm(trade, { prefill = null } = {}) {
  const { settings } = state;
  const editing = !!trade;
  const base = trade ? structuredClone(trade) : { ...emptyTrade(settings.mode), ...(prefill ?? {}) };
  let screenshot = base.screenshot;
  let errors = {};

  const form = h('form', { novalidate: true, autocomplete: 'off' });
  let dlg;

  const opt = (value, label = value, selected = false) => h('option', { value, selected }, label);
  const select = (name, values, current, blank = '—') => {
    const list = current && !values.includes(current) ? [...values, current] : values;
    return h('select', { name }, opt('', blank, !current), list.map((v) => opt(v, v, v === current)));
  };
  const input = (name, props = {}) => h('input', { name, ...props });

  const fields = {
    mode: h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Mode' }),
  };
  let modeValue = base.mode;
  const paintMode = () => {
    fields.mode.replaceChildren(...[['reel', 'Réel'], ['backtest', 'Backtest']].map(([v, l]) =>
      h('button', { type: 'button', role: 'radio', 'aria-checked': String(modeValue === v), onClick: () => { modeValue = v; paintMode(); } }, l)));
  };
  paintMode();

  const datalist = (id, values) => h('datalist', { id }, values.map((v) => h('option', { value: v })));

  const inputs = {
    date: input('date', { type: 'date', value: base.date }),
    pair: input('pair', { type: 'text', value: base.pair, list: 'dl-pairs', placeholder: 'ex. GBPUSD', autocapitalize: 'characters' }),
    scenario: select('scenario', settings.scenarios, base.scenario),
    side: select('side', SIDES, base.side),
    timeframe: input('timeframe', { type: 'text', value: base.timeframe, list: 'dl-tf', placeholder: 'ex. 5min BOS' }),
    result: select('result', RESULTS, base.result, 'En cours'),
    rules: h('select', { name: 'rulesFollowed' },
      opt('', '—', base.rulesFollowed === null), opt('oui', 'Oui', base.rulesFollowed === true), opt('non', 'Non', base.rulesFollowed === false)),
    rr: input('rr', { type: 'text', inputmode: 'decimal', value: base.rr ?? '', placeholder: 'ex. 1,5' }),
    pips: input('pips', { type: 'text', inputmode: 'decimal', value: base.pips ?? '', placeholder: 'ex. 44,5' }),
    lots: input('lots', { type: 'text', inputmode: 'decimal', value: base.lots ?? '', placeholder: 'ex. 0,5' }),
    risk: input('risk', { type: 'text', inputmode: 'decimal', value: base.risk ?? '', placeholder: settings.currency }),
    pnl: input('pnl', { type: 'text', inputmode: 'decimal', value: base.pnl ?? '', placeholder: 'montant net du courtier' }),
    fees: input('fees', { type: 'text', inputmode: 'decimal', value: base.fees ?? '', placeholder: settings.currency }),
    tags: input('tags', { type: 'text', value: base.tags.join(', '), placeholder: 'séparées par des virgules' }),
    notes: h('textarea', { name: 'notes', rows: 4, placeholder: 'Ce que tu as vu, ce que tu as respecté, ce que tu corriges la prochaine fois…' }, base.notes),
  };

  const customInputs = settings.customFields.map((cf) => {
    const v = base.custom?.[cf.key] ?? '';
    if (cf.type === 'select') return [cf, select(`cf-${cf.key}`, cf.options ?? [], String(v))];
    return [cf, h('input', { name: `cf-${cf.key}`, type: cf.type === 'number' ? 'text' : 'text', inputmode: cf.type === 'number' ? 'decimal' : null, value: v })];
  });

  const estimate = h('div', { class: 'hint', 'aria-live': 'polite' });
  const readDraft = () => {
    const d = {
      ...base,
      mode: modeValue,
      date: inputs.date.value,
      pair: inputs.pair.value,
      scenario: inputs.scenario.value,
      side: inputs.side.value,
      timeframe: inputs.timeframe.value,
      result: inputs.result.value,
      rulesFollowed: inputs.rules.value === 'oui' ? true : inputs.rules.value === 'non' ? false : null,
      rr: parseNum(inputs.rr.value),
      pips: parseNum(inputs.pips.value),
      lots: parseNum(inputs.lots.value),
      risk: parseNum(inputs.risk.value),
      pnl: parseNum(inputs.pnl.value),
      fees: parseNum(inputs.fees.value),
      tags: inputs.tags.value,
      notes: inputs.notes.value,
      screenshot,
      custom: { ...(base.custom ?? {}) },
    };
    for (const [cf, el] of customInputs) {
      const raw = el.value.trim();
      if (raw === '') delete d.custom[cf.key];
      else d.custom[cf.key] = cf.type === 'number' ? (parseNum(raw) ?? raw) : raw;
    }
    return normalizeTrade(d);
  };

  const refreshEstimate = () => {
    const d = readDraft();
    const p = effectivePnl(d, settings);
    if (d.pnl !== null) estimate.textContent = 'Montant saisi : c’est lui qui sera utilisé.';
    else if (p) estimate.textContent = `Estimation ≈ ${money(p.value, settings, { sign: true })} (pips × lots × valeur du pip). Saisis le montant réel pour le remplacer.`;
    else estimate.textContent = 'Sans montant, le trade est compté dans les pips et les statistiques de résultats, pas dans l’argent.';
  };
  for (const k of ['pips', 'lots', 'pnl', 'fees', 'result', 'pair']) {
    inputs[k].addEventListener('input', refreshEstimate);
    inputs[k].addEventListener('change', refreshEstimate);
  }

  // Capture d'écran
  const shotHost = h('div');
  const paintShot = () => {
    shotHost.replaceChildren(
      screenshot ? h('img', { class: 'shot', src: screenshot, alt: 'Capture du graphique de ce trade' }) : null,
      screenshot ? h('button', { class: 'btn small', type: 'button', style: 'margin-top:8px', onClick: () => { screenshot = ''; paintShot(); } }, 'Retirer la capture') : null,
    );
  };
  paintShot();
  const fileInput = h('input', { type: 'file', accept: 'image/*', name: 'shot', onChange: async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { screenshot = await resizeImage(f); paintShot(); } catch (err) { toast(err.message, 'error'); }
    e.target.value = '';
  } });

  const render = () => {
    const err = (k) => errors[k];
    form.replaceChildren(
      h('div', { class: 'field wide', style: 'margin-bottom:12px' }, h('span', { class: 'label' }, 'Mode'), fields.mode),
      h('div', { class: 'form-grid' },
        field('Date', inputs.date, { error: err('date') }),
        field('Paire', inputs.pair, { error: err('pair') }),
        field('Scénario', inputs.scenario),
        field('Sens', inputs.side),
        field('Timeframe de confirmation', inputs.timeframe),
        field('Résultat', inputs.result),
        field('Règles respectées ?', inputs.rules),
      ),
      h('div', { class: 'fieldset-title' }, 'Taille et résultat'),
      h('div', { class: 'form-grid' },
        field('RR prévu (1:x)', inputs.rr, { error: err('rr'), hint: 'Saisis le x de 1:x.' }),
        field('Pips', inputs.pips, { hint: 'Le signe suit le résultat.' }),
        field('Lots', inputs.lots, { error: err('lots') }),
        field(`Risque (${settings.currency})`, inputs.risk, { error: err('risk'), hint: 'Sert au calcul du R.' }),
        field(`Gain / perte net (${settings.currency})`, inputs.pnl, { hint: 'Frais inclus, tel que le courtier le donne.' }),
        field(`Frais (${settings.currency})`, inputs.fees, { error: err('fees') }),
        h('div', { class: 'wide' }, estimate),
      ),
      h('div', { class: 'fieldset-title' }, 'Journal'),
      h('div', { class: 'form-grid' },
        field('Notes', inputs.notes, { wide: true }),
        field('Étiquettes', inputs.tags, { wide: true }),
        h('div', { class: 'field wide' }, h('label', { for: 'shot-input' }, 'Capture du graphique'), Object.assign(fileInput, { id: 'shot-input' }), shotHost),
        ...customInputs.map(([cf, el]) => field(cf.label, el)),
      ),
      datalist('dl-pairs', settings.pairs),
      datalist('dl-tf', settings.timeframes),
    );
    refreshEstimate();
  };
  render();

  const submit = async (again) => {
    const draft = readDraft();
    const v = validateTrade(draft);
    errors = v.errors;
    if (!v.ok) {
      render();
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    try {
      await saveTrade(draft);
      toast(editing ? 'Trade modifié.' : 'Trade enregistré.');
      dlg.close();
      if (again) openTradeForm(null, { prefill: { mode: draft.mode, date: draft.date || todayISO(), pair: draft.pair, scenario: draft.scenario, timeframe: draft.timeframe } });
    } catch (e) {
      console.error(e);
      toast('Enregistrement impossible : ' + e.message, 'error');
    }
  };

  form.addEventListener('submit', (e) => { e.preventDefault(); submit(false); });

  dlg = openDialog({
    title: editing ? 'Modifier le trade' : 'Nouveau trade',
    body: form,
    footer: [
      h('button', { class: 'btn', type: 'button', onClick: () => dlg.close() }, 'Annuler'),
      editing ? null : h('button', { class: 'btn', type: 'button', onClick: () => submit(true) }, 'Enregistrer et en ajouter un autre'),
      h('button', { class: 'btn primary', type: 'button', onClick: () => submit(false) }, 'Enregistrer'),
    ],
  });
  inputs.pair.focus();
}
