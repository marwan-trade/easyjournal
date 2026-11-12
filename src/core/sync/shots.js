/** Outils pour les captures d'écran synchronisées (Supabase Storage). Pur JS : testable sous Node. */

/** Empreinte stable d'une capture (identique sur tous les appareils) : sert à savoir si l'image a changé. */
export function shotKey(dataUrl) {
  if (!dataUrl) return '';
  let h = 0x811c9dc5;
  for (let i = 0; i < dataUrl.length; i++) { h ^= dataUrl.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${dataUrl.length.toString(36)}-${h.toString(36)}`;
}

/** data URL -> { mime, bytes } */
export function parseDataUrl(dataUrl) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl ?? '');
  if (!m) throw new Error('Image invalide.');
  const mime = m[1] || 'image/jpeg';
  const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, bytes };
}

/** octets -> data URL */
export function toDataUrl(bytes, mime = 'image/jpeg') {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(s)}`;
}
