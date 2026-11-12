/**
 * Configuration Supabase. L'URL et la clé « anon » / « publishable » sont PUBLIQUES par conception :
 * la sécurité vient des règles d'accès (RLS) de supabase/schema.sql, pas du secret de cette clé.
 * Ne mets JAMAIS ici la clé « service_role ».
 */
export const SUPABASE = {
  url: 'https://fvvweegkjesutvidlugv.supabase.co',
  key: 'sb_publishable_Y1Fb6WEAjDBXQyV9kNf1kA_lr6KO8LQ',
};

/** Informations « À propos de moi » affichées dans les paramètres. */
export const AUTHOR = {
  name: 'Marwan Abdi Hassan',
  nationality: 'Djiboutien',
  phone: '+253 77 25 77 77',
};
