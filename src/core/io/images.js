/**
 * Images de trades : réduction et conversion en data URL (navigateur uniquement).
 * Une capture TradingView de 1366×768 (≈160 Ko en PNG) passe à ≈60–110 Ko en JPEG sans perte visible,
 * ce qui garde la base locale légère même avec des centaines de trades.
 */
export const MAX_WIDTH = 1400;
export const QUALITY = 0.85;

const blobToDataURL = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error ?? new Error('Lecture impossible.'));
  r.readAsDataURL(blob);
});

export const isImageType = (type) => /^image\/(png|jpe?g|gif|webp|bmp)$/i.test(type ?? '');

/**
 * @param {Blob|{bytes:Uint8Array, mime:string}} src
 * @returns {Promise<string>} data URL JPEG (ou l'original si la réduction ne l'améliore pas)
 */
export async function compressImage(src, { maxWidth = MAX_WIDTH, quality = QUALITY } = {}) {
  const blob = src instanceof Blob ? src : new Blob([src.bytes], { type: src.mime });
  if (!isImageType(blob.type)) throw new Error('Ce fichier n\'est pas une image (PNG, JPEG, WebP, GIF).');
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxWidth / bmp.width);
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const out = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (out && out.size < blob.size) return await blobToDataURL(out);
  } catch { /* décodage impossible : on garde l'original ci-dessous */ }
  return blobToDataURL(blob);
}

/** Première image trouvée dans un événement de collage (Ctrl+V) ou de glisser-déposer. */
export function imageFromTransfer(dt) {
  if (!dt) return null;
  for (const it of dt.items ?? []) if (it.kind === 'file' && isImageType(it.type)) return it.getAsFile();
  for (const f of dt.files ?? []) if (isImageType(f.type)) return f;
  return null;
}
