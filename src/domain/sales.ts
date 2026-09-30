import type { Order } from '../types';

/** Revenue only includes confirmed payments and excludes cancelled orders. */
export function isSalesOrder(order: Pick<Order, 'paid' | 'status'>): boolean {
  return order.paid && order.status !== 'Cancelled';
}
