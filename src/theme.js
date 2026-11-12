/** Thème : « auto » suit le réglage clair/sombre de l'appareil. Le choix est aussi gardé dans localStorage pour éviter un flash au chargement. */
const KEY = 'easyjournal.theme';
const COLORS = { light: '#f6f1e7', dark: '#0c0a09' };
let stop = null;

export function resolveTheme(pref, prefersDark) {
  return pref === 'light' || pref === 'dark' ? pref : prefersDark ? 'dark' : 'light';
}

function paint(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[theme]);
}

export function applyTheme(pref) {
  try { localStorage.setItem(KEY, pref); } catch { /* ignoré */ }
  if (stop) { stop(); stop = null; }
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  paint(resolveTheme(pref, mq ? mq.matches : true));
  if (pref === 'auto' && mq) {
    const on = () => paint(resolveTheme('auto', mq.matches));
    mq.addEventListener('change', on);
    stop = () => mq.removeEventListener('change', on);
  }
}
