import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Order, CartItem, Language, PaymentMethod, SalesStats, ShopSettings } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { GAS_URL, SIZES, NOODLE_BASES, ADD_ONS } from './constants';
import { createDemoBaselineSettings } from './demo-baseline';
import { normalizeMenuItemOptionGroups } from './domain/menu-options';
import { getCartItemDisplay, hydrateCartItemSnapshots } from './domain/cart-item-display';
import {
  ACTIVE_DEMO_SYNC_CHANNEL_NAME,
  PUBLIC_DEMO_RESET_MESSAGE,
  PUBLIC_DEMO_RESET_SIGNAL_KEY,
} from './demo-reset';

const ORDERS_KEY = 'golden_sea_laksa_orders';
const CART_KEY = 'golden_sea_laksa_cart';
const LANG_KEY = 'golden_sea_laksa_lang';
const SETTINGS_KEY = 'golden_sea_laksa_settings';
const POLL_INTERVAL = 5000; // 5 seconds

// BroadcastChannel for cross-tab sync (different browser tabs)
const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel(ACTIVE_DEMO_SYNC_CHANNEL_NAME)
  : null;

// ==================== GAS API Helpers ====================
async function gasPost(data: Record<string, any>): Promise<any> {
  if (!GAS_URL) return null;
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (e) {
    console.warn('[GAS POST] Failed:', e);
    return null;
  }
}

async function gasGet(params: Record<string, string>): Promise<any> {
  if (!GAS_URL) return null;
  try {
    const url = new URL(GAS_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    return await res.json();
  } catch (e) {
    console.warn('[GAS GET] Failed:', e);
    return null;
  }
}

// ==================== Store Types ====================
interface StoreState {
  orders: Order[];
  cart: CartItem[];
  language: Language;
  isOnline: boolean;
  isSyncing: boolean;
  changeLanguage: (lang: Language) => void;
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  submitOrder: (orderType: 'Dine-in' | 'Takeaway', tableNo?: string) => Promise<string | null>;
  markAsPaid: (localOrderId: string, paymentMethod: PaymentMethod) => void;
  updateOrderStatus: (localOrderId: string, status: 'Preparing' | 'Completed' | 'Cancelled') => void;
  fetchStats: (from: string, to: string) => Promise<SalesStats | null>;
  settings: ShopSettings;
  updateSettings: (newSettings: ShopSettings) => void;
}

// ==================== React Context ====================
const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [language, setLanguage] = useState<Language>('en');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [settings, setSettings] = useState<ShopSettings>(() => {
    const baselineSettings = createDemoBaselineSettings();
    const oldQr = localStorage.getItem('golden_sea_laksa_qr_image');
    if (oldQr) {
      baselineSettings.qrImage = oldQr;
      localStorage.removeItem('golden_sea_laksa_qr_image');
    }
    const stored = localStorage.getItem(SETTINGS_KEY);
    const parsed = stored ? JSON.parse(stored) : baselineSettings;

    // Idempotent compatibility adapter for legacy menu arrays.
    if (parsed.menuItems) {
      parsed.menuItems = parsed.menuItems.map((item: any) => normalizeMenuItemOptionGroups({
        ...item,
        sizes: item.sizes || [...SIZES],
        noodleBases: item.noodleBases || [...NOODLE_BASES],
        addOns: item.addOns || [...ADD_ONS],
      }));
    }
    parsed.enableTax = parsed.enableTax ?? false;
    parsed.taxRate = parsed.taxRate ?? 6;
    parsed.takeawayFee = parsed.takeawayFee ?? 0.50;

    return parsed as ShopSettings;
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a ref to orders so async functions always have the latest
  const ordersRef = useRef<Order[]>(orders);
  ordersRef.current = orders;

  // ---- Load initial state ----
  useEffect(() => {
    const storedOrders = localStorage.getItem(ORDERS_KEY);
    if (storedOrders) {
      // Orders are never pruned by age. Sales history is the merchant's own
      // record; only they decide when to archive or delete it. Freeing storage
      // is handled by image compression and an explicit Archive/Export action,
      // not by quietly dropping last month's takings.
      const parsedOrders: Order[] = JSON.parse(storedOrders);
      const hydratedOrders = parsedOrders.map((order) => ({
        ...order,
        items: (order.items ?? []).map((item) => hydrateCartItemSnapshots(
          item,
          settings.menuItems.find((menuItem) => menuItem.id === item.menuItemId),
        )),
      }));
      setOrders(hydratedOrders);
      // Persist the one-time snapshots so later menu edits cannot rewrite the
      // names shown by an older order after the next reload.
      try {
        localStorage.setItem(ORDERS_KEY, JSON.stringify(hydratedOrders));
      } catch (error) {
        console.warn('[Order snapshots] Could not persist compatibility upgrade:', error);
      }
    }

    const storedCart = localStorage.getItem(CART_KEY);
    if (storedCart) {
      const parsedCart: CartItem[] = JSON.parse(storedCart);
      const hydratedCart = parsedCart.map((item) => hydrateCartItemSnapshots(
        item,
        settings.menuItems.find((menuItem) => menuItem.id === item.menuItemId),
      ));
      setCart(hydratedCart);
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(hydratedCart));
      } catch (error) {
        console.warn('[Cart snapshots] Could not persist compatibility upgrade:', error);
      }
    }

    const storedLang = localStorage.getItem(LANG_KEY);
    if (storedLang) setLanguage(storedLang as Language);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // BroadcastChannel listener (for cross-tab sync)
    const applyPublicDemoReset = () => {
      setSettings(createDemoBaselineSettings());
      setOrders([]);
      setCart([]);
      setLanguage('en');
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'orders_updated') {
        setOrders(event.data.orders);
      } else if (event.data?.type === 'settings_updated') {
        setSettings({
          ...event.data.settings,
          menuItems: event.data.settings.menuItems.map(normalizeMenuItemOptionGroups),
        });
      } else if (event.data?.type === PUBLIC_DEMO_RESET_MESSAGE) {
        applyPublicDemoReset();
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PUBLIC_DEMO_RESET_SIGNAL_KEY && event.newValue !== null) {
        applyPublicDemoReset();
      }
    };
    channel?.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
      channel?.removeEventListener('message', handleMessage);
    };
  }, []);

  // ---- Polling: fetch orders from Google Sheet every 5s ----
  useEffect(() => {
    if (!GAS_URL) return;

    const pollOrders = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const result = await gasGet({ action: 'getOrders', date: today });
        if (result?.success && result.orders) {
          const remoteOrders: Order[] = result.orders.map((o: any) => ({
            ...o,
            items: [],
            paid: !!o.paid,
            synced: true,
          }));

          setOrders(prev => {
            const merged = [...prev];

            remoteOrders.forEach(remote => {
              const localIndex = merged.findIndex(l => l.local_order_id === remote.local_order_id);
              if (localIndex === -1) {
                // New order from remote. Only accept if it has valid data (avoid broken GAS rows)
                if (remote.total_qty > 0 || remote.total_amount > 0) {
                  merged.push(remote);
                }
              } else {
                // Exists locally. ONLY update status and paid to avoid overwriting items with GAS zeroes.
                const local = merged[localIndex];
                if (remote.status) {
                  merged[localIndex] = {
                    ...local,
                    status: remote.status,
                    paid: remote.paid,
                    payment_method: remote.payment_method || local.payment_method,
                    synced: true
                  };
                }
              }
            });

            merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

            // Recalculate order_ids for current month based on chronological order (earliest first)
            const currentMonthStr = format(new Date(), 'yyyy-MM');
            const month = new Date().getMonth() + 1;

            const monthOrdersAsc = [...merged]
              .filter(o => o.timestamp.startsWith(currentMonthStr) && o.status !== 'Cancelled')
              .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

            const idMap = new Map<string, string>();
            monthOrdersAsc.forEach((o, idx) => {
              idMap.set(o.local_order_id, `${month * 10000 + idx + 1}`);
            });

            merged.forEach(o => {
              if (idMap.has(o.local_order_id)) {
                o.order_id = idMap.get(o.local_order_id)!;
              }
            });

            localStorage.setItem(ORDERS_KEY, JSON.stringify(merged));
            return merged;
          });
        }
      } catch (e) {
        // Polling failure is silent
      }
    };

    pollOrders();
    pollRef.current = setInterval(pollOrders, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ---- Broadcast orders to other tabs ----
  const broadcastOrders = useCallback((newOrders: Order[]) => {
    channel?.postMessage({ type: 'orders_updated', orders: newOrders });
  }, []);

  // ---- Save orders locally + broadcast ----
  const saveOrders = useCallback((newOrders: Order[]) => {
    setOrders(newOrders);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(newOrders));
    broadcastOrders(newOrders);
  }, [broadcastOrders]);

  const saveCart = useCallback((newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem(CART_KEY, JSON.stringify(newCart));
  }, []);

  const updateSettings = useCallback((newSettings: ShopSettings) => {
    const normalizedSettings = {
      ...newSettings,
      menuItems: newSettings.menuItems.map(normalizeMenuItemOptionGroups),
    };
    setSettings(normalizedSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizedSettings));
    channel?.postMessage({ type: 'settings_updated', settings: normalizedSettings });
  }, []);

  const changeLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(LANG_KEY, lang);
  }, []);

  const addToCart = useCallback((item: Omit<CartItem, 'id'>) => {
    const newItem = { ...item, id: uuidv4() };
    setCart(prev => {
      const updated = [...prev, newItem];
      localStorage.setItem(CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem(CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    localStorage.setItem(CART_KEY, JSON.stringify([]));
  }, []);

  const generateItemsSummary = (items: CartItem[], lang: Language): string => {
    return items.map(item => {
      const menuItem = settings.menuItems.find(m => m.id === item.menuItemId);
      const display = getCartItemDisplay(item, menuItem, lang);
      const details = display.details.length ? `-${display.details.join('-')}` : '';
      return `${item.quantity}x ${display.itemName}${details}`;
    }).filter(Boolean).join('; ');
  };

  // ---- Submit Order ----
  const submitOrder = useCallback(async (orderType: 'Dine-in' | 'Takeaway', tableNo?: string): Promise<string | null> => {
    // Read current cart from state ref
    const currentCart = cart;
    if (currentCart.length === 0) return null;

    const totalQty = currentCart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = currentCart.reduce((sum, item) => sum + item.totalPrice, 0);

    let takeaway_fee = 0;
    if (orderType === 'Takeaway') takeaway_fee = settings.takeawayFee;

    let tax_amount = 0;
    if (settings.enableTax) {
      tax_amount = parseFloat(((subtotal + takeaway_fee) * (settings.taxRate / 100)).toFixed(2));
    }

    const totalAmount = subtotal + takeaway_fee + tax_amount;

    const itemsSummary = generateItemsSummary(currentCart, language);

    const currentOrders = ordersRef.current;

    // Calculate Monthly orders count based on chronological sort
    const now = new Date();
    const currentMonthStr = format(now, 'yyyy-MM');
    const month = now.getMonth() + 1;

    const monthOrders = currentOrders.filter(o => o.timestamp.startsWith(currentMonthStr) && o.status !== 'Cancelled');
    const orderId = `${month * 10000 + monthOrders.length + 1}`;

    const newOrder: Order = {
      local_order_id: uuidv4(),
      order_id: orderId,
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      order_type: orderType,
      table_no: tableNo,
      items_summary: itemsSummary,
      items: [...currentCart],
      total_qty: totalQty,
      subtotal,
      takeaway_fee,
      tax_amount,
      total_amount: totalAmount,
      status: 'Pending',
      paid: false,
      synced: false
    };

    const updatedOrders = [newOrder, ...currentOrders];

    // Safety recount for the UI state so it immediately reflects the proper sorted ID
    const sortedMonthAsc = [...updatedOrders]
      .filter(o => o.timestamp.startsWith(currentMonthStr) && o.status !== 'Cancelled')
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const finalMap = new Map<string, string>();
    sortedMonthAsc.forEach((o, idx) => finalMap.set(o.local_order_id, `${month * 10000 + idx + 1}`));
    updatedOrders.forEach(o => {
      if (finalMap.has(o.local_order_id)) {
        o.order_id = finalMap.get(o.local_order_id)!;
      }
    });

    saveOrders(updatedOrders);

    // Clear cart
    setCart([]);
    localStorage.setItem(CART_KEY, JSON.stringify([]));

    // Sync to Google Sheet
    const result = await gasPost({
      action: 'addOrder',
      ...newOrder,
      items: undefined,
    });
    if (result?.success) {
      // Use functional update to ensure latest state
      setOrders(prev => {
        const synced = prev.map(o =>
          o.local_order_id === newOrder.local_order_id ? { ...o, synced: true } : o
        );
        localStorage.setItem(ORDERS_KEY, JSON.stringify(synced));
        broadcastOrders(synced);
        return synced;
      });
    }

    return newOrder.local_order_id;
  }, [cart, language, saveOrders, broadcastOrders, settings.menuItems]);

  // ---- Mark as Paid ----
  const markAsPaid = useCallback((localOrderId: string, paymentMethod: PaymentMethod) => {
    setOrders(prev => {
      const updated = prev.map(o => {
        if (o.local_order_id === localOrderId) {
          const newStatus = o.status === 'Pending' ? 'Preparing' : o.status;
          return { ...o, paid: true, payment_method: paymentMethod, status: newStatus as any };
        }
        return o;
      });
      localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      broadcastOrders(updated);
      return updated;
    });

    const order = ordersRef.current.find(o => o.local_order_id === localOrderId);
    const newStatus = order?.status === 'Pending' ? 'Preparing' : (order?.status || 'Preparing');

    gasPost({
      action: 'updateStatus',
      local_order_id: localOrderId,
      status: newStatus,
      paid: true,
      payment_method: paymentMethod,
    });
  }, [broadcastOrders]);

  // ---- Update Order Status ----
  const updateOrderStatus = useCallback((localOrderId: string, status: 'Preparing' | 'Completed' | 'Cancelled') => {
    setOrders(prev => {
      const updated = prev.map(o =>
        o.local_order_id === localOrderId ? { ...o, status } : o
      );
      localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      broadcastOrders(updated);
      return updated;
    });

    gasPost({
      action: 'updateStatus',
      local_order_id: localOrderId,
      status,
    });
  }, [broadcastOrders]);

  // ---- Fetch Sales Stats from GAS ----
  const fetchStats = useCallback(async (from: string, to: string): Promise<SalesStats | null> => {
    const result = await gasGet({ action: 'getStats', from, to });
    if (result?.success) {
      return { totals: result.totals, daily: result.daily };
    }
    return null;
  }, []);

  const value: StoreState = {
    orders,
    cart,
    language,
    isOnline,
    isSyncing,
    changeLanguage,
    addToCart,
    removeFromCart,
    clearCart,
    submitOrder,
    markAsPaid,
    updateOrderStatus,
    fetchStats,
    settings,
    updateSettings,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

// ==================== Hook ====================
export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}
