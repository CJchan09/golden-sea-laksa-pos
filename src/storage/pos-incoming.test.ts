import { describe, expect, it } from 'vitest';
import type { CartItem, MenuItem, ShopSettings } from '../types';
import { parseOrderRequest, requestFingerprint, requestMenuRevision, type OrderRequest } from '../sharing/protocol';
import { acceptIncomingOrderMutation } from './pos-operations';
import { MemoryPosRepository, type PosRead } from './pos-idb';
import { backupPreviewToRead, createCjposBackup, previewCjposBackup } from './cjpos-backup';

const menuItem = (price: number): MenuItem => ({
  id: 'meal-1', name: { en: 'Meal', zh: '餐点' }, basePrice: price, image: '',
  sizes: [], noodleBases: [], addOns: [], optionGroups: [],
});
const staffCart: CartItem = {
  id: 'staff-line', menuItemId: 'meal-1', sizeId: '', noodleBaseIds: [], addOnIds: [],
  quantity: 1, unitPrice: 9, totalPrice: 9,
};
const issuedAt = '2026-10-01T01:00:00.000Z';
function settings(): ShopSettings {
  return {
    shopId: 'shop-1', whatsappNumber: '60123456789', shopNameEn: 'Merchant', shopNameZh: '商家',
    coverPhoto: '', qrImage: null, menuItems: [menuItem(9)], enableTax: false, taxRate: 6,
    takeawayFee: 0.5, issuedMenus: [{ menuId: 'menu-1', createdAt: issuedAt,
      menuItems: [menuItem(8)], enableTax: false, taxRate: 6, takeawayFee: 0.5 }],
  };
}
function initial(): PosRead {
  return { state: { orders: [], cart: [staffCart], settings: settings(), language: 'en', revision: 0 },
    photos: new Map(), photoVersions: {}, legacySnapshot: null };
}
function request(overrides: Partial<OrderRequest> = {}): OrderRequest {
  return parseOrderRequest({ kind: 'cjpos.order', version: 1, requestId: 'request-1', shopId: 'shop-1',
    menuId: 'menu-1', createdAt: issuedAt, language: 'en', customer: {
      name: 'Ada', phone: '+60123456789', address: '12 Main Street', note: 'No cutlery',
    }, orderType: 'Takeaway', lines: [{ menuItemId: 'meal-1', quantity: 1, selections: {} }],
    quotedTotalSen: 850, ...overrides });
}
const now = new Date('2026-10-01T04:00:00.000Z');

describe('incoming order transaction', () => {
  it('validates the issued quote, uses current local prices, saves unpaid, and keeps the staff cart', async () => {
    const repo = new MemoryPosRepository(initial());
    const incoming = request();
    const result = await repo.mutate(state => acceptIncomingOrderMutation(state, incoming, 950, now, 'local-1'));
    expect(result?.value).toEqual({ localOrderId: 'local-1', duplicate: false });
    const saved = (await repo.read())!.state;
    expect(saved.cart).toEqual([staffCart]);
    expect(saved.orders[0]).toMatchObject({
      local_order_id: 'local-1', order_type: 'Takeaway', total_amount: 9.5,
      status: 'Pending', paid: false, synced: false, customer: incoming.customer,
      sourceRequestId: incoming.requestId, sourceMenuId: incoming.menuId,
      sourceFingerprint: requestFingerprint(incoming),
    });
    expect(saved.orders[0].paid_at).toBeUndefined();
    expect(saved.orders[0].payment_method).toBeUndefined();
  });

  it('returns the existing order for the same request even after the menu changes; rejects conflicting contents', async () => {
    const repo = new MemoryPosRepository(initial());
    const incoming = request();
    const previewRevision = requestMenuRevision(incoming, (await repo.read())!.state.settings);
    await repo.mutate(state => acceptIncomingOrderMutation(state, incoming, 950, now, 'local-1', previewRevision));
    await repo.mutate(state => ({ state: { ...state, settings: { ...state.settings, menuItems: [] } }, value: true }));
    const before = (await repo.read())!.state.revision;
    const duplicate = await repo.mutate(state => acceptIncomingOrderMutation(state, incoming, 950, now, 'local-2', previewRevision));
    expect(duplicate?.value).toEqual({ localOrderId: 'local-1', duplicate: true });
    expect((await repo.read())!.state.revision).toBe(before);
    await expect(repo.mutate(state => acceptIncomingOrderMutation(state,
      request({ customer: { ...incoming.customer, note: 'Changed' } }), 950, now, 'local-3')))
      .rejects.toThrow('REQUEST_CONFLICT');
    expect((await repo.read())!.state.orders).toHaveLength(1);
  });

  it('rejects a same-price menu rename between preview and the accept transaction', async () => {
    const repo = new MemoryPosRepository(initial());
    const incoming = request();
    const previewRevision = requestMenuRevision(incoming, (await repo.read())!.state.settings);
    await repo.mutate(state => ({ state: { ...state, settings: { ...state.settings,
      menuItems: state.settings.menuItems.map(item => ({ ...item, name: { en: 'Renamed', zh: '已改名' } })),
    } }, value: true }));
    await expect(repo.mutate(state => acceptIncomingOrderMutation(state, incoming, 950, now, 'local-1', previewRevision)))
      .rejects.toThrow('PRICE_CHANGED');
    expect((await repo.read())!.state).toMatchObject({ orders: [], cart: [staffCart] });
  });

  it('rejects a new required option even when the displayed total would stay the same', async () => {
    const repo = new MemoryPosRepository(initial());
    const incoming = request();
    const previewRevision = requestMenuRevision(incoming, (await repo.read())!.state.settings);
    await repo.mutate(state => ({ state: { ...state, settings: { ...state.settings,
      menuItems: state.settings.menuItems.map(item => ({ ...item, optionGroups: [{
        id: 'spice', names: { en: 'Spice', zh: '辣度' }, required: true,
        minSelect: 1, maxSelect: 1, sortOrder: 0, choices: [{
          id: 'mild', names: { en: 'Mild', zh: '微辣' }, priceDeltaSen: 0, enabled: true, sortOrder: 0,
        }],
      }] })),
    } }, value: true }));
    await expect(repo.mutate(state => acceptIncomingOrderMutation(state, incoming, 950, now, 'local-1', previewRevision)))
      .rejects.toThrow('PRICE_CHANGED');
    expect((await repo.read())!.state).toMatchObject({ orders: [], cart: [staffCart] });
  });

  it('rejects wrong shop, unissued menu, forged quote, or stale current price without touching records', async () => {
    const repo = new MemoryPosRepository(initial());
    const attempts: [OrderRequest, number, string][] = [
      [request({ shopId: 'other-shop' }), 950, 'WRONG_SHOP'],
      [request({ menuId: 'missing' }), 950, 'MENU_NOT_ISSUED'],
      [request({ quotedTotalSen: 1 }), 950, 'QUOTE_MISMATCH'],
      [request(), 850, 'PRICE_CHANGED'],
    ];
    for (const [incoming, expected, code] of attempts) {
      await expect(repo.mutate(state => acceptIncomingOrderMutation(state, incoming, expected, now, 'local')))
        .rejects.toThrow(code);
    }
    expect((await repo.read())!.state).toMatchObject({ orders: [], cart: [staffCart], revision: 0 });
  });

  it('rolls back a failed write and safely accepts a later retry', async () => {
    const repo = new MemoryPosRepository(initial());
    repo.failNextWrite = new Error('quota');
    await expect(repo.mutate(state => acceptIncomingOrderMutation(state, request(), 950, now, 'local-1'))).rejects.toThrow('quota');
    expect((await repo.read())!.state).toMatchObject({ orders: [], cart: [staffCart], revision: 0 });
    await repo.mutate(state => acceptIncomingOrderMutation(state, request(), 950, now, 'local-1'));
    expect((await repo.read())!.state.orders).toHaveLength(1);
  });
});

describe('incoming-order backup compatibility', () => {
  it('round-trips shop identity, issued menus, and imported customer/source details', async () => {
    const repo = new MemoryPosRepository(initial());
    await repo.mutate(state => acceptIncomingOrderMutation(state, request(), 950, now, 'local-1'));
    const backup = await createCjposBackup((await repo.read())!);
    const preview = await previewCjposBackup(backup);
    const restored = backupPreviewToRead(preview, 10);
    expect(restored.state.settings).toMatchObject({ shopId: 'shop-1', whatsappNumber: '60123456789' });
    expect(restored.state.settings.issuedMenus).toHaveLength(1);
    expect(restored.state.orders[0]).toMatchObject({ customer: { name: 'Ada' }, sourceRequestId: 'request-1' });
  });

  it('gives a pre-sharing backup a new identity without losing its existing records', async () => {
    const previous = initial();
    delete previous.state.settings.shopId;
    delete previous.state.settings.whatsappNumber;
    delete previous.state.settings.issuedMenus;
    const restored = backupPreviewToRead(await previewCjposBackup(await createCjposBackup(previous)), 0);
    expect(restored.state.settings.shopId).toBeTruthy();
    expect(restored.state.cart).toEqual([staffCart]);
  });
});
