import { h, icon, confirmDialog, toast, downloadFile, openDialog } from '../components/ui.js';
import { state, tradesOf, deleteTrade } from '../store/state.js';
import { RESULTS, SIDES } from '../domain/trade.js';
import { effectivePnl, formatNumber } from '../domain/money.js';
import { signedPips } from '../domain/trade.js';
import { stringifyCSV } from '../io/csv.js';
import { tradesToRows } from '../io/mapping.js';
import { money, signClass, resultBadge, emptyState } from './shared.js';
import { openTradeForm } from './form.js';

// Les filtres survivent aux changements de mode et de page.
const filters = { q: '', pair: '', scenario: '', side: '', result: '', from: '', to: '' };

function applyFilters(trades) {
  const q = filters.q.trim().toLowerCase();
  return trades
    .filter((t) =>
      (!filters.pair || t.pair === filters.pair) &&
      (!filters.scenario || t.scenario === filters.scenario) &&
      (!filters.side || t.side === filters.side) &&
      (!filters.result || (filters.result === '__open' ? !t.result : t.result === filters.result)) &&
      (!filters.from || t.date >= filters.from) &&
      (!filters.to || t.date <= filters.to) &&
      (!q || `${t.notes} ${t.tags.join(' ')} ${t.pair} ${t.timeframe} ${t.scenario}`.toLowerCase().includes(q)))
    .sort((a, b) => (a.date === b.date ? (b.createdAt ?? 0) - (a.createdAt ?? 0) : a.date < b.date ? 1 : -1));
}

export function render(root) {
  const { settings } = state;
  const all = tradesOf(settings.mode);
  const page = h('div', { class: 'page' });
  root.append(page);

  if (all.length === 0) {
    page.append(emptyState({
      title: 'Ton journal est vide',
      text: 'Ajoute un trade, ou importe ton Excel depuis les réglages.',
      actionLabel: 'Ajouter un trade',
      onAction: () => openTradeForm(null),
    }));
    return;
  }

  const pairs = [...new Set(all.map((t) => t.pair))].sort();
  const scenarios = [...new Set(all.map((t) => t.scenario).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));

  const tableHost = h('div');
  const count = h('p', { class: 'muted', 'aria-live': 'polite' });

  const paint = () => {
    const rows = applyFilters(all);
    count.textContent = `${rows.length} trade(s) affiché(s) sur ${all.length}`;
    tableHost.replaceChildren(rows.length === 0
      ? h('p', { class: 'muted', style: 'padding:16px 0' }, 'Aucun trade ne correspond à ces filtres.')
      : table(rows, settings));
  };

  const bind = (key, el) => {
    el.value = filters[key];
    const ev = el.tagName === 'INPUT' && el.type === 'search' ? 'input' : 'change';
    el.addEventListener(ev, () => { filters[key] = el.value; paint(); });
    return el;
  };
  const sel = (label, key, options, id) => h('div', { class: 'field' },
    h('label', { for: id }, label),
    bind(key, h('select', { id }, h('option', { value: '' }, 'Tous'), options.map(([v, l]) => h('option', { value: v }, l)))));
  const inp = (label, key, type, id) => h('div', { class: 'field' }, h('label', { for: id }, label), bind(key, h('input', { id, type })));

  page.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', {}, 'Filtres'),
      h('div', { style: 'display:flex;gap:8px' },
        h('button', { class: 'btn small', type: 'button', onClick: () => { Object.keys(filters).forEach((k) => { filters[k] = ''; }); root.replaceChildren(); render(root); } }, 'Réinitialiser'),
        h('button', { class: 'btn small', type: 'button', onClick: () => exportCurrent(all, settings) }, icon('download'), 'Exporter CSV'),
      ),
    ),
    h('div', { class: 'filters' },
      inp('Recherche', 'q', 'search', 'f-q'),
      sel('Paire', 'pair', pairs.map((p) => [p, p]), 'f-pair'),
      sel('Scénario', 'scenario', scenarios.map((p) => [p, p]), 'f-sc'),
      sel('Sens', 'side', SIDES.map((p) => [p, p]), 'f-side'),
      sel('Résultat', 'result', [...RESULTS.map((r) => [r, r]), ['__open', 'En cours']], 'f-res'),
      inp('Du', 'from', 'date', 'f-from'),
      inp('Au', 'to', 'date', 'f-to'),
    ),
  ));
  page.append(h('section', { class: 'card' }, count, tableHost));
  paint();
}

function exportCurrent(trades, settings) {
  const csv = stringifyCSV(tradesToRows(applyFilters(trades), settings.customFields));
  const name = `easyjournal-${settings.mode}-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(name, csv, 'text/csv');
  toast('Export CSV prêt (les filtres actifs sont appliqués).');
}

function table(rows, settings) {
  const cf = settings.customFields;
  const th = (t, cls = '') => h('th', { class: cls }, t);
  return h('div', { class: 'table-wrap' }, h('table', { class: 'data stack journal' },
    h('thead', {}, h('tr', {},
      th('Date'), th('Paire'), th('Scénario'), th('Sens'), th('Timeframe'), th('Résultat'), th('Règles'),
      th('RR', 'r'), th('Pips', 'r'), th('Lots', 'r'), th('Résultat net', 'r'),
      ...cf.map((c) => th(c.label)),
      th('Notes'), th('', 'r'),
    )),
    h('tbody', {}, rows.map((t) => {
      const p = effectivePnl(t, settings);
      const pips = signedPips(t);
      const td = (label, content, cls = '') => h('td', { class: cls, 'data-label': label }, content);
      return h('tr', {},
        td('Date', formatDate(t.date)),
        td('Paire', t.pair),
        td('Scénario', t.scenario || '—'),
        td('Sens', t.side || '—'),
        td('Timeframe', t.timeframe || '—'),
        td('Résultat', resultBadge(t.result)),
        td('Règles', t.rulesFollowed === true ? 'Oui' : t.rulesFollowed === false ? 'Non' : '—'),
        td('RR', t.rr === null ? '—' : `1:${formatNumber(t.rr, { digits: 2 })}`, 'r num'),
        td('Pips', pips === null ? '—' : formatNumber(pips, { sign: true }), `r num ${signClass(pips)}`),
        td('Lots', t.lots === null ? '—' : formatNumber(t.lots, { digits: 2 }), 'r num'),
        td('Résultat net', p ? [money(p.value, settings, { sign: true }), p.estimated ? h('span', { class: 'est', title: 'Estimation pips × lots × valeur du pip' }, ' ≈') : null] : '—', `r num ${p ? signClass(p.value) : ''}`),
        ...cf.map((c) => td(c.label, t.custom?.[c.key] ?? '—')),
        td('Notes', t.notes ? h('div', { class: 'cell-notes', title: t.notes }, t.notes) : '—'),
        h('td', { class: 'actions-cell' }, h('div', { class: 'row-actions' },
          t.screenshot ? h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': 'Voir la capture', title: 'Voir la capture', onClick: () => openDialog({ title: `Capture · ${t.pair} ${formatDate(t.date)}`, body: h('img', { src: t.screenshot, alt: 'Capture du graphique', style: 'max-width:100%;border-radius:8px' }) }) }, icon('search')) : null,
          h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': `Modifier le trade du ${formatDate(t.date)} ${t.pair}`, onClick: () => openTradeForm(t) }, icon('edit')),
          h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': `Supprimer le trade du ${formatDate(t.date)} ${t.pair}`, onClick: async () => {
            const ok = await confirmDialog({ title: 'Supprimer ce trade ?', message: `${formatDate(t.date)} · ${t.pair}. Cette action est définitive.`, confirmLabel: 'Supprimer', danger: true });
            if (ok) { await deleteTrade(t.id); toast('Trade supprimé.'); }
          } }, icon('trash')),
        )),
      );
    })),
  ));
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
