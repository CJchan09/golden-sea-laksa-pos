import {describe, expect, it} from 'vitest';
import type {Order} from '../types';
import {buildSalesReport, getReportRange, receiptDate, reportingDate} from './reporting';
import {reportDays} from './auto-export';

const order = (overrides: Partial<Order> = {}): Order => ({local_order_id: 'uid-1', order_id: '1', timestamp: '2026-09-30 23:45:00', order_type: 'Takeaway', items_summary: 'Cake', items: [], total_qty: 2, total_amount: 9.9, status: 'Completed', paid: true, paid_at: '2026-10-01T01:00:00Z', payment_method: 'Cash', synced: false, ...overrides});
describe('receipt-date reports', () => {
  it('counts a payment on its Malaysian receipt day, with one union-ledger row', () => {
    const oldDay = buildSalesReport([order()], {from: '2026-09-30', to: '2026-09-30'});
    const paidDay = buildSalesReport([order(), order()], {from: '2026-10-01', to: '2026-10-01'});
    expect(oldDay.orders).toHaveLength(1);
    expect(oldDay.totals.revenue).toBe(0);
    expect(paidDay.orders).toHaveLength(1);
    expect(paidDay.totals).toEqual({orders: 1, quantity: 2, revenue: 9.9, cash: 9.9, qr: 0});
    expect(paidDay.daily[0].date).toBe('2026-10-01');
  });
  it('assigns cross-year receipts to the payment year and excludes cancelled/unpaid sales', () => {
    const paid = order({timestamp: '2025-12-31 23:00:00', paid_at: '2025-12-31T16:01:00Z'});
    expect(receiptDate(paid)).toBe('2026-01-01');
    const report = buildSalesReport([paid, order({local_order_id: 'cancel', status: 'Cancelled'}), order({local_order_id: 'unpaid', paid: false, paid_at: undefined})], getReportRange('year', '2026-04-03'));
    expect(report.orders).toHaveLength(3);
    expect(report.sales).toHaveLength(1);
    expect(report.totals.revenue).toBe(9.9);
  });
  it('keeps legacy receipt dates without fabricating a migration-day payment', () => {
    const legacy = order({paid_at: undefined});
    const report = buildSalesReport([legacy], getReportRange('day', '2026-09-30'));
    expect(report.legacyPaymentCount).toBe(1);
    expect(report.totals.revenue).toBe(9.9);
    expect(legacy.paid_at).toBeUndefined();
  });
  it('uses Monday weeks, real leap months and full historical years', () => {
    expect(getReportRange('week', '2026-01-01')).toEqual({from: '2025-12-29', to: '2026-01-04'});
    expect(getReportRange('month', '2024-02-15')).toEqual({from: '2024-02-01', to: '2024-02-29'});
    expect(getReportRange('year', '2025-01-03')).toEqual({from: '2025-01-01', to: '2025-12-31'});
    expect(reportingDate('2026-09-30T16:00:00Z')).toBe('2026-10-01');
  });
  it('prepares missed daily files including zero-sales days and deduplicates same-day rows', () => {
    const days = reportDays([order(), order()], '2026-09-30', '2026-10-02');
    expect([...days.keys()]).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
    expect(days.get('2026-09-30')).toHaveLength(1);
    expect(days.get('2026-10-01')).toHaveLength(1);
    expect(days.get('2026-10-02')).toEqual([]);
  });
});
