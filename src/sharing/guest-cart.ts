import type { CartItem } from '../types';

/** A modal keeps this ID until saving succeeds, so a retry replaces its optimistic row. */
export function upsertGuestCartItem(cart: CartItem[], item: Omit<CartItem, 'id'>, pendingId: string): CartItem[] {
  const saved = { ...item, id: pendingId };
  return cart.some(row => row.id === pendingId)
    ? cart.map(row => row.id === pendingId ? saved : row)
    : [...cart, saved];
}
