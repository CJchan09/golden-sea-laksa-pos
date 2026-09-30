import type {Order} from '../types';
import {isSalesOrder} from './sales';

export const REPORT_TIME_ZONE = 'Asia/Kuala_Lumpur';
export type ReportPeriod = 'day' | 'week' | 'month' | 'year';
export interface ReportRange {from: string; to: string}
export interface ReportTotals {orders: number; quantity: number; revenue: number; cash: number; qr: number}
export interface DailyReport extends ReportTotals {date: string}
export interface SalesReport {
  range: ReportRange;
  orders: Order[];
  sales: Order[];
  totals: ReportTotals;
  daily: DailyReport[];
  legacyPaymentCount: number;
}

/** Old local timestamps already represent the merchant's wall-clock date. */
export function reportingDate(value: string | Date = new Date()): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?: |$)/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: REPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
  return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key)?.value ?? '').join('-');
}

export function receiptDate(order: Order): string {
  return order.paid ? reportingDate(order.paid_at || order.timestamp) : '';
}

export function inReportRange(date: string, range: ReportRange): boolean {
  return Boolean(date) && date >= range.from && date <= range.to;
}

function dateString(date: Date): string {return date.toISOString().slice(0, 10);}
export function getReportRange(period: ReportPeriod, anchor: string): ReportRange {
  const date = new Date(`${anchor}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || dateString(date) !== anchor) throw new Error('Invalid report date');
  const year = date.getUTCFullYear(), month = date.getUTCMonth();
  if (period === 'day') return {from: anchor, to: anchor};
  if (period === 'month') return {from: dateString(new Date(Date.UTC(year, month, 1))), to: dateString(new Date(Date.UTC(year, month + 1, 0)))};
  if (period === 'year') return {from: `${year}-01-01`, to: `${year}-12-31`};
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
  return {from: dateString(monday), to: dateString(sunday)};
}

function emptyTotals(): ReportTotals {return {orders: 0, quantity: 0, revenue: 0, cash: 0, qr: 0};}
function addOrder(totals: ReportTotals, order: Order): void {
  totals.orders++;
  totals.quantity += order.total_qty;
  // Accumulate integer sen, avoiding binary rounding in repeated daily totals.
  totals.revenue = (Math.round(totals.revenue * 100) + Math.round(order.total_amount * 100)) / 100;
  const key = order.payment_method === 'Cash' ? 'cash' : order.payment_method === 'QR Pay' ? 'qr' : null;
  if (key) totals[key] = (Math.round(totals[key] * 100) + Math.round(order.total_amount * 100)) / 100;
}

export function buildSalesReport(allOrders: Order[], range: ReportRange): SalesReport {
  // An order created and paid in this range is still only one ledger row.
  const unique = [...new Map(allOrders.map(order => [order.local_order_id, order])).values()];
  const orders = unique.filter(order => inReportRange(reportingDate(order.timestamp), range) || inReportRange(receiptDate(order), range))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.local_order_id.localeCompare(b.local_order_id));
  const sales = orders.filter(order => isSalesOrder(order) && inReportRange(receiptDate(order), range));
  const totals = emptyTotals();
  const byDay = new Map<string, DailyReport>();
  for (const order of sales) {
    addOrder(totals, order);
    const date = receiptDate(order);
    const day = byDay.get(date) || {date, ...emptyTotals()};
    addOrder(day, order); byDay.set(date, day);
  }
  return {range, orders, sales, totals, daily: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)), legacyPaymentCount: sales.filter(order => !order.paid_at).length};
}
