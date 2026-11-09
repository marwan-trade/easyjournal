/**
 * Couche de stockage : IndexedDB, avec repli en mémoire si le navigateur la refuse
 * (navigation privée stricte, par exemple). Les données restent sur l'appareil.
 */
export const DB_NAME = 'easyjournal';
export const DB_VERSION = 1;
export const STORES = ['trades', 'ideas', 'meta'];

/**
 * Migrations de STRUCTURE (création des magasins). Une entrée par version de la base.
 * Pour ajouter un index plus tard : incrémenter DB_VERSION et ajouter une entrée ici.
 */
const upgrades = {
  1(db) {
    const trades = db.createObjectStore('trades', { keyPath: 'id' });
    trades.createIndex('mode', 'mode');
    trades.createIndex('date', 'date');
    db.createObjectStore('ideas', { keyPath: 'id' });
    db.createObjectStore('meta', { keyPath: 'key' });
  },
};

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

class IdbBackend {
  persistent = true;
  constructor(db) { this.db = db; }

  static open() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponible'));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        for (let v = e.oldVersion + 1; v <= e.newVersion; v++) upgrades[v]?.(req.result);
      };
      req.onsuccess = () => resolve(new IdbBackend(req.result));
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Base bloquée par un autre onglet'));
    });
  }

  tx(store, mode = 'readonly') {
    return this.db.transaction(store, mode).objectStore(store);
  }
  all(store) { return wrap(this.tx(store).getAll()); }
  get(store, key) { return wrap(this.tx(store).get(key)); }
  put(store, value) { return wrap(this.tx(store, 'readwrite').put(value)); }
  delete(store, key) { return wrap(this.tx(store, 'readwrite').delete(key)); }
  clear(store) { return wrap(this.tx(store, 'readwrite').clear()); }
  /** Écriture groupée dans UNE transaction : tout passe ou rien. */
  bulkPut(store, values) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      values.forEach((v) => os.put(v));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}

class MemoryBackend {
  persistent = false;
  data = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  keyOf(store, v) { return store === 'meta' ? v.key : v.id; }
  async all(store) { return structuredClone([...this.data[store].values()]); }
  async get(store, key) { return structuredClone(this.data[store].get(key)); }
  async put(store, v) { this.data[store].set(this.keyOf(store, v), structuredClone(v)); }
  async delete(store, key) { this.data[store].delete(key); }
  async clear(store) { this.data[store].clear(); }
  async bulkPut(store, values) { values.forEach((v) => this.data[store].set(this.keyOf(store, v), structuredClone(v))); }
}

export async function openDatabase() {
  try {
    return await IdbBackend.open();
  } catch (err) {
    console.warn('Stockage persistant indisponible, repli en mémoire :', err);
    return new MemoryBackend();
  }
}

export { MemoryBackend };
