import { useEffect, useState, useCallback } from 'react';
import { fetchFmpEvents } from './core/calendar/fmp.js';
import { demoEvents } from './core/calendar/demo.js';
import { readCache, writeCache, getApiKey, isDemoCalendar } from './core/calendar/cache.js';

/** Charge les annonces de la période. status : loading | ok | nokey | error. */
export function useCalendar(from, to, reloadToken = 0) {
  const [s, setS] = useState({ status: 'loading', events: [], error: null, demo: false });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => { try { Object.keys(localStorage).filter((k) => k.startsWith('easyjournal.cal.')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } setTick((t) => t + 1); }, []);

  useEffect(() => {
    if (isDemoCalendar()) { setS({ status: 'ok', events: demoEvents(from), error: null, demo: true }); return; }
    const key = getApiKey();
    if (!key) { setS({ status: 'nokey', events: [], error: null, demo: false }); return; }
    const cached = readCache(from, to);
    if (cached) { setS({ status: 'ok', events: cached, error: null, demo: false }); return; }
    const ctl = new AbortController();
    setS((x) => ({ ...x, status: 'loading', error: null }));
    fetchFmpEvents({ from, to, key, signal: ctl.signal })
      .then((events) => { writeCache(from, to, events); setS({ status: 'ok', events, error: null, demo: false }); })
      .catch((e) => { if (e?.name !== 'AbortError') setS({ status: 'error', events: [], error: e, demo: false }); });
    return () => ctl.abort();
  }, [from, to, tick, reloadToken]);

  return { ...s, refresh };
}
