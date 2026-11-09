/** Applique le thème choisi : 'auto' suit l'appareil, 'light' / 'dark' forcent. */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  const dark = theme === 'dark' || (theme !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0b0c' : '#c8102e');
  const logo = document.getElementById('brand-logo');
  if (logo) logo.setAttribute('src', dark ? 'assets/logo-dark.svg' : 'assets/logo-light.svg');
}
