import type { CartItem, Language, Order, OrderStatus, OrderType, PaymentMethod } from '../types';
import { getCartItemDisplay } from '../domain/cart-item-display';
import { calculateOrderAmounts } from '../domain/order-amounts';
import { parseOrderRequest, rebuildRequestCart, requestFingerprint, requestMenuRevision, SharingError, type OrderRequest } from '../sharing/protocol';
import type { PosMutation, PosState } from './pos-idb';

function summary(items: CartItem[], state: PosState): string {
  return items.map(item => {
    const menuItem = state.settings.menuItems.find(menu => menu.id === item.menuItemId);
    const display = getCartItemDisplay(item, menuItem, state.language);
    return `${item.quantity}x ${display.itemName}${display.details.length ? `-${display.details.join('-')}` : ''}`;
  }).join('; ');
}

/** Legacy order timestamps are Kuala Lumpur wall time; keep that contract. */
export function malaysiaTimestamp(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`;
}

function nextDisplayNumber(orders: Order[], timestamp: string): string {
  const month = Number(timestamp.slice(5, 7));
  const monthText = timestamp.slice(0, 7);
  const floor = month * 10000;
  const max = orders
    .filter(order => order.timestamp.startsWith(monthText))
    .reduce((largest, order) => {
      const number = Number(order.order_id);
    return Number.isSafeInteger(number) && number > floor
      ? Math.max(largest, number)
      : largest;
    }, floor);
  if (max === Number.MAX_SAFE_INTEGER) throw new Error('Monthly order number range is exhausted.');
  return String(max + 1);
}

export interface IncomingOrderResult { localOrderId: string; duplicate: boolean }

/** Recheck an external request against issued and current menus inside the IDB write transaction. */
export function acceptIncomingOrderMutation(
  state: PosState,
  input: OrderRequest,
  expectedTotalSen: number,
  now: Date,
  localOrderId: string,
  expectedMenuRevision?: string,
): PosMutation<IncomingOrderResult> {
  const request = parseOrderRequest(input);
  const fingerprint = requestFingerprint(request);
  if (!state.settings.shopId || request.shopId !== state.settings.shopId) throw new SharingError('WRONG_SHOP');
  const duplicate = state.orders.find(order => order.sourceRequestId === request.requestId);
  if (duplicate) {
    if (duplicate.sourceFingerprint !== fingerprint) throw new SharingError('REQUEST_CONFLICT');
    return { state, value: { localOrderId: duplicate.local_order_id, duplicate: true }, changed: false };
  }

  const issued = state.settings.issuedMenus?.find(menu => menu.menuId === request.menuId);
  if (!issued) throw new SharingError('MENU_NOT_ISSUED');
  const quotedCart = rebuildRequestCart(request, { menuItems: issued.menuItems });
  const issuedAmounts = calculateOrderAmounts(quotedCart, {
    ...state.settings, menuItems: issued.menuItems, enableTax: issued.enableTax,
    taxRate: issued.taxRate, takeawayFee: issued.takeawayFee,
  }, 'Takeaway');
  if (Math.round(issuedAmounts.totalAmount * 100) !== request.quotedTotalSen) throw new SharingError('QUOTE_MISMATCH');

  if (expectedMenuRevision !== undefined) {
    let currentRevision: string;
    try { currentRevision = requestMenuRevision(request, state.settings); }
    catch (error) {
      if (error instanceof SharingError) throw new SharingError('PRICE_CHANGED');
      throw error;
    }
    if (currentRevision !== expectedMenuRevision) throw new SharingError('PRICE_CHANGED');
  }

  const cart = rebuildRequestCart(request, state.settings).map(item => {
    const menu = state.settings.menuItems.find(candidate => candidate.id === item.menuItemId)!;
    return { ...item,
      sizeSelection: menu.sizes.find(choice => choice.id === item.sizeId),
      addOnSelections: menu.addOns.filter(choice => item.addOnIds.includes(choice.id)),
    };
  });
  const amounts = calculateOrderAmounts(cart, state.settings, 'Takeaway');
  if (!Number.isSafeInteger(expectedTotalSen) || expectedTotalSen < 0 || Math.round(amounts.totalAmount * 100) !== expectedTotalSen) {
    throw new SharingError('PRICE_CHANGED');
  }
  const timestamp = malaysiaTimestamp(now);
  const order: Order = {
    local_order_id: localOrderId,
    order_id: nextDisplayNumber(state.orders, timestamp),
    timestamp,
    order_type: 'Takeaway',
    items_summary: summary(cart, state),
    items: cart,
    total_qty: cart.reduce((total, item) => total + item.quantity, 0),
    subtotal: amounts.subtotal,
    takeaway_fee: amounts.takeawayFee,
    tax_amount: amounts.taxAmount,
    total_amount: amounts.totalAmount,
    status: 'Pending',
    paid: false,
    synced: false,
    customer: structuredClone(request.customer),
    sourceRequestId: request.requestId,
    sourceFingerprint: fingerprint,
    sourceMenuId: request.menuId,
  };
  return { state: { ...state, orders: [order, ...state.orders] }, value: { localOrderId, duplicate: false } };
}

export function createOrderMutation(
  state: PosState,
  orderType: OrderType,
  tableNo: string | undefined,
  confirmedPaymentMethod: PaymentMethod | undefined,
  now: Date,
  localOrderId: string,
): PosMutation<string> | null {
  if (state.cart.length === 0) return null;
  if (orderType === 'Dine-in' && !tableNo?.trim()) return null;
  if (state.cart.some(item => !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.totalPrice))) return null;
  const cart = structuredClone(state.cart);
  const amounts = calculateOrderAmounts(cart, state.settings, orderType);
  const timestamp = malaysiaTimestamp(now);
  const order: Order = {
    local_order_id: localOrderId,
    order_id: nextDisplayNumber(state.orders, timestamp),
    timestamp,
    order_type: orderType,
    table_no: orderType === 'Dine-in' ? tableNo?.trim() : undefined,
    items_summary: summary(cart, state),
    items: cart,
    total_qty: cart.reduce((total, item) => total + item.quantity, 0),
    subtotal: amounts.subtotal,
    takeaway_fee: amounts.takeawayFee,
    tax_amount: amounts.taxAmount,
    total_amount: amounts.totalAmount,
    status: 'Pending',
    paid: !!confirmedPaymentMethod,
    paid_at: confirmedPaymentMethod ? now.toISOString() : undefined,
    payment_method: confirmedPaymentMethod,
    synced: false,
  };
  return {
    state: { ...state, orders: [order, ...state.orders], cart: [] },
    value: localOrderId,
  };
}

export function markPaidMutation(state: PosState, localOrderId: string, method: PaymentMethod, now: Date): PosMutation<boolean> | null {
  const order = state.orders.find(item => item.local_order_id === localOrderId);
  if (!order || order.status === 'Cancelled') return null;
  if (order.paid) return { state, value: true, changed: false };
  return {
    state: {
      ...state,
      orders: state.orders.map(item => item.local_order_id === localOrderId
        ? { ...item, paid: true, paid_at: now.toISOString(), payment_method: method }
        : item),
    },
    value: true,
  };
}

export function updateStatusMutation(state: PosState, localOrderId: string, status: Exclude<OrderStatus, 'Pending'>): PosMutation<boolean> | null {
  const order = state.orders.find(item => item.local_order_id === localOrderId);
  if (!order || order.status === 'Cancelled') return null;
  if (order.status === status) return { state, value: true, changed: false };
  if (order.status === 'Completed' && status === 'Preparing') return null;
  return {
    state: {
      ...state,
      orders: state.orders.map(item => item.local_order_id === localOrderId ? { ...item, status } : item),
    },
    value: true,
  };
}

export function changeLanguageMutation(state: PosState, language: Language): PosMutation<boolean> {
  if (state.language === language) return { state, value: true, changed: false };
  return { state: { ...state, language }, value: true };
}

export function addCartItemMutation(state: PosState, item: Omit<CartItem, 'id'>, id: string): PosMutation<boolean> | null {
  if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice)) return null;
  const newItem: CartItem = {
    ...structuredClone(item),
    id,
    totalPrice: Math.round(item.unitPrice * item.quantity * 100) / 100,
  };
  return { state: { ...state, cart: [...state.cart, newItem] }, value: true };
}

export function updateCartItemMutation(state: PosState, id: string, patch: Partial<Omit<CartItem, 'id'>>): PosMutation<boolean> | null {
  const old = state.cart.find(item => item.id === id);
  if (!old) return null;
  const quantity = patch.quantity ?? old.quantity;
  const unitPrice = patch.unitPrice ?? old.unitPrice;
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return null;
  const next: CartItem = {
    ...old,
    ...structuredClone(patch),
    id,
    quantity,
    unitPrice,
    totalPrice: Math.round(unitPrice * quantity * 100) / 100,
  };
  return { state: { ...state, cart: state.cart.map(item => item.id === id ? next : item) }, value: true };
}

export function removeCartItemMutation(state: PosState, id: string): PosMutation<boolean> | null {
  if (!state.cart.some(item => item.id === id)) return null;
  return { state: { ...state, cart: state.cart.filter(item => item.id !== id) }, value: true };
}

export function clearCartMutation(state: PosState): PosMutation<boolean> {
  if (state.cart.length === 0) return { state, value: true, changed: false };
  return { state: { ...state, cart: [] }, value: true };
}
