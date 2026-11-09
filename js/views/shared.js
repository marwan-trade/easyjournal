import { h } from '../components/ui.js';
import { formatMoney, formatNumber, formatPercent } from '../domain/money.js';
import { MODE_LABELS } from '../domain/trade.js';

export const money = (v, settings, opts) => formatMoney(v, settings.currency, 'fr-FR', opts);
export const signClass = (v) => (v > 0 ? 'win' : v < 0 ? 'loss' : '');
export const modeLabel = (m) => MODE_LABELS[m] ?? m;

export function resultBadge(result) {
  if (result === 'Gagnant') return h('span', { class: 'badge win' }, 'Gagnant');
  if (result === 'Perdant') return h('span', { class: 'badge loss' }, 'Perdant');
  if (result === 'À égalité') return h('span', { class: 'badge be' }, 'À égalité');
  return h('span', { class: 'badge open' }, 'En cours');
}

export function rateBar(rate) {
  if (rate === null) return h('span', { class: 'muted' }, '—');
  return h('div', { class: 'rate' },
    h('div', { class: 'rate-bar', role: 'img', 'aria-label': `Taux de réussite ${formatPercent(rate)}` },
      h('span', { style: `width:${Math.round(rate * 100)}%` })),
    h('span', { class: 'num' }, formatPercent(rate)),
  );
}

export function emptyState({ title, text, actionLabel, onAction }) {
  return h('div', { class: 'card empty' },
    h('h2', {}, title),
    h('p', {}, text),
    actionLabel ? h('button', { class: 'btn primary', type: 'button', onClick: onAction }, actionLabel) : null,
  );
}

/** Tableau de répartition (par paire, timeframe, jour…). */
export function breakdownCard(title, rows, settings, { labelHeader = 'Groupe', labelOf = (r) => r.key, note } = {}) {
  const hasPips = rows.some((r) => r.pips !== null);
  const hasMoney = rows.some((r) => r.pnl !== null);
  const body = rows.length === 0
    ? h('p', { class: 'muted' }, 'Pas encore de trade terminé.')
    : h('div', { class: 'table-wrap' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {},
            h('th', {}, labelHeader), h('th', { class: 'r' }, 'Trades'), h('th', { class: 'r', title: 'Gagnants / perdants' }, 'G / P'),
            h('th', {}, 'Taux'),
            hasPips ? h('th', { class: 'r' }, 'Pips') : null,
            hasMoney ? h('th', { class: 'r' }, 'Net') : null,
          )),
          h('tbody', {}, rows.map((r) => h('tr', {},
            h('td', {}, labelOf(r)),
            h('td', { class: 'r num' }, r.total),
            h('td', { class: 'r num' }, h('span', { class: 'win' }, r.wins), ' / ', h('span', { class: 'loss' }, r.losses)),
            h('td', {}, rateBar(r.winRate)),
            hasPips ? h('td', { class: `r num ${signClass(r.pips)}` }, formatNumber(r.pips, { sign: true })) : null,
            hasMoney ? h('td', { class: `r num ${signClass(r.pnl)}` }, money(r.pnl, settings, { sign: true })) : null,
          ))),
        ),
      );
  return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, title)), body, note ? h('p', { class: 'card-note' }, note) : null);
}
