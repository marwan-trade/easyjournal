import { useEffect, useState, useCallback } from 'react';
import { useStore, init, saveSettings } from './store.js';
import Logo from './components/Logo.jsx';
import TradeForm from './components/TradeForm.jsx';
import { Toasts } from './components/toast.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Journal from './pages/Journal.jsx';
import Analysis from './pages/Analysis.jsx';
import Ideas from './pages/Ideas.jsx';
import Profile from './pages/Profile.jsx';
import TradeDetail from './components/TradeDetail.jsx';
import AuthPage from './components/AuthPage.jsx';
import DepositGate from './components/DepositGate.jsx';
import ProfileMenu from './components/ProfileMenu.jsx';
import { startAutoSync, useSyncStatus, signOut } from './sync.js';
import { MODE_LABELS } from './core/domain/trade.js';

const ROUTES = [
  { path: '/', title: 'Tableau de bord', short: 'Accueil', icon: '▦', Page: Dashboard },
  { path: '/trades', title: 'Journal', icon: '☰', Page: Journal },
  { path: '/analysis', title: 'Analyse', icon: '▥', Page: Analysis },
  { path: '/ideas', title: 'Idées', icon: '✦', Page: Ideas },
  { path: '/profile', title: 'Profil', icon: '◉', Page: Profile, hidden: true },
];

const useHashRoute = () => {
  const get = () => location.hash.replace(/^#/, '') || '/';
  const [path, setPath] = useState(get);
  useEffect(() => { const f = () => { setPath(get()); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return path;
};

export default function App() {
  const state = useStore();
  const sync = useSyncStatus();
  const path = useHashRoute();
  const [form, setForm] = useState(null); // { trade } ; trade = null → nouveau
  const [err, setErr] = useState(null);
  const [navOpen, setNavOpen] = useState(() => { try { return localStorage.getItem('easyjournal.nav') !== '0'; } catch { return true; } });
  const toggleNav = () => setNavOpen((o) => { try { localStorage.setItem('easyjournal.nav', o ? '0' : '1'); } catch { /* ignoré */ } return !o; });
  const [guest, setGuest] = useState(() => { try { return localStorage.getItem('easyjournal.guest') === '1'; } catch { return false; } });
  const [skipDeposit, setSkipDeposit] = useState(() => { try { return localStorage.getItem('easyjournal.skipDeposit') === '1'; } catch { return false; } });
  const leaveGuest = () => { try { localStorage.removeItem('easyjournal.guest'); } catch { /* ignoré */ } setGuest(false); };
  const logout = async () => { try { await signOut(); } catch (e) { console.error(e); } leaveGuest(); window.location.hash = '#/'; };
  const continueAsGuest = () => { try { localStorage.setItem('easyjournal.guest', '1'); } catch { /* ignoré */ } setGuest(true); };

  useEffect(() => { init().then(() => startAutoSync()).catch((e) => { console.error(e); setErr(e.message); }); }, []);
  const openNew = useCallback(() => setForm({ trade: null }), []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); openNew(); } };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [openNew]);

  const route = ROUTES.find((r) => r.path === (path === '/settings' ? '/profile' : path)) ?? ROUTES[0];
  const { Page } = route;
  if (err) return <main style={{ padding: 24 }}><h1>Erreur de chargement</h1><p>{err}</p></main>;
  if (!state.ready) return null;
  if (sync.configured && !sync.signedIn && !guest) return <><div className="bg" aria-hidden="true"><i /><i /><i /></div><AuthPage onGuest={continueAsGuest} /><Toasts /></>;
  const mode = state.settings.mode;
  const needsDeposit = !((state.settings.initialCapital[mode] || 0) > 0) && !skipDeposit; // dépôt demandé, mais on peut passer
  if (needsDeposit) return <><div className="bg" aria-hidden="true"><i /><i /><i /></div><DepositGate settings={state.settings} onSkip={() => { try { localStorage.setItem('easyjournal.skipDeposit', '1'); } catch { /* ignoré */ } setSkipDeposit(true); }} onGuestLogout={sync.signedIn ? logout : null} /><Toasts /></>;

  return (
    <>
      <div className="bg" aria-hidden="true"><i /><i /><i /></div>
      <a className="skip" href="#main">Aller au contenu</a>
      <div className={`app${navOpen ? '' : ' navclosed'}`}>
        <aside>
          <div className="brand"><Logo size={32} /><span className="lbl">Easy<b>Journal</b></span></div>
          <nav className="side" id="main-nav" aria-label="Navigation principale">{ROUTES.filter((r) => !r.hidden).map((r) => <a key={r.path} href={`#${r.path}`} className={r === route ? 'on' : ''} aria-current={r === route ? 'page' : undefined}><span aria-hidden="true">{r.icon}</span><span className="lbl">{r.title}</span></a>)}</nav>
          <div className="hint lbl">Raccourci : <kbd>n</kbd> = nouveau trade</div>
        </aside>
        <main id="main" tabIndex={-1}>
          <div className="mobilebrand"><Logo size={26} /><span>EasyJournal</span></div>
          {!((state.settings.initialCapital[mode] || 0) > 0) && <div className="remind" role="status"><span><b>Dépôt manquant.</b> Écris l'argent mis sur ton compte : sans lui, ton argent actuel et tes gains ne s'affichent pas.</span><button type="button" className="btn primary" onClick={() => { try { localStorage.removeItem('easyjournal.skipDeposit'); } catch { /* ignoré */ } setSkipDeposit(false); }}>Écrire mon dépôt</button></div>}
          <header className="top">
            <div className="tl"><button type="button" className="navtoggle" onClick={toggleNav} aria-expanded={navOpen} aria-controls="main-nav" aria-label={navOpen ? 'Fermer le menu' : 'Ouvrir le menu'} title={navOpen ? 'Fermer le menu' : 'Ouvrir le menu'}>{navOpen ? '«' : '»'}</button><h1><small>{state.settings.backtest ? `Mode ${MODE_LABELS[mode]} · ` : ''}{state.settings.currency}</small>{route.title}</h1></div>
            <div className="actions">
              {state.settings.backtest && <div className="seg" role="group" aria-label="Mode">{['reel', 'backtest'].map((m) => <button key={m} className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => saveSettings({ mode: m })}>{MODE_LABELS[m]}</button>)}</div>}
              <button className="btn primary" onClick={openNew}>+ Nouveau trade</button>
              <ProfileMenu email={sync.email} signedIn={sync.signedIn} onSignOut={logout} onSignIn={leaveGuest} />
            </div>
          </header>
          <Page key={route.path + mode} state={state} onNew={openNew} onEdit={(trade) => setForm({ trade, view: true })} />
        </main>
      </div>
      <nav className="tabbar" aria-label="Navigation mobile">{ROUTES.filter((r) => !r.hidden).map((r) => <a key={r.path} href={`#${r.path}`} className={r === route ? 'on' : ''}><b aria-hidden="true">{r.icon}</b>{r.short ?? r.title}</a>)}</nav>
      {form && form.view && <TradeDetail key={`d${form.trade.id}`} trade={state.trades.find((x) => x.id === form.trade.id) ?? form.trade} settings={state.settings} onEdit={() => setForm({ trade: form.trade })} onClose={() => setForm(null)} />}
      {form && !form.view && <TradeForm key={form.trade?.id ?? 'new'} trade={form.trade ? (state.trades.find((x) => x.id === form.trade.id) ?? form.trade) : null} settings={state.settings} onClose={() => setForm(null)} />}
      <Toasts />
    </>
  );
}
