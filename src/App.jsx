import { useEffect, useState, useCallback } from 'react';
import { useStore, init, saveSettings } from './store.js';
import Logo from './components/Logo.jsx';
import TradeForm from './components/TradeForm.jsx';
import { Toasts } from './components/toast.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Journal from './pages/Journal.jsx';
import Analysis from './pages/Analysis.jsx';
import Ideas from './pages/Ideas.jsx';
import Calendar from './pages/Calendar.jsx';
import Settings from './pages/Settings.jsx';
import { MODE_LABELS } from './core/domain/trade.js';

const ROUTES = [
  { path: '/', title: 'Tableau de bord', short: 'Accueil', icon: '▦', Page: Dashboard },
  { path: '/trades', title: 'Journal', icon: '☰', Page: Journal },
  { path: '/analysis', title: 'Analyse', icon: '▥', Page: Analysis },
  { path: '/ideas', title: 'Idées', icon: '✦', Page: Ideas },
  { path: '/calendar', title: 'Calendrier', short: 'Calendrier', icon: '◷', Page: Calendar },
  { path: '/settings', title: 'Réglages', icon: '⚙', Page: Settings, hidden: true },
];

const useHashRoute = () => {
  const get = () => location.hash.replace(/^#/, '') || '/';
  const [path, setPath] = useState(get);
  useEffect(() => { const f = () => { setPath(get()); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return path;
};

export default function App() {
  const state = useStore();
  const path = useHashRoute();
  const [form, setForm] = useState(null); // { trade } ; trade = null → nouveau
  const [err, setErr] = useState(null);

  useEffect(() => { init().catch((e) => { console.error(e); setErr(e.message); }); }, []);
  const openNew = useCallback(() => setForm({ trade: null }), []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); openNew(); } };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [openNew]);

  const route = ROUTES.find((r) => r.path === path) ?? ROUTES[0];
  const { Page } = route;
  if (err) return <main style={{ padding: 24 }}><h1>Erreur de chargement</h1><p>{err}</p></main>;
  if (!state.ready) return null;
  const mode = state.settings.mode;

  return (
    <>
      <div className="bg" aria-hidden="true"><i /><i /><i /></div>
      <a className="skip" href="#main">Aller au contenu</a>
      <div className="app">
        <aside>
          <div className="brand"><Logo size={32} /><span>Easy<b>Journal</b></span></div>
          <nav className="side" aria-label="Navigation principale">{ROUTES.filter((r) => !r.hidden).map((r) => <a key={r.path} href={`#${r.path}`} className={r === route ? 'on' : ''} aria-current={r === route ? 'page' : undefined}><span aria-hidden="true">{r.icon}</span>{r.title}</a>)}</nav>
          <div className="hint">Raccourci : <kbd>n</kbd> = nouveau trade</div>
        </aside>
        <main id="main" tabIndex={-1}>
          <div className="mobilebrand"><Logo size={26} /><span>EasyJournal</span></div>
          <header className="top">
            <h1><small>Mode {MODE_LABELS[mode]} · {state.settings.currency}</small>{route.title}</h1>
            <div className="actions">
              <div className="seg" role="group" aria-label="Mode">{['reel', 'backtest'].map((m) => <button key={m} className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => saveSettings({ mode: m })}>{MODE_LABELS[m]}</button>)}</div>
              <button className="btn primary" onClick={openNew}>+ Nouveau trade</button>
              <a className={`btn gear ${route.path === '/settings' ? 'on' : ''}`} href="#/settings" aria-label="Réglages" title="Réglages">⚙</a>
            </div>
          </header>
          <Page key={route.path + mode} state={state} onNew={openNew} onEdit={(trade) => setForm({ trade })} />
        </main>
      </div>
      <nav className="tabbar" aria-label="Navigation mobile">{ROUTES.filter((r) => !r.hidden).map((r) => <a key={r.path} href={`#${r.path}`} className={r === route ? 'on' : ''}><b aria-hidden="true">{r.icon}</b>{r.short ?? r.title}</a>)}</nav>
      {form && <TradeForm key={form.trade?.id ?? 'new'} trade={form.trade} settings={state.settings} onClose={() => setForm(null)} />}
      <Toasts />
    </>
  );
}
