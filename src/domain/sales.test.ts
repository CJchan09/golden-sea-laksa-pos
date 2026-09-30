import { describe, expect, it } from 'vitest';
import { isSalesOrder } from './sales';

describe('isSalesOrder', () => {
  it('excludes completed orders that are still unpaid', () => {
    expect(isSalesOrder({paid: false, status: 'Completed'})).toBe(false);
  });

  it('counts a confirmed payment before kitchen completion', () => {
    expect(isSalesOrder({paid: true, status: 'Preparing'})).toBe(true);
  });

  it('counts a completed and paid order', () => {
    expect(isSalesOrder({paid: true, status: 'Completed'})).toBe(true);
  });

  it('excludes cancelled orders even if they were marked paid', () => {
    expect(isSalesOrder({paid: true, status: 'Cancelled'})).toBe(false);
  });
});
