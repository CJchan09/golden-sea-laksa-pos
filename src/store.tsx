import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Order, CartItem, Language, PaymentMethod, SalesStats, ShopSettings } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { GAS_URL, MENU_ITEMS as DEFAULT_MENU_ITEMS, SIZES, NOODLE_BASES, ADD_ONS } from './constants';

const ORDERS_KEY = 'golden_sea_laksa_orders';
const CART_KEY = 'golden_sea_laksa_cart';
const LANG_KEY = 'golden_sea_laksa_lang';
const SETTINGS_KEY = 'golden_sea_laksa_settings';
const POLL_INTERVAL = 5000; // 5 seconds

const DEFAULT_SETTINGS: ShopSettings = {
  shopNameEn: 'Golden Sea Laksa',
  shopNameZh: '金海叻沙',
  coverPhoto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCjegoCLzYirXlh1HTLs2_xx75ZJoMPr5SyRVMiS8xTZ1uHZhqRoWFrEDGlID_-pHYBji24mgud-wfj8HtJWpu5iDpCcuWU-on863ufLGMwqrB01nDP6Xq_QxfBQMYBFa5xys0XxG-KzBmBkXxEo0FSPF4OAZhLvJ9s6wn1yhcxFlgwpnkNCm7tg29l-8URv4vqEQliXrBD2PKOqGjwXRKUN9QqkYXarnIo5-Gpzgyqq1vMsjMMadsKz-1Yq96yxHxnRWaQib9OFU2w',
  qrImage: null,
  menuItems: DEFAULT_MENU_ITEMS
};

// BroadcastChannel for cross-tab sync (different browser tabs)
const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('golden_sea_laksa_sync')
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
    // Also try to migrate old QR image format if any
    const oldQr = localStorage.getItem('golden_sea_laksa_qr_image');
    if (oldQr) {
      DEFAULT_SETTINGS.qrImage = oldQr;
      localStorage.removeItem('golden_sea_laksa_qr_image');
    }
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a ref to orders so async functions always have the latest
  const ordersRef = useRef<Order[]>(orders);
  ordersRef.current = orders;

  // ---- Load initial state ----
  useEffect(() => {
    const storedOrders = localStorage.getItem(ORDERS_KEY);
    if (storedOrders) setOrders(JSON.parse(storedOrders));

    const storedCart = localStorage.getItem(CART_KEY);
    if (storedCart) setCart(JSON.parse(storedCart));

    const storedLang = localStorage.getItem(LANG_KEY);
    if (storedLang) setLanguage(storedLang as Language);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // BroadcastChannel listener (for cross-tab sync)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'orders_updated') {
        setOrders(event.data.orders);
      }
    };
    channel?.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
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
      const sizeName = SIZES.find(s => s.id === item.size)?.name[lang];
      const noodles = item.noodleBases.map(n => NOODLE_BASES.find(nb => nb.id === n)?.name[lang]).join('+');
      const addons = item.addOns.map(a => ADD_ONS.find(ao => ao.id === a)?.name[lang]).join(',');
      
      let summary = `${item.quantity}x ${menuItem?.name[lang]}-${sizeName}-${noodles}`;
      if (addons) summary += `-加${addons}`;
      return summary;
    }).join('; ');
  };

  // ---- Submit Order ----
  const submitOrder = useCallback(async (orderType: 'Dine-in' | 'Takeaway', tableNo?: string): Promise<string | null> => {
    // Read current cart from state ref
    const currentCart = cart;
    if (currentCart.length === 0) return null;

    const totalQty = currentCart.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = currentCart.reduce((sum, item) => sum + item.totalPrice, 0);
    const itemsSummary = generateItemsSummary(currentCart, language);
    
    const currentOrders = ordersRef.current;
    const todayCount = currentOrders.filter(o => o.timestamp.startsWith(format(new Date(), 'yyyy-MM-dd'))).length;
    const orderId = `JH-${2000 + todayCount + 1}`;

    const newOrder: Order = {
      local_order_id: uuidv4(),
      order_id: orderId,
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      order_type: orderType,
      table_no: tableNo,
      items_summary: itemsSummary,
      items: [...currentCart],
      total_qty: totalQty,
      total_amount: totalAmount,
      status: 'Pending',
      paid: false,
      synced: false
    };

    const updatedOrders = [newOrder, ...currentOrders];
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
      const updated = prev.map(o =>
        o.local_order_id === localOrderId
          ? { ...o, paid: true, payment_method: paymentMethod, status: 'Preparing' as const }
          : o
      );
      localStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
      broadcastOrders(updated);
      return updated;
    });

    gasPost({
      action: 'updateStatus',
      local_order_id: localOrderId,
      status: 'Preparing',
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
