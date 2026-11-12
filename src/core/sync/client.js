/**
 * Client Supabase minimal (authentification + PostgREST) sans dépendance : fetch uniquement.
 * Il est injectable (fetch, stockage) pour être testé sous Node.
 */
export class SyncError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const AUTH_FR = [
  [/invalid login credentials/i, 'E-mail ou mot de passe incorrect.'],
  [/email not confirmed/i, 'Adresse e-mail pas encore confirmée : ouvre le message reçu par e-mail.'],
  [/user already registered|already been registered/i, 'Un compte existe déjà avec cet e-mail : connecte-toi.'],
  [/password should be at least|weak password/i, 'Mot de passe trop court : 6 caractères minimum.'],
  [/rate limit|too many/i, 'Trop de tentatives : réessaie dans quelques minutes.'],
  [/signups? not allowed|signup is disabled/i, 'Les inscriptions sont désactivées sur ce projet Supabase.'],
  [/invalid.*email|unable to validate email/i, 'Adresse e-mail invalide.'],
];
const frError = (msg) => AUTH_FR.find(([re]) => re.test(msg))?.[1] ?? msg;

export class SupabaseClient {
  constructor({ url, key, storage = null, fetchImpl = globalThis.fetch?.bind(globalThis), now = () => Date.now() }) {
    this.url = String(url).replace(/\/+$/, '');
    this.key = key; this.storage = storage; this.fetch = fetchImpl; this.now = now;
    this.storageKey = 'easyjournal.session';
  }

  /* ----- session ----- */
  get session() {
    try { return JSON.parse(this.storage?.getItem(this.storageKey) ?? 'null'); } catch { return null; }
  }
  _save(s) { try { s ? this.storage?.setItem(this.storageKey, JSON.stringify(s)) : this.storage?.removeItem(this.storageKey); } catch { /* ignore */ } }
  get user() { return this.session?.user ?? null; }
  get signedIn() { return Boolean(this.session?.refresh_token); }

  _toSession(r) {
    return { access_token: r.access_token, refresh_token: r.refresh_token,
      expires_at: r.expires_at ?? Math.floor(this.now() / 1000) + (r.expires_in ?? 3600),
      user: { id: r.user?.id, email: r.user?.email } };
  }

  async _auth(path, body, bearer = null) {
    let res;
    try {
      res = await this.fetch(`${this.url}/auth/v1/${path}`, { method: 'POST',
        headers: { apikey: this.key, 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: JSON.stringify(body) });
    } catch { throw new SyncError('network', 'Connexion impossible : vérifie internet.'); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const raw = json.error_description ?? json.msg ?? json.message ?? json.error ?? `Erreur ${res.status}`;
      throw new SyncError(res.status === 400 || res.status === 422 ? 'auth' : 'http', frError(String(raw)));
    }
    return json;
  }

  async signUp(email, password) {
    const r = await this._auth('signup', { email, password });
    if (!r.access_token) return { needsConfirmation: true }; // confirmation par e-mail activée
    this._save(this._toSession(r));
    return { needsConfirmation: false, user: this.user };
  }
  async signIn(email, password) {
    const r = await this._auth('token?grant_type=password', { email, password });
    this._save(this._toSession(r));
    return this.user;
  }
  async signOut() {
    const s = this.session;
    this._save(null);
    if (s?.access_token) { try { await this._auth('logout', {}, s.access_token); } catch { /* déjà déconnecté localement */ } }
  }
  async refresh() {
    const s = this.session;
    if (!s?.refresh_token) throw new SyncError('auth', 'Session expirée : reconnecte-toi.');
    try {
      const r = await this._auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
      this._save(this._toSession(r));
    } catch (e) {
      if (e.code !== 'network') this._save(null); // refresh refusé : la session n'est plus valable
      throw e.code === 'network' ? e : new SyncError('auth', 'Session expirée : reconnecte-toi.');
    }
  }
  async _token() {
    const s = this.session;
    if (!s) throw new SyncError('auth', 'Non connecté.');
    if (s.expires_at - 60 < Math.floor(this.now() / 1000)) await this.refresh();
    return this.session.access_token;
  }

  /* ----- données (PostgREST) ----- */
  async rest(path, { method = 'GET', body, headers = {} } = {}, retried = false) {
    const token = await this._token();
    let res;
    try {
      res = await this.fetch(`${this.url}/rest/v1/${path}`, { method,
        headers: { apikey: this.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body) });
    } catch { throw new SyncError('network', 'Connexion impossible : vérifie internet.'); }
    if (res.status === 401 && !retried) { await this.refresh(); return this.rest(path, { method, body, headers }, true); }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const msg = j.message ?? j.hint ?? `Erreur ${res.status}`;
      if (res.status === 404 || /relation .* does not exist|schema cache/i.test(msg)) throw new SyncError('schema', 'Les tables ne sont pas créées dans Supabase : exécute supabase/schema.sql.');
      if (res.status === 401 || res.status === 403) throw new SyncError('auth', 'Accès refusé : reconnecte-toi, ou vérifie les règles RLS (supabase/schema.sql).');
      throw new SyncError('http', msg);
    }
    return res.status === 204 ? null : res.json().catch(() => null);
  }

  /* ----- captures d'écran (Supabase Storage, bucket privé « screenshots », dossier = id de l'utilisateur) ----- */
  async _storage(path, { method = 'GET', body, headers = {} } = {}, retried = false) {
    const token = await this._token();
    let res;
    try { res = await this.fetch(`${this.url}/storage/v1/object/${path}`, { method, headers: { apikey: this.key, Authorization: `Bearer ${token}`, ...headers }, body }); }
    catch { throw new SyncError('network', 'Connexion impossible : vérifie internet.'); }
    if (res.status === 401 && !retried) { await this.refresh(); return this._storage(path, { method, body, headers }, true); }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const msg = String(j.message ?? j.error ?? `Erreur ${res.status}`);
      if (/bucket not found/i.test(msg) || res.status === 404 && /bucket/i.test(msg)) throw new SyncError('schema', 'Le dossier « screenshots » n\'existe pas dans Supabase : exécute la partie « captures » de supabase/schema.sql.');
      if (res.status === 401 || res.status === 403) throw new SyncError('auth', 'Accès refusé aux captures : vérifie les règles de stockage (supabase/schema.sql).');
      throw new SyncError(res.status === 404 ? 'missing' : 'http', msg);
    }
    return res;
  }
  _shotPath(id) { return `screenshots/${this.user?.id}/${encodeURIComponent(id)}.jpg`; }
  async uploadShot(id, bytes, mime = 'image/jpeg') {
    await this._storage(this._shotPath(id), { method: 'POST', body: bytes, headers: { 'Content-Type': mime, 'x-upsert': 'true' } });
  }
  /** @returns {Promise<{bytes: Uint8Array, mime: string}|null>} null si l'image n'existe pas (encore) sur le serveur */
  async downloadShot(id) {
    try {
      const res = await this._storage(`authenticated/${this._shotPath(id)}`);
      return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type') || 'image/jpeg' };
    } catch (e) { if (e.code === 'missing') return null; throw e; }
  }
  async deleteShot(id) {
    try { await this._storage(this._shotPath(id), { method: 'DELETE' }); } catch (e) { if (e.code !== 'missing') throw e; }
  }

  /** Toutes les lignes modifiées depuis `since` (ms), page par page. */
  async pull(table, since, cols = 'id,data,updated_at,deleted') {
    const out = []; const PAGE = 500;
    for (let offset = 0; ; offset += PAGE) {
      const rows = await this.rest(`${table}?select=${cols}&updated_at=gte.${Math.max(0, Math.floor(since))}&order=updated_at.asc,id.asc&limit=${PAGE}&offset=${offset}`);
      out.push(...(rows ?? []));
      if (!rows || rows.length < PAGE) break;
    }
    return out;
  }
  async pullSettings() {
    const rows = await this.rest('user_settings?select=data,updated_at&limit=1');
    return rows?.[0] ?? null;
  }
  async upsert(table, rows, onConflict = 'user_id,id') {
    for (let i = 0; i < rows.length; i += 200) {
      await this.rest(`${table}?on_conflict=${onConflict}`, { method: 'POST', body: rows.slice(i, i + 200),
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
    }
  }
}
