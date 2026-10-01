import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { CartItem, IssuedMenuRecord, Language, Order, OrderType, PaymentMethod, SalesStats, ShopSettings } from './types';
import { GAS_URL } from './constants';
import { createDemoBaselineSettings } from './demo-baseline';
import { IS_PUBLIC_DEMO } from './demo-mode';
import { ACTIVE_DEMO_SYNC_CHANNEL_NAME, PUBLIC_DEMO_RESET_MESSAGE, PUBLIC_DEMO_RESET_SIGNAL_KEY } from './demo-reset';
import { ALL_LEGACY_KEYS } from './data/migrations/legacy-keys';
import { IndexedDbPosRepository, type PosRead } from './storage/pos-idb';
import { PhotoUrlRegistry, prepareSettingsPhotos } from './storage/pos-photos';
import { backupPreviewToRead, createCjposBackup, previewCjposBackup, type BackupPreview } from './storage/cjpos-backup';
import { acceptIncomingOrderMutation, addCartItemMutation, changeLanguageMutation, clearCartMutation, createOrderMutation, markPaidMutation, removeCartItemMutation, updateCartItemMutation, updateStatusMutation, type IncomingOrderResult } from './storage/pos-operations';
import { migrateLegacySnapshot, normalizeSettings, readLegacySnapshot, renameLegacyDemoSettings } from './storage/pos-legacy';
import { normalizeWhatsAppNumber, SharingError, type OrderRequest } from './sharing/protocol';
import { tr } from './i18n';

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(ACTIVE_DEMO_SYNC_CHANNEL_NAME) : null;
const USE_EXPERIMENTAL_GAS = Boolean(GAS_URL) && !IS_PUBLIC_DEMO && import.meta.env.VITE_ANDROID_APP !== 'true';

async function gasPost(data: Record<string, unknown>): Promise<void> {
  if (!USE_EXPERIMENTAL_GAS) return;
  try {
    await fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(data) });
  } catch (error) { console.warn('[Optional GAS sync] Failed:', error); }
}

async function gasGet(params: Record<string, string>): Promise<any> {
  if (!USE_EXPERIMENTAL_GAS) return null;
  try {
    const url = new URL(GAS_URL);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url);
    return await response.json();
  } catch (error) { console.warn('[Optional GAS stats] Failed:', error); return null; }
}

export interface StoreState {
  orders: Order[];
  cart: CartItem[];
  language: Language;
  isOnline: boolean;
  isSyncing: boolean;
  ready: boolean;
  revision: number;
  saveStatus: 'saving' | 'saved' | 'error';
  storageError: string | null;
  settings: ShopSettings;
  changeLanguage: (lang: Language) => Promise<boolean>;
  addToCart: (item: Omit<CartItem, 'id'>) => Promise<boolean>;
  updateCartItem: (id: string, patch: Partial<Omit<CartItem, 'id'>>) => Promise<boolean>;
  removeFromCart: (id: string) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  submitOrder: (orderType: OrderType, tableNo?: string, confirmedPaymentMethod?: PaymentMethod) => Promise<string | null>;
  markAsPaid: (localOrderId: string, paymentMethod: PaymentMethod) => Promise<boolean>;
  updateOrderStatus: (localOrderId: string, status: 'Preparing' | 'Completed' | 'Cancelled') => Promise<boolean>;
  updateSettings: (settings: ShopSettings) => Promise<boolean>;
  ensureShopIdentity: () => Promise<string | null>;
  recordIssuedMenu: (record: IssuedMenuRecord, whatsappNumber: string) => Promise<boolean>;
  acceptIncomingOrder: (request: OrderRequest, expectedTotalSen: number, expectedMenuRevision?: string) => Promise<IncomingOrderResult | null>;
  fetchStats: (from: string, to: string) => Promise<SalesStats | null>;
  createBackup: () => Promise<Blob>;
  previewBackup: (file: Blob) => Promise<BackupPreview>;
  restoreBackup: (preview: BackupPreview) => Promise<boolean>;
  resetDemo: () => Promise<boolean>;
}

const StoreContext = createContext<StoreState | null>(null);

function storageMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to save local data on this device.';
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [language, setLanguage] = useState<Language>('en');
  const [settings, setSettings] = useState<ShopSettings>(createDemoBaselineSettings);
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<StoreState['saveStatus']>('saved');
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const repositoryRef = useRef(new IndexedDbPosRepository());
  const photoRegistryRef = useRef(new PhotoUrlRegistry());
  const initRef = useRef<Promise<PosRead> | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const submitLockedRef = useRef(false);
  const pendingWritesRef = useRef(0);

  const publish = useCallback((read: PosRead) => {
    const hydratedSettings = photoRegistryRef.current.hydrate(read.state.settings, read.photos, read.photoVersions);
    setOrders(read.state.orders);
    setCart(read.state.cart);
    setSettings(hydratedSettings);
    setLanguage(read.state.language);
    setRevision(read.state.revision);
  }, []);

  const ensureReady = useCallback((): Promise<PosRead> => {
    if (!initRef.current) initRef.current = (async () => {
      const existing = await repositoryRef.current.read();
      if (existing) {
        const shouldRename = IS_PUBLIC_DEMO || import.meta.env.VITE_ANDROID_APP === 'true';
        if (!existing.state.settings.shopId || renameLegacyDemoSettings(existing.state.settings, shouldRename) !== existing.state.settings) {
          await repositoryRef.current.mutate(current => {
            const renamed = renameLegacyDemoSettings(current.settings, shouldRename);
            if (renamed === current.settings && current.settings.shopId) return { state: current, value: true, changed: false };
            return { state: { ...current, settings: { ...renamed, shopId: renamed.shopId || uuidv4() } }, value: true };
          });
          const migrated = await repositoryRef.current.read();
          if (!migrated) throw new Error('Saved shop could not be reopened.');
          return migrated;
        }
        return existing;
      }
      const migrated = await migrateLegacySnapshot(readLegacySnapshot(localStorage));
      migrated.state.settings = { ...migrated.state.settings, shopId: migrated.state.settings.shopId || uuidv4() };
      return repositoryRef.current.initialize(migrated);
    })();
    return initRef.current;
  }, []);

  useEffect(() => {
    let active = true;
    ensureReady().then(read => {
      if (!active) return;
      publish(read);
      setReady(true);
      setStorageError(null);
    }).catch(error => {
      if (!active) return;
      setSaveStatus('error');
      setStorageError(storageMessage(error));
    });
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      active = false;
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      photoRegistryRef.current.revokeAll();
    };
  }, [ensureReady, publish]);

  const reloadAfterCommit = useCallback(async () => {
    const read = await repositoryRef.current.read();
    if (!read) throw new Error('Saved data disappeared from this device.');
    publish(read);
    return read;
  }, [publish]);

  const queuedWrite = useCallback(<T,>(work: () => Promise<T>, fallback: T, broadcast = true, rethrow = false): Promise<T> => {
    pendingWritesRef.current += 1;
    setSaveStatus('saving');
    const operation = queueRef.current.then(async () => {
      await ensureReady();
      const result = await work();
      try {
        const read = await reloadAfterCommit();
        if (broadcast) channel?.postMessage({ type: 'data_committed', revision: read.state.revision });
        setStorageError(null);
      } catch (error) {
        // The transaction has already committed. Return its real outcome so a
        // caller cannot retry a successfully stored order as a duplicate.
        setStorageError(`Data saved, but this screen could not refresh: ${storageMessage(error)}`);
        setSaveStatus('error');
      }
      return result;
    }).catch(error => {
      if (!(error instanceof SharingError)) {
        setStorageError(storageMessage(error));
        setSaveStatus('error');
      }
      if (rethrow) throw error;
      return fallback;
    }).finally(() => {
      pendingWritesRef.current -= 1;
      if (pendingWritesRef.current === 0) setSaveStatus(current => current === 'error' ? current : 'saved');
    });
    queueRef.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, [ensureReady, reloadAfterCommit]);

  useEffect(() => {
    const reloadFromAnotherTab = () => {
      queueRef.current = queueRef.current.then(async () => {
        await ensureReady();
        await reloadAfterCommit();
      }).catch(error => {
        setSaveStatus('error');
        setStorageError(storageMessage(error));
      });
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'data_committed' || event.data?.type === PUBLIC_DEMO_RESET_MESSAGE) reloadFromAnotherTab();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === PUBLIC_DEMO_RESET_SIGNAL_KEY) reloadFromAnotherTab();
    };
    channel?.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);
    return () => {
      channel?.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
    };
  }, [ensureReady, reloadAfterCommit]);

  const changeLanguage = useCallback((lang: Language) => queuedWrite(async () => {
    const result = await repositoryRef.current.mutate(current => changeLanguageMutation(current, lang));
    return result?.value ?? false;
  }, false), [queuedWrite]);

  const addToCart = useCallback((item: Omit<CartItem, 'id'>) => queuedWrite(async () => {
    const result = await repositoryRef.current.mutate(current => addCartItemMutation(current, item, uuidv4()));
    return result?.value ?? false;
  }, false), [queuedWrite]);

  const updateCartItem = useCallback((id: string, patch: Partial<Omit<CartItem, 'id'>>) => queuedWrite(async () => {
    const result = await repositoryRef.current.mutate(current => updateCartItemMutation(current, id, patch));
    return result?.value ?? false;
  }, false), [queuedWrite]);

  const removeFromCart = useCallback((id: string) => queuedWrite(async () => {
    const result = await repositoryRef.current.mutate(current => removeCartItemMutation(current, id));
    return result?.value ?? false;
  }, false), [queuedWrite]);

  const clearCart = useCallback(() => queuedWrite(async () => {
    const result = await repositoryRef.current.mutate(clearCartMutation);
    return result?.value ?? false;
  }, false), [queuedWrite]);

  const submitOrder = useCallback(async (orderType: OrderType, tableNo?: string, confirmedPaymentMethod?: PaymentMethod): Promise<string | null> => {
    if (submitLockedRef.current) return null;
    submitLockedRef.current = true;
    try {
      return await queuedWrite(async () => {
        const now = new Date();
        const result = await repositoryRef.current.mutate(current => createOrderMutation(current, orderType, tableNo, confirmedPaymentMethod, now, uuidv4()));
        if (result?.value && USE_EXPERIMENTAL_GAS) {
          const created = result.state.orders.find(order => order.local_order_id === result.value);
          if (created) void gasPost({ action: 'addOrder', ...created, items: undefined });
        }
        return result?.value ?? null;
      }, null);
    } finally { submitLockedRef.current = false; }
  }, [queuedWrite]);

  const markAsPaid = useCallback((localOrderId: string, paymentMethod: PaymentMethod) => queuedWrite(async () => {
    const result = await repositoryRef.current.mutate(current => markPaidMutation(current, localOrderId, paymentMethod, new Date()));
    if (result?.value && result.changed !== false && USE_EXPERIMENTAL_GAS) {
      const order = result.state.orders.find(item => item.local_order_id === localOrderId);
      if (order) void gasPost({ action: 'updateStatus', local_order_id: localOrderId, status: order.status, paid: true, paid_at: order.paid_at, payment_method: paymentMethod });
    }
    return result?.value ?? false;
  }, false), [queuedWrite]);

  const updateOrderStatus = useCallback((localOrderId: string, status: 'Preparing' | 'Completed' | 'Cancelled') => queuedWrite(async () => {
    const result = await repositoryRef.current.mutate(current => updateStatusMutation(current, localOrderId, status));
    if (result?.value && result.changed !== false && USE_EXPERIMENTAL_GAS) void gasPost({ action: 'updateStatus', local_order_id: localOrderId, status });
    return result?.value ?? false;
  }, false), [queuedWrite]);

  const updateSettings = useCallback((input: ShopSettings) => queuedWrite(async () => {
    const current = await repositoryRef.current.read();
    if (!current) throw new Error('Local data is not ready.');
    const normalized = normalizeSettings(input, createDemoBaselineSettings(), IS_PUBLIC_DEMO || import.meta.env.VITE_ANDROID_APP === 'true');
    const prepared = await prepareSettingsPhotos(normalized, photoRegistryRef.current, current.photos);
    const result = await repositoryRef.current.mutate(state => ({ state: { ...state, settings: {
      ...prepared.settings,
      shopId: state.settings.shopId || uuidv4(),
      issuedMenus: state.settings.issuedMenus,
      whatsappNumber: input.whatsappNumber ?? state.settings.whatsappNumber,
    } }, value: true }), prepared.photos);
    return result?.value ?? false;
  }, false), [queuedWrite]);

  const ensureShopIdentity = useCallback(async (): Promise<string | null> => {
    await ensureReady();
    await queueRef.current;
    const read = await repositoryRef.current.read();
    return read?.state.settings.shopId ?? null;
  }, [ensureReady]);

  const recordIssuedMenu = useCallback((input: IssuedMenuRecord, whatsappNumber: string) => queuedWrite(async () => {
    const phone = normalizeWhatsAppNumber(whatsappNumber);
    const record = structuredClone(input);
    if (!record.menuId || !record.menuItems.length || !Number.isFinite(Date.parse(record.createdAt))) throw new SharingError('INVALID_FILE');
    record.menuItems = record.menuItems.map(item => ({ ...item, image: '' }));
    const result = await repositoryRef.current.mutate(current => {
      const old = current.settings.issuedMenus?.find(item => item.menuId === record.menuId);
      if (old && JSON.stringify(old) !== JSON.stringify(record)) throw new SharingError('MENU_ID_CONFLICT');
      const issuedMenus = old ? current.settings.issuedMenus : [...(current.settings.issuedMenus ?? []), record];
      if (old && current.settings.whatsappNumber === phone) return { state: current, value: true, changed: false };
      return { state: { ...current, settings: { ...current.settings,
        shopId: current.settings.shopId || uuidv4(), whatsappNumber: phone, issuedMenus,
      } }, value: true };
    });
    return result?.value ?? false;
  }, false, true, true), [queuedWrite]);

  const acceptIncomingOrder = useCallback((request: OrderRequest, expectedTotalSen: number, expectedMenuRevision?: string) => queuedWrite(async () => {
    const result = await repositoryRef.current.mutate(current => acceptIncomingOrderMutation(current, request, expectedTotalSen, new Date(), uuidv4(), expectedMenuRevision));
    return result?.value ?? null;
  }, null, true, true), [queuedWrite]);

  const fetchStats = useCallback(async (from: string, to: string): Promise<SalesStats | null> => {
    const result = await gasGet({ action: 'getStats', from, to });
    return result?.success ? { totals: result.totals, daily: result.daily } : null;
  }, []);

  const createBackup = useCallback(async (): Promise<Blob> => {
    await ensureReady();
    await queueRef.current;
    const read = await repositoryRef.current.read();
    if (!read) throw new Error('Local data is unavailable for backup.');
    return createCjposBackup(read);
  }, [ensureReady]);

  const previewBackup = useCallback((file: Blob): Promise<BackupPreview> => previewCjposBackup(file), []);

  const restoreBackup = useCallback((preview: BackupPreview) => queuedWrite(async () => {
    const current = await repositoryRef.current.read();
    if (!current) throw new Error('Local data is unavailable for restore.');
    await repositoryRef.current.replace(backupPreviewToRead(preview, current.state.revision));
    return true;
  }, false), [queuedWrite]);

  const resetDemo = useCallback(() => queuedWrite(async () => {
    const current = await repositoryRef.current.read();
    const prepared = await prepareSettingsPhotos(createDemoBaselineSettings(), null, new Map(), false);
    await repositoryRef.current.reset({
      state: { orders: [], cart: [], settings: { ...prepared.settings, shopId: uuidv4() }, language: 'en', revision: (current?.state.revision ?? 0) + 1 },
      photos: prepared.photos,
      photoVersions: Object.fromEntries([...prepared.photos.keys()].map(key => [key, uuidv4()])),
      legacySnapshot: current?.legacySnapshot ?? readLegacySnapshot(localStorage),
    });
    for (const key of ALL_LEGACY_KEYS) {
      try { localStorage.removeItem(key); } catch { /* IDB already contains the reset state. */ }
    }
    return true;
  }, false), [queuedWrite]);

  const value: StoreState = {
    orders, cart, language, isOnline, isSyncing: false, ready, revision, saveStatus, storageError, settings,
    changeLanguage, addToCart, updateCartItem, removeFromCart, clearCart, submitOrder,
    markAsPaid, updateOrderStatus, updateSettings, ensureShopIdentity, recordIssuedMenu, acceptIncomingOrder,
    fetchStats, createBackup, previewBackup, restoreBackup, resetDemo,
  };
  return (
    <StoreContext.Provider value={value}>
      {ready ? children : (
        <div className="min-h-dvh bg-zinc-950 p-6 text-center text-white flex flex-col items-center justify-center" role={storageError ? 'alert' : 'status'}>
          <h1 className="text-xl font-bold">{storageError
            ? tr(language, 'Local data could not be opened', '本机资料无法开启', 'Data tempatan tidak dapat dibuka')
            : tr(language, 'Opening local data…', '正在读取本机资料…', 'Membuka data tempatan…')}</h1>
          {storageError && <p className="mt-3 max-w-md text-sm text-red-300">{storageError}</p>}
        </div>
      )}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreState {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within <StoreProvider>');
  return context;
}
