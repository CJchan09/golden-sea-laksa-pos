import type { CartItem, Language, Order, ShopSettings } from '../types';

export const POS_DB_NAME = 'cjpos-local-v1';
const DATA_STORE = 'data';
const PHOTO_STORE = 'photos';
const ORDER_STORE = 'orders';
const SNAPSHOT_STORE = 'snapshots';

export interface PosState {
  orders: Order[];
  cart: CartItem[];
  settings: ShopSettings;
  language: Language;
  revision: number;
}

export type LegacySnapshot = Record<string, string | null>;

export interface PosRead {
  state: PosState;
  photos: Map<string, Blob>;
  photoVersions: Record<string, string>;
  legacySnapshot: LegacySnapshot | null;
}

export interface PosMutation<T> {
  state: PosState;
  value: T;
  changed?: boolean;
}

export interface PosRepository {
  read(): Promise<PosRead | null>;
  initialize(initial: PosRead): Promise<PosRead>;
  mutate<T>(change: (current: PosState) => PosMutation<T> | null, photoWrites?: Map<string, Blob>): Promise<PosMutation<T> | null>;
  replace(next: PosRead): Promise<void>;
  reset(next: PosRead): Promise<void>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
  });
}

function cloneState(state: PosState): PosState {
  return structuredClone(state);
}

async function readState(store: IDBObjectStore, orderStore: IDBObjectStore): Promise<PosState | null> {
  const [orders, cart, settings, language, revision] = await Promise.all([
    requestResult(orderStore.getAll()),
    requestResult(store.get('cart')),
    requestResult(store.get('settings')),
    requestResult(store.get('language')),
    requestResult(store.get('revision')),
  ]);
  if (settings === undefined) return null;
  return {
    orders: ((orders ?? []) as Order[]).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    cart: (cart ?? []) as CartItem[],
    settings: settings as ShopSettings,
    language: (language ?? 'en') as Language,
    revision: typeof revision === 'number' ? revision : 0,
  };
}

function writeState(store: IDBObjectStore, state: PosState): void {
  store.put(state.cart, 'cart');
  store.put(state.settings, 'settings');
  store.put(state.language, 'language');
  store.put(state.revision, 'revision');
}

function writeOrderDiff(store: IDBObjectStore, before: Order[], after: Order[]): void {
  const previous = new Map(before.map(order => [order.local_order_id, order]));
  const next = new Set<string>();
  for (const order of after) {
    next.add(order.local_order_id);
    const old = previous.get(order.local_order_id);
    if (!old || JSON.stringify(old) !== JSON.stringify(order)) store.put(order);
  }
  for (const order of before) {
    if (!next.has(order.local_order_id)) store.delete(order.local_order_id);
  }
}

async function readPhotos(store: IDBObjectStore): Promise<Map<string, Blob>> {
  const [keys, values] = await Promise.all([
    requestResult(store.getAllKeys()),
    requestResult(store.getAll()),
  ]);
  return new Map(keys.map((key, index) => [String(key), values[index] as Blob]));
}

export class IndexedDbPosRepository implements PosRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  private database(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is unavailable on this device.'));
        return;
      }
      const request = indexedDB.open(POS_DB_NAME, 2);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DATA_STORE)) db.createObjectStore(DATA_STORE);
        if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
        if (!db.objectStoreNames.contains(ORDER_STORE)) db.createObjectStore(ORDER_STORE, { keyPath: 'local_order_id' });
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE);
        // Upgrade any short-lived v1 checkout that stored one large orders
        // array. The upgrade transaction is atomic and leaves other keys intact.
        if (event.oldVersion === 1) {
          const data = request.transaction!.objectStore(DATA_STORE);
          const orders = request.transaction!.objectStore(ORDER_STORE);
          const old = data.get('orders');
          old.onsuccess = () => {
            if (Array.isArray(old.result)) {
              for (const order of old.result as Order[]) orders.put(order);
              data.delete('orders');
            }
          };
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Cannot open IndexedDB.'));
      request.onblocked = () => reject(new Error('A different tab is blocking the data upgrade.'));
    });
    return this.databasePromise;
  }

  async read(): Promise<PosRead | null> {
    const db = await this.database();
    const tx = db.transaction([DATA_STORE, PHOTO_STORE, ORDER_STORE], 'readonly');
    const done = transactionDone(tx);
    const [state, photos, photoVersions, legacySnapshot] = await Promise.all([
      readState(tx.objectStore(DATA_STORE), tx.objectStore(ORDER_STORE)),
      readPhotos(tx.objectStore(PHOTO_STORE)),
      requestResult(tx.objectStore(DATA_STORE).get('photoVersions')),
      requestResult(tx.objectStore(DATA_STORE).get('legacySnapshot')),
    ]);
    await done;
    return state ? { state, photos, photoVersions: (photoVersions ?? {}) as Record<string, string>, legacySnapshot: (legacySnapshot ?? null) as LegacySnapshot | null } : null;
  }

  async initialize(initial: PosRead): Promise<PosRead> {
    const db = await this.database();
    const tx = db.transaction([DATA_STORE, PHOTO_STORE, ORDER_STORE], 'readwrite');
    const done = transactionDone(tx);
    try {
      const data = tx.objectStore(DATA_STORE);
      const existing = await requestResult(data.get('settings'));
      if (existing === undefined) {
        writeState(data, initial.state);
        data.put(initial.legacySnapshot, 'legacySnapshot');
        data.put(initial.photoVersions, 'photoVersions');
        for (const order of initial.state.orders) tx.objectStore(ORDER_STORE).put(order);
        for (const [key, photo] of initial.photos) tx.objectStore(PHOTO_STORE).put(photo, key);
      }
      await done;
    } catch (error) {
      try { tx.abort(); } catch { /* Transaction may already be aborted. */ }
      await done.catch(() => undefined);
      throw error;
    }
    const current = await this.read();
    if (!current) throw new Error('Local data initialization did not complete.');
    return current;
  }

  async mutate<T>(change: (current: PosState) => PosMutation<T> | null, photoWrites: Map<string, Blob> = new Map()): Promise<PosMutation<T> | null> {
    const db = await this.database();
    const tx = db.transaction([DATA_STORE, PHOTO_STORE, ORDER_STORE], 'readwrite');
    const done = transactionDone(tx);
    try {
      const data = tx.objectStore(DATA_STORE);
      const current = await readState(data, tx.objectStore(ORDER_STORE));
      if (!current) throw new Error('Local data has not finished loading.');
      const working = cloneState(current);
      const previousOrdersRef = working.orders;
      const previousCartRef = working.cart;
      const previousSettingsRef = working.settings;
      const result = change(working);
      if (result && result.changed !== false) {
        result.state.revision = current.revision + 1;
        data.put(result.state.revision, 'revision');
        if (result.state.orders !== previousOrdersRef) writeOrderDiff(tx.objectStore(ORDER_STORE), current.orders, result.state.orders);
        if (result.state.cart !== previousCartRef) data.put(result.state.cart, 'cart');
        if (result.state.settings !== previousSettingsRef) data.put(result.state.settings, 'settings');
        if (result.state.language !== current.language) data.put(result.state.language, 'language');
        if (photoWrites.size > 0) {
          const versions = (await requestResult(data.get('photoVersions')) ?? {}) as Record<string, string>;
          for (const key of photoWrites.keys()) versions[key] = `${Date.now()}-${Math.random()}`;
          data.put(versions, 'photoVersions');
        }
        for (const [key, photo] of photoWrites) tx.objectStore(PHOTO_STORE).put(photo, key);
      }
      await done;
      return result;
    } catch (error) {
      try { tx.abort(); } catch { /* Transaction may already be aborted. */ }
      await done.catch(() => undefined);
      throw error;
    }
  }

  private async overwrite(next: PosRead, saveCurrent: boolean): Promise<void> {
    const db = await this.database();
    const stores = [DATA_STORE, PHOTO_STORE, ORDER_STORE, SNAPSHOT_STORE];
    const tx = db.transaction(stores, 'readwrite');
    const done = transactionDone(tx);
    try {
      const data = tx.objectStore(DATA_STORE);
      const photos = tx.objectStore(PHOTO_STORE);
      const orders = tx.objectStore(ORDER_STORE);
      if (saveCurrent) {
        const [previousState, previousPhotos, previousVersions, previousLegacy] = await Promise.all([
          readState(data, orders),
          readPhotos(photos),
          requestResult(data.get('photoVersions')),
          requestResult(data.get('legacySnapshot')),
        ]);
        if (previousState) {
          tx.objectStore(SNAPSHOT_STORE).put({
            createdAt: new Date().toISOString(),
            state: previousState,
            photos: [...previousPhotos],
            photoVersions: previousVersions ?? {},
            legacySnapshot: previousLegacy ?? null,
          }, 'before-last-restore');
        }
      }
      data.clear();
      photos.clear();
      orders.clear();
      writeState(data, next.state);
      data.put(next.legacySnapshot, 'legacySnapshot');
      data.put(next.photoVersions, 'photoVersions');
      for (const order of next.state.orders) orders.put(order);
      for (const [key, photo] of next.photos) photos.put(photo, key);
      await done;
    } catch (error) {
      try { tx.abort(); } catch { /* Transaction may already be aborted. */ }
      await done.catch(() => undefined);
      throw error;
    }
  }

  replace(next: PosRead): Promise<void> { return this.overwrite(next, true); }
  reset(next: PosRead): Promise<void> { return this.overwrite(next, false); }
}

/** Transactional fake used for failure, restart, and idempotency tests. */
export class MemoryPosRepository implements PosRepository {
  private value: PosRead | null = null;
  failNextWrite: Error | null = null;

  constructor(initial: PosRead | null = null) {
    this.value = initial ? structuredClone(initial) : null;
  }

  async read(): Promise<PosRead | null> {
    return this.value ? structuredClone(this.value) : null;
  }

  private commit(next: PosRead): void {
    if (this.failNextWrite) {
      const error = this.failNextWrite;
      this.failNextWrite = null;
      throw error;
    }
    this.value = structuredClone(next);
  }

  async initialize(initial: PosRead): Promise<PosRead> {
    if (!this.value) this.commit(initial);
    return (await this.read())!;
  }

  async mutate<T>(change: (current: PosState) => PosMutation<T> | null, photoWrites: Map<string, Blob> = new Map()): Promise<PosMutation<T> | null> {
    if (!this.value) throw new Error('Local data has not finished loading.');
    const result = change(cloneState(this.value.state));
    if (!result) return null;
    if (result.changed === false) return result;
    result.state.revision = this.value.state.revision + 1;
    const photos = new Map(this.value.photos);
    for (const [key, photo] of photoWrites) photos.set(key, photo);
    const photoVersions = { ...this.value.photoVersions };
    for (const key of photoWrites.keys()) photoVersions[key] = `${Date.now()}-${Math.random()}`;
    this.commit({ ...this.value, state: result.state, photos, photoVersions });
    return structuredClone(result);
  }

  async replace(next: PosRead): Promise<void> { this.commit(next); }
  async reset(next: PosRead): Promise<void> { this.commit(next); }
}
