/**
 * Registre des écrans. Pour ajouter une page à EasyJournal :
 *   1. créer js/views/ma-page.js qui exporte render(root) ;
 *   2. ajouter UNE ligne ci-dessous. La navigation (ordinateur et mobile) se met à jour toute seule.
 * live: true  -> l'écran est redessiné à chaque changement de données.
 * live: false -> l'écran gère lui-même son redessin (formulaires de réglages).
 */
import * as dashboard from './views/dashboard.js';
import * as trades from './views/trades.js';
import * as analysis from './views/analysis.js';
import * as ideas from './views/ideas.js';
import * as settings from './views/settings.js';

export const ROUTES = [
  { id: 'dashboard', path: '/', label: 'Tableau de bord', short: 'Accueil', icon: 'dashboard', view: dashboard, live: true },
  { id: 'trades', path: '/trades', label: 'Journal', short: 'Journal', icon: 'list', view: trades, live: true },
  { id: 'analysis', path: '/analysis', label: 'Analyse', short: 'Analyse', icon: 'chart', view: analysis, live: true },
  { id: 'ideas', path: '/ideas', label: 'Idées', short: 'Idées', icon: 'bulb', view: ideas, live: true },
  { id: 'settings', path: '/settings', label: 'Réglages', short: 'Réglages', icon: 'gear', view: settings, live: false },
];
