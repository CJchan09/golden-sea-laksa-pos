import type { CartItem, OrderType, ShopSettings } from '../types';

/** Round at money boundaries, calculate tax once on subtotal plus packing fee. */
export function calculateOrderAmounts(cart: CartItem[], settings: ShopSettings, orderType: OrderType) {
  const subtotalSen = cart.reduce((sum, item) => sum + Math.round(item.totalPrice * 100), 0);
  const feeSen = cart.length > 0 && orderType === 'Takeaway' ? Math.max(0, Math.round(settings.takeawayFee * 100)) : 0;
  const taxSen = settings.enableTax ? Math.round((subtotalSen + feeSen) * settings.taxRate / 100) : 0;
  return { subtotal: subtotalSen / 100, takeawayFee: feeSen / 100, taxAmount: taxSen / 100,
    totalAmount: (subtotalSen + feeSen + taxSen) / 100 };
}
