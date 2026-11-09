/**
 * Configuration Supabase. L'URL et la clé « anon » / « publishable » sont PUBLIQUES par conception :
 * la sécurité vient des règles d'accès (RLS) de supabase/schema.sql, pas du secret de cette clé.
 * Ne mets JAMAIS ici la clé « service_role ».
 */
export const SUPABASE = {
  url: '',
  key: '',
};
