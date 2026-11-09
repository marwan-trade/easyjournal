/**
 * Utilitaires d'interface. Tout le DOM est construit avec h() et textContent :
 * le contenu saisi par l'utilisateur (notes, noms…) n'est JAMAIS interprété comme du HTML.
 */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (['value', 'checked', 'disabled', 'selected', 'hidden', 'readOnly'].includes(k)) el[k] = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
};

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name] ?? ''; // contenu statique défini ci-dessus, jamais de données utilisateur
  return svg;
}

export function toast(message, kind = 'info', ms = 3800) {
  const host = document.getElementById('toasts');
  const el = h('div', { class: `toast ${kind === 'error' ? 'error' : ''}`, role: kind === 'error' ? 'alert' : 'status' }, message);
  host.append(el);
  setTimeout(() => el.remove(), ms);
}

/** Ouvre une boîte de dialogue modale native. Retourne { dialog, close }. */
export function openDialog({ title, body, footer, onClose }) {
  const dialog = h('dialog', { 'aria-labelledby': 'dlg-title' });
  const close = () => dialog.close();
  dialog.append(
    h('div', { class: 'dlg-head' },
      h('h2', { id: 'dlg-title' }, title),
      h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': 'Fermer', onClick: close }, icon('x')),
    ),
    h('div', { class: 'dlg-body' }, body),
    footer ? h('div', { class: 'dlg-foot' }, footer) : null,
  );
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('close', () => { dialog.remove(); onClose?.(); });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close };
}

/** Confirmation. Retourne une Promise<boolean>. */
export function confirmDialog({ title, message, confirmLabel = 'Confirmer', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const answer = (v) => { answered = true; resolve(v); dlg.close(); };
    const dlg = openDialog({
      title,
      body: h('p', {}, message),
      footer: [
        h('button', { class: 'btn', type: 'button', onClick: () => answer(false) }, 'Annuler'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', onClick: () => answer(true) }, confirmLabel),
      ],
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}

export function field(label, input, { hint, error, wide = false, id } = {}) {
  const fid = id ?? input.id ?? `f-${Math.random().toString(36).slice(2, 8)}`;
  input.id = fid;
  if (error) {
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', `${fid}-err`);
  }
  return h('div', { class: `field ${wide ? 'wide' : ''}` },
    h('label', { for: fid }, label),
    input,
    hint ? h('div', { class: 'hint' }, hint) : null,
    error ? h('div', { class: 'error', id: `${fid}-err` }, error) : null,
  );
}

export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Réduit une image (côté le plus long ≤ maxSide) et la renvoie en data URL JPEG. */
export function resizeImage(file, maxSide = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error("Ce fichier n'est pas une image."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Impossible de lire cette image.")); };
    img.src = url;
  });
}

export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
