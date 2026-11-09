/** Événements FICTIFS pour voir la mise en page sans clé API. Marqués « démo » dans l'interface. */
import { makeEvent } from './events.js';

const TEMPLATE = [
  // [jour (0 = lundi), heure UTC, devise, titre, impact, prévu, précédent, réel]
  [0, '08:30', 'EUR', 'Confiance des investisseurs Sentix', 'low', '-8.0', '-9.2', '-7.6'],
  [0, '14:00', 'USD', 'Commandes de biens durables', 'medium', '0.5%', '0.2%', '0.7%'],
  [1, '09:00', 'EUR', 'Indice ZEW (sentiment économique)', 'medium', '12.5', '10.1', '13.4'],
  [1, '13:30', 'USD', 'Indice des prix à la consommation (CPI) a/a', 'high', '3.1%', '3.2%', '3.0%'],
  [2, '09:30', 'GBP', 'Ventes au détail m/m', 'medium', '0.3%', '-0.1%', '0.4%'],
  [2, '13:30', 'CAD', 'Variation de l\'emploi', 'high', '15K', '22K', '9K'],
  [2, '19:00', 'USD', 'Décision de taux de la Fed (FOMC)', 'high', '4.50%', '4.50%', '4.50%'],
  [3, '00:30', 'AUD', 'Taux de chômage', 'medium', '4.1%', '4.1%', '4.2%'],
  [3, '12:30', 'EUR', 'Décision de taux de la BCE', 'high', '2.15%', '2.15%', '2.15%'],
  [3, '13:30', 'USD', 'Inscriptions au chômage hebdomadaires', 'medium', '225K', '221K', '219K'],
  [4, '07:00', 'GBP', 'PIB m/m', 'high', '0.1%', '0.2%', '0.1%'],
  [4, '13:30', 'USD', 'Créations d\'emplois non agricoles (NFP)', 'high', '150K', '143K', '161K'],
  [4, '15:00', 'USD', 'Confiance du consommateur (Michigan)', 'low', '72.0', '71.4', '72.8'],
];

/** @param {string} from lundi ISO local de la semaine */
export function demoEvents(from, now = new Date()) {
  const [y, m, d] = from.split('-').map(Number);
  return TEMPLATE.map(([day, hhmm, currency, title, impact, forecast, previous, actual]) => {
    const [h, mi] = hhmm.split(':').map(Number);
    const at = new Date(Date.UTC(y, m - 1, d + day, h, mi)).toISOString();
    return makeEvent({ at, country: '', currency, title, impact, forecast, previous, actual: at <= now.toISOString() ? actual : null });
  });
}
