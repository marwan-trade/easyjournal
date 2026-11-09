import { h } from '../components/ui.js';
import { lineChart, stackedBars } from '../components/charts.js';
import { state, tradesOf } from '../store/state.js';
import { summarize } from '../domain/stats.js';
import { formatNumber, formatPercent } from '../domain/money.js';
import { money, signClass, modeLabel, emptyState } from './shared.js';
import { openTradeForm } from './form.js';

let curveKind = null; // 'money' | 'pips' | 'outcome' (choix manuel de l'utilisateur)

function kpi(label, value, { hint, cls = '' } = {}) {
  return h('div', { class: 'kpi' },
    h('div', { class: 'kpi-label' }, label),
    h('div', { class: `kpi-value ${cls}` }, value),
    hint ? h('div', { class: 'kpi-hint' }, hint) : null,
  );
}

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const BACKUP_REMINDER_DAYS = 30;

export function render(root) {
  const { settings } = state;
  const mode = settings.mode;
  const trades = tradesOf(mode);
  const capital = settings.initialCapital[mode] ?? 0;
  const s = summarize(trades, settings, capital);
  const page = h('div', { class: 'page' });
  root.append(page);

  // Rappel de sauvegarde : les données ne vivent que dans ce navigateur.
  const anyTrades = state.trades.length > 0;
  const days = (Date.now() - (settings.lastBackupAt || 0)) / 86400000;
  if (anyTrades && days > BACKUP_REMINDER_DAYS) {
    page.append(h('div', { class: 'banner', role: 'note' },
      h('span', {}, settings.lastBackupAt
        ? `Dernière sauvegarde il y a ${Math.floor(days)} jours. Tes données restent uniquement dans ce navigateur.`
        : 'Tu n’as jamais exporté de sauvegarde. Tes données restent uniquement dans ce navigateur.'),
      h('a', { href: '#/settings', class: 'btn small' }, 'Sauvegarder'),
    ));
  }

  if (trades.length === 0) {
    page.append(emptyState({
      title: `Aucun trade ${mode === 'reel' ? 'réel' : 'en backtest'} pour l’instant`,
      text: 'Ajoute ton premier trade, ou importe ton journal Excel depuis les réglages.',
      actionLabel: 'Ajouter un trade',
      onAction: () => openTradeForm(null),
    }));
    return;
  }

  // ---- Indicateurs clés
  const m = s.money;
  page.append(h('div', { class: 'kpis' },
    kpi('Trades terminés', String(s.completed), { hint: s.open ? `${s.open} en cours` : `${plural(s.wins, 'gagnant')} · ${plural(s.losses, 'perdant')}` }),
    kpi('Taux de réussite', formatPercent(s.winRate, 1), { hint: `${plural(s.wins, 'gagnant')} · ${plural(s.losses, 'perdant')}${s.breakeven ? ` · ${plural(s.breakeven, 'égalité')}` : ''}` }),
    kpi('Résultat net', m.total === null ? '—' : money(m.total, settings, { sign: true }), {
      cls: signClass(m.total),
      hint: m.total === null ? 'Saisis un montant, ou des pips et des lots' : m.estimatedCount ? `dont ${m.estimatedCount} estimé(s)` : `sur ${m.coverage.with} trade(s)`,
    }),
    kpi('Pips', s.pips.total === null ? '—' : formatNumber(s.pips.total, { sign: true }), {
      cls: signClass(s.pips.total),
      hint: s.pips.total === null ? 'Aucun pip saisi' : `saisis sur ${s.pips.coverage.with}/${s.pips.coverage.of} trades`,
    }),
    kpi('Profit factor', m.profitFactor === null ? '—' : m.profitFactor === Infinity ? '∞' : formatNumber(m.profitFactor, { digits: 2 }), { hint: 'gains bruts ÷ pertes brutes' }),
    kpi('Drawdown max', m.drawdown ? money(m.drawdown.amount > 0 ? -m.drawdown.amount : 0, settings) : '—', {
      cls: m.drawdown && m.drawdown.amount > 0 ? 'loss' : '',
      hint: m.drawdown?.pct != null ? `${formatPercent(m.drawdown.pct, 1)} depuis le sommet` : 'sur la courbe d’équité',
    }),
  ));

  // ---- Courbe
  const hasEquity = s.curves.equity.length > 0;
  const hasPips = s.curves.pips.length > 0;
  const options = [
    ['money', 'Argent', hasEquity],
    ['pips', 'Pips', hasPips],
    ['outcome', 'Résultats +1/−1', s.curves.outcome.length > 0],
  ];
  const available = options.filter((o) => o[2]).map((o) => o[0]);
  const kind = available.includes(curveKind) ? curveKind : available[0];

  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Type de courbe' },
    options.map(([key, label, ok]) => h('button', {
      type: 'button', 'aria-pressed': String(key === kind), disabled: !ok,
      onClick: () => { curveKind = key; root.replaceChildren(); render(root); },
    }, label)));

  let chart = null;
  let note = '';
  if (kind === 'money') {
    const pts = s.curves.equity.map((p) => ({ label: p.date, value: p.value }));
    if (capital !== 0) pts.unshift({ label: 'Départ', value: capital });
    chart = lineChart(pts, { format: (v) => money(v, settings, { digits: 0 }), ariaLabel: `Courbe d’équité (${modeLabel(mode)})`, includeZero: capital === 0 });
    const missing = s.completed - m.coverage.with;
    note = missing > 0 ? `${missing} trade(s) sans montant ne figurent pas sur cette courbe.` : '';
    if (m.estimatedCount) note += ` ${m.estimatedCount} montant(s) sont des estimations (pips × lots × valeur du pip).`;
  } else if (kind === 'pips') {
    chart = lineChart(s.curves.pips.map((p) => ({ label: p.date, value: p.value })), { format: (v) => formatNumber(v), ariaLabel: `Courbe cumulée en pips (${modeLabel(mode)})` });
    const missing = s.pips.coverage.of - s.pips.coverage.with;
    note = missing > 0 ? `Les pips ne sont renseignés que sur ${s.pips.coverage.with} trade(s) sur ${s.pips.coverage.of} : la courbe est incomplète.` : '';
  } else if (kind === 'outcome') {
    chart = lineChart(s.curves.outcome.map((p) => ({ label: p.date, value: p.value })), { format: (v) => formatNumber(v), ariaLabel: `Courbe des résultats (${modeLabel(mode)})` });
    note = '+1 par trade gagnant, −1 par trade perdant : montre les séries sans tenir compte de la taille des gains.';
  }
  page.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Évolution'), seg),
    chart ?? h('p', { class: 'muted' }, 'Pas assez de données pour tracer une courbe.'),
    note ? h('p', { class: 'card-note' }, note.trim()) : null,
  ));

  // ---- Gagnants / perdants par scénario + détails
  const rows = s.byScenario.map((g) => ({ label: g.key.replace(/^Sc[ée]nario\s*/i, 'S'), wins: g.wins, losses: g.losses }));
  const detail = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Détails')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'data' }, h('tbody', {},
      row('Gain moyen', m.avgWin === null ? (s.pips.avgWin === null ? '—' : `${formatNumber(s.pips.avgWin, { sign: true })} pips`) : money(m.avgWin, settings, { sign: true })),
      row('Perte moyenne', m.avgLoss === null ? (s.pips.avgLoss === null ? '—' : `${formatNumber(s.pips.avgLoss, { sign: true })} pips`) : money(m.avgLoss, settings, { sign: true })),
      row('Espérance par trade', m.expectancy === null ? (s.pips.expectancy === null ? '—' : `${formatNumber(s.pips.expectancy, { sign: true, digits: 1 })} pips`) : money(m.expectancy, settings, { sign: true })),
      row('Espérance en R', s.r.expectancy === null ? '— (risque non saisi)' : `${formatNumber(s.r.expectancy, { sign: true, digits: 2 })} R`),
      row('Meilleure série', `${s.streaks.maxWin} gagnant(s)`),
      row('Pire série', `${s.streaks.maxLoss} perdant(s)`),
      row('Série en cours', s.streaks.current.type ? `${s.streaks.current.count} ${s.streaks.current.type.toLowerCase()}(s)` : '—'),
    ))),
  );
  page.append(h('div', { class: 'grid-2' },
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Gagnants et perdants par scénario'),
        h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'l-win' }), 'Gagnants'), h('span', {}, h('i', { class: 'l-loss' }), 'Perdants'))),
      rows.length ? stackedBars(rows, { ariaLabel: `Gagnants et perdants par scénario (${modeLabel(mode)})` }) : h('p', { class: 'muted' }, 'Aucun scénario renseigné.'),
    ),
    detail,
  ));

  // ---- Comparaison Backtest / Réel
  const both = ['backtest', 'reel'].map((k) => ({ k, s: summarize(tradesOf(k), settings, settings.initialCapital[k] ?? 0) }));
  const cmp = (label, fn) => h('tr', {}, h('th', { scope: 'row' }, label), both.map(({ s: x }) => h('td', { class: 'r num' }, fn(x))));
  page.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Backtest et réel côte à côte')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), both.map(({ k }) => h('th', { class: 'r' }, modeLabel(k))))),
      h('tbody', {},
        cmp('Trades terminés', (x) => String(x.completed)),
        cmp('Taux de réussite', (x) => formatPercent(x.winRate, 1)),
        cmp('Pips', (x) => (x.pips.total === null ? '—' : formatNumber(x.pips.total, { sign: true }))),
        cmp('Résultat net', (x) => (x.money.total === null ? '—' : money(x.money.total, settings, { sign: true }))),
        cmp('Profit factor', (x) => (x.money.profitFactor === null ? '—' : x.money.profitFactor === Infinity ? '∞' : formatNumber(x.money.profitFactor, { digits: 2 }))),
        cmp('Règles respectées', (x) => formatPercent(x.completed ? x.discipline.followed.total / x.completed : null)),
      ),
    )),
    h('p', { class: 'card-note' }, 'Le réel doit tendre vers le backtest. Un écart marqué du taux de réussite avec peu de trades reste peu significatif.'),
  ));
}

function row(label, value) {
  return h('tr', {}, h('th', { scope: 'row', style: 'text-transform:none;letter-spacing:0;font-size:0.92rem;color:var(--muted)' }, label), h('td', { class: 'r num' }, value));
}
