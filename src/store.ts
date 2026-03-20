import { useState, useEffect, useCallback, useRef } from 'react';
import { Order, CartItem, Language, PaymentMethod, SalesStats } from './types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { GAS_URL, MENU_ITEMS, SIZES, NOODLE_BASES, ADD_ONS } from './constants';

const ORDERS_KEY = 'golden_sea_laksa_orders';
const CART_KEY = 'golden_sea_laksa_cart';
const LANG_KEY = 'golden_sea_laksa_lang';
const POLL_INTERVAL = 5000; // 5 seconds

// BroadcastChannel for same-browser cross-tab sync
const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('golden_sea_laksa_sync')
  : null;

// ==================== GAS API Helpers ====================
async function gasPost(data: Record<string, any>): Promise<any> {
  if (!GAS_URL) return null;
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // text/plain avoids CORS preflight
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

// ==================== Main Store Hook ====================
export function useStore() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [language, setLanguage] = useState<Language>('en');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // BroadcastChannel listener
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
            items: [], // Remote orders don't store full item detail, use summary
            paid: !!o.paid,
            synced: true,
          }));

          // Merge: remote orders take priority on status, local unsync'd orders preserved
          setOrders(prev => {
            const localUnsyncedIds = new Set(
              prev.filter(o => !o.synced).map(o => o.local_order_id)
            );
            
            // Start with remote orders
            const merged = [...remoteOrders];
            
            // Add local unsynced orders that don't exist remotely
            prev.forEach(o => {
              if (localUnsyncedIds.has(o.local_order_id) &&
                  !remoteOrders.find(r => r.local_order_id === o.local_order_id)) {
                merged.push(o);
              }
            });

            // Keep local items data if available
            const mergedWithItems = merged.map(m => {
              const local = prev.find(p => p.local_order_id === m.local_order_id);
              if (local && local.items && local.items.length > 0) {
                return { ...m, items: local.items };
              }
              return m;
            });

            // Sort by timestamp descending
            mergedWithItems.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            
            localStorage.setItem(ORDERS_KEY, JSON.stringify(mergedWithItems));
            return mergedWithItems;
          });
        }
      } catch (e) {
        // Polling failure is silent — we keep local data
      }
    };

    // Initial poll
    pollOrders();

    // Start interval
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

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem(CART_KEY, JSON.stringify(newCart));
  };

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(LANG_KEY, lang);
  };

  const addToCart = (item: Omit<CartItem, 'id'>) => {
    const newItem = { ...item, id: uuidv4() };
    saveCart([...cart, newItem]);
  };

  const removeFromCart = (id: string) => {
    saveCart(cart.filter(item => item.id !== id));
  };

  const clearCart = () => {
    saveCart([]);
  };

  const generateItemsSummary = (items: CartItem[], lang: Language): string => {
    return items.map(item => {
      const menuItem = MENU_ITEMS.find(m => m.id === item.menuItemId);
      const sizeName = SIZES.find(s => s.id === item.size)?.name[lang];
      const noodles = item.noodleBases.map(n => NOODLE_BASES.find(nb => nb.id === n)?.name[lang]).join('+');
      const addons = item.addOns.map(a => ADD_ONS.find(ao => ao.id === a)?.name[lang]).join(',');
      
      let summary = `${item.quantity}x ${menuItem?.name[lang]}-${sizeName}-${noodles}`;
      if (addons) summary += `-加${addons}`;
      return summary;
    }).join('; ');
  };

  // ---- Submit Order ----
  const submitOrder = async (orderType: 'Dine-in' | 'Takeaway', tableNo?: string) => {
    if (cart.length === 0) return;

    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cart.reduce((sum, item) => sum + item.totalPrice, 0);
    const itemsSummary = generateItemsSummary(cart, language);
    
    const todayCount = orders.filter(o => o.timestamp.startsWith(format(new Date(), 'yyyy-MM-dd'))).length;
    const orderId = `JH-${2000 + todayCount + 1}`;

    const newOrder: Order = {
      local_order_id: uuidv4(),
      order_id: orderId,
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      order_type: orderType,
      table_no: tableNo,
      items_summary: itemsSummary,
      items: [...cart],
      total_qty: totalQty,
      total_amount: totalAmount,
      status: 'Pending',
      paid: false,
      synced: false
    };

    const updatedOrders = [newOrder, ...orders];
    saveOrders(updatedOrders);
    clearCart();

    // Sync to Google Sheet
    const result = await gasPost({
      action: 'addOrder',
      ...newOrder,
      items: undefined, // Don't send full cart items to GAS
    });
    if (result?.success) {
      const syncedOrders = updatedOrders.map(o =>
        o.local_order_id === newOrder.local_order_id ? { ...o, synced: true } : o
      );
      saveOrders(syncedOrders);
    }
  };

  // ---- Mark as Paid ----
  const markAsPaid = async (localOrderId: string, paymentMethod: PaymentMethod) => {
    const updatedOrders = orders.map(o =>
      o.local_order_id === localOrderId
        ? { ...o, paid: true, payment_method: paymentMethod, status: 'Preparing' as const }
        : o
    );
    saveOrders(updatedOrders);

    await gasPost({
      action: 'updateStatus',
      local_order_id: localOrderId,
      status: 'Preparing',
      paid: true,
      payment_method: paymentMethod,
    });
  };

  // ---- Update Order Status ----
  const updateOrderStatus = async (localOrderId: string, status: 'Preparing' | 'Completed' | 'Cancelled') => {
    const updatedOrders = orders.map(o =>
      o.local_order_id === localOrderId ? { ...o, status } : o
    );
    saveOrders(updatedOrders);

    await gasPost({
      action: 'updateStatus',
      local_order_id: localOrderId,
      status,
    });
  };

  // ---- Fetch Sales Stats from GAS ----
  const fetchStats = async (from: string, to: string): Promise<SalesStats | null> => {
    const result = await gasGet({ action: 'getStats', from, to });
    if (result?.success) {
      return { totals: result.totals, daily: result.daily };
    }
    return null;
  };

  return {
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
  };
}
