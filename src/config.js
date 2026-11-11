/**
 * Configuration Supabase. L'URL et la clé « anon » / « publishable » sont PUBLIQUES par conception :
 * la sécurité vient des règles d'accès (RLS) de supabase/schema.sql, pas du secret de cette clé.
 * Ne mets JAMAIS ici la clé « service_role ».
 */
export const SUPABASE = {
  url: 'https://fvvweegkjesutvidlugv.supabase.co',
  key: 'sb_publishable_Y1Fb6WEAjDBXQyV9kNf1kA_lr6KO8LQ',
};

/** Fonctions mises de côté. Le backtesting est désactivé pour l'instant : mets `backtest: true` pour le réactiver
 *  (le code et les données déjà enregistrées sont conservés, rien n'est supprimé). */
export const FEATURES = { backtest: false };
