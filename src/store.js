import { useSyncExternalStore } from 'react';
import { state, subscribe, init } from './core/store/state.js';

// Compteur de version : change à chaque modification de l'état, ce qui déclenche le rendu React.
let version = 0;
subscribe(() => { version += 1; });
const sub = (cb) => subscribe(cb);

export function useStore() {
  useSyncExternalStore(sub, () => version);
  return state;
}
export { init };
export * from './core/store/state.js';
