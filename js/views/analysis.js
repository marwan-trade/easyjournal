import { h } from '../components/ui.js';
import { state, tradesOf } from '../store/state.js';
import { summarize } from '../domain/stats.js';
import { formatPercent } from '../domain/money.js';
import { RESULTS } from '../domain/trade.js';
import { breakdownCard, emptyState, resultBadge } from './shared.js';
import { openTradeForm } from './form.js';
import { formatDate } from './trades.js';

const SMALL_SAMPLE = 20;

export function render(root) {
  const { settings } = state;
  const trades = tradesOf(settings.mode);
  const page = h('div', { class: 'page' });
  root.append(page);
  const s = summarize(trades, settings, settings.initialCapital[settings.mode] ?? 0);

  if (s.completed === 0) {
    page.append(emptyState({ title: 'Pas encore de quoi analyser', text: 'Ajoute des trades terminés (gagnant ou perdant) pour voir ta discipline et tes points forts.' }));
    return;
  }

  // ---- Discipline
  const { followed, broken, unknown } = s.discipline;
  const box = (title, d) => h('div', { class: 'stat-box' },
    h('div', { class: 'kpi-label' }, title),
    h('div', { class: 'big num' }, d.total ? formatPercent(d.winRate, 0) : '—'),
    h('div', { class: 'kpi-hint' }, d.total ? `${d.wins} gagnants · ${d.losses} perdants (${d.total} trades)` : 'Aucun trade'),
  );
  let verdict = 'Renseigne « Règles respectées ? » sur tes trades pour comparer.';
  if (followed.winRate !== null && broken.winRate !== null) {
    const gap = Math.round((followed.winRate - broken.winRate) * 100);
    verdict = gap > 0
      ? `Quand tu respectes tes règles, ton taux de réussite est supérieur de ${gap} points.`
      : gap < 0
        ? `Tes trades hors règles ont un meilleur taux de ${-gap} points : à surveiller, mais regarde aussi la taille des gains.`
        : 'Aucun écart de taux de réussite entre trades dans les règles et hors règles.';
    if (followed.total + broken.total < SMALL_SAMPLE) verdict += ` Échantillon de ${followed.total + broken.total} trades seulement : indicatif.`;
  }
  page.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Discipline')),
    h('div', { class: 'stat-pair' }, box('Règles respectées', followed), box('Règles non respectées', broken)),
    h('p', { class: 'card-note' }, verdict),
    unknown.total ? h('p', { class: 'card-note' }, `${unknown.total} trade(s) sans réponse à « Règles respectées ? » ne sont pas comptés ici.`) : null,
  ));

  // ---- Répartitions
  page.append(h('div', { class: 'grid-2' },
    breakdownCard('Par scénario', s.byScenario, settings, { labelHeader: 'Scénario' }),
    breakdownCard('Par timeframe de confirmation', s.byTimeframe, settings, { labelHeader: 'Timeframe' }),
    breakdownCard('Par paire', s.byPair, settings, { labelHeader: 'Paire' }),
    breakdownCard('Par jour de la semaine', s.byWeekday, settings, { labelHeader: 'Jour', labelOf: (r) => r.label }),
  ));

  // ---- Trades hors règles
  const broke = trades.filter((t) => t.rulesFollowed === false).sort((a, b) => (a.date < b.date ? 1 : -1));
  page.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Trades hors règles, à relire')),
    broke.length === 0
      ? h('p', { class: 'muted' }, 'Aucun trade marqué hors règles.')
      : h('ul', { class: 'list' }, broke.map((t) => h('li', { class: 'list-item' },
          h('div', {},
            h('div', {}, h('strong', {}, `${formatDate(t.date)} · ${t.pair}`), ' ', t.scenario ? h('span', { class: 'muted' }, `· ${t.scenario}`) : null, ' ', RESULTS.includes(t.result) ? resultBadge(t.result) : null),
            t.notes ? h('p', { class: 'muted', style: 'margin-top:4px' }, t.notes) : null,
          ),
          h('button', { class: 'btn small', type: 'button', onClick: () => openTradeForm(t) }, 'Ouvrir'),
        ))),
  ));
}
