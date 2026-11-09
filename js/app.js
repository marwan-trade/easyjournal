import { h, icon, toast } from './components/ui.js';
import { init, state, subscribe, saveSettings } from './store/state.js';
import { ROUTES } from './routes.js';
import { applyTheme } from './app-theme.js';
import { openTradeForm } from './views/form.js';
import { MODE_LABELS } from './domain/trade.js';

const main = document.getElementById('main');
const nav = document.getElementById('nav');
const tabbar = document.getElementById('tabbar');
const modeHost = document.getElementById('mode-host');
const titleEl = document.getElementById('page-title');
const addBtn = document.getElementById('add-trade');

const currentRoute = () => {
  const path = location.hash.replace(/^#/, '') || '/';
  return ROUTES.find((r) => r.path === path) ?? ROUTES[0];
};

function paintNav() {
  const cur = currentRoute();
  for (const host of [nav, tabbar]) {
    host.replaceChildren(...ROUTES.map((r) => h('a', { href: `#${r.path}`, 'aria-current': r.id === cur.id ? 'page' : null },
      icon(r.icon), h('span', {}, host === tabbar ? r.short : r.label))));
  }
  titleEl.textContent = cur.label;
  document.title = `${cur.label} · EasyJournal`;
}

function paintMode() {
  modeHost.replaceChildren(h('div', { class: 'seg', role: 'group', 'aria-label': 'Mode affiché' },
    Object.entries(MODE_LABELS).map(([v, l]) => h('button', {
      type: 'button', 'aria-pressed': String(state.settings.mode === v),
      onClick: () => saveSettings({ mode: v }),
    }, l))));
}

function renderRoute({ focus = false } = {}) {
  const route = currentRoute();
  main.replaceChildren();
  try {
    route.view.render(main);
  } catch (err) {
    console.error(err);
    main.replaceChildren(h('div', { class: 'card empty' }, h('h2', {}, 'Une erreur est survenue'),
      h('p', {}, 'Cet écran n’a pas pu s’afficher. Tes données ne sont pas touchées.'),
      h('button', { class: 'btn primary', type: 'button', onClick: () => location.reload() }, 'Recharger')));
  }
  if (!state.persistent && !document.getElementById('mem-warning')) {
    main.prepend(h('div', { id: 'mem-warning', class: 'banner', role: 'alert' }, 'Stockage permanent indisponible : tes données seront perdues à la fermeture. Exporte une sauvegarde depuis les réglages.'));
  }
  if (focus) { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}

let scheduled = false;
function onChange() {
  applyTheme(state.settings.theme);
  paintMode();
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    // Les écrans « live: false » se redessinent eux-mêmes, sauf si le mode affiché a changé.
    if (currentRoute().live || lastMode !== state.settings.mode) renderRoute();
    lastMode = state.settings.mode;
  });
}
let lastMode = null;

window.addEventListener('hashchange', () => { paintNav(); renderRoute({ focus: true }); });
addBtn.addEventListener('click', () => openTradeForm(null));

// Raccourci : « n » ouvre un nouveau trade quand on ne tape pas dans un champ.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
  const tag = document.activeElement?.tagName;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable) return;
  e.preventDefault();
  openTradeForm(null);
});

(async function boot() {
  try {
    await init();
  } catch (err) {
    console.error(err);
    main.replaceChildren(h('div', { class: 'card empty' }, h('h2', {}, 'Démarrage impossible'), h('p', {}, String(err.message || err))));
    return;
  }
  navigator.storage?.persist?.().catch(() => {}); // demande au navigateur de ne pas purger les données
  applyTheme(state.settings.theme);
  lastMode = state.settings.mode;
  paintNav();
  paintMode();
  renderRoute();
  subscribe(onChange);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(state.settings.theme));
})();
