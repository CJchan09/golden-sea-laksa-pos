import { describe, expect, it, vi } from 'vitest';
import type { CartItem, ShopSettings } from '../types';
import { createCjposBackup, previewCjposBackup, backupPreviewToRead } from './cjpos-backup';
import { MemoryPosRepository, type PosRead } from './pos-idb';
import { createOrderMutation, malaysiaTimestamp, markPaidMutation, updateCartItemMutation } from './pos-operations';
import { PhotoUrlRegistry } from './pos-photos';
import { migrateLegacySnapshot } from './pos-legacy';

const item: CartItem = {
  id: 'cart-1', menuItemId: 'menu-1', sizeId: '', noodleBaseIds: [], addOnIds: [],
  itemName: { en: 'Sample item', zh: '示范商品' }, quantity: 1, unitPrice: 8.5, totalPrice: 8.5,
};

function settings(coverPhoto = ''): ShopSettings {
  return {
    shopNameEn: 'CJ POS Demo', shopNameZh: 'CJ POS 示范店', coverPhoto,
    qrImage: null, enableTax: false, taxRate: 6, takeawayFee: 0.5, defaultOrderType: 'Dine-in',
    menuItems: [{
      id: 'menu-1', name: { en: 'Sample item', zh: '示范商品' }, basePrice: 8.5,
      image: '', sizes: [], noodleBases: [], addOns: [], optionGroups: [],
    }],
  };
}

function initial(coverPhoto = ''): PosRead {
  return {
    state: { orders: [], cart: [item], settings: settings(coverPhoto), language: 'en', revision: 0 },
    photos: new Map(), photoVersions: {}, legacySnapshot: { golden_sea_laksa_orders: '[{"old":"record"}]' },
  };
}

describe('durable order mutations', () => {
  const now = new Date('2026-10-01T16:30:00.000Z');

  it('uses Kuala Lumpur wall time for order date, UTC for actual receipt time', async () => {
    const repo = new MemoryPosRepository(initial());
    const result = await repo.mutate(state => createOrderMutation(state, 'Dine-in', 'A1', 'Cash', now, 'order-1'));
    expect(result?.value).toBe('order-1');
    const saved = (await repo.read())!;
    expect(saved.state.orders).toHaveLength(1);
    expect(saved.state.orders[0]).toMatchObject({
      timestamp: '2026-10-02 00:30:00', paid: true, paid_at: '2026-10-01T16:30:00.000Z',
      payment_method: 'Cash', total_amount: 8.5,
    });
    expect(saved.state.cart).toEqual([]);
    expect(await repo.mutate(state => createOrderMutation(state, 'Dine-in', 'A1', 'Cash', now, 'order-2'))).toBeNull();
    expect((await repo.read())!.state.orders).toHaveLength(1);
  });

  it('rolls back failed order/cart transaction and permits one successful retry', async () => {
    const repo = new MemoryPosRepository(initial());
    repo.failNextWrite = new Error('quota');
    await expect(repo.mutate(state => createOrderMutation(state, 'Dine-in', 'A1', undefined, now, 'order-1'))).rejects.toThrow('quota');
    expect((await repo.read())!.state).toMatchObject({ orders: [], cart: [item], revision: 0 });
    await repo.mutate(state => createOrderMutation(state, 'Dine-in', 'A1', undefined, now, 'order-1'));
    expect((await repo.read())!.state.orders).toHaveLength(1);
    expect((await repo.read())!.state.cart).toEqual([]);
  });

  it('records payment exactly once without changing kitchen status or receipt date', async () => {
    const repo = new MemoryPosRepository(initial());
    await repo.mutate(state => createOrderMutation(state, 'Dine-in', 'A1', undefined, now, 'order-1'));
    await repo.mutate(state => markPaidMutation(state, 'order-1', 'QR Pay', now));
    const first = (await repo.read())!;
    expect(first.state.orders[0]).toMatchObject({ status: 'Pending', paid: true, paid_at: now.toISOString(), payment_method: 'QR Pay' });
    const revision = first.state.revision;
    await repo.mutate(state => markPaidMutation(state, 'order-1', 'Cash', new Date('2026-10-03T00:00:00Z')));
    const second = (await repo.read())!;
    expect(second.state.orders[0].paid_at).toBe(now.toISOString());
    expect(second.state.orders[0].payment_method).toBe('QR Pay');
    expect(second.state.revision).toBe(revision);
  });

  it('recalculates an edited cart line before checkout', async () => {
    const repo = new MemoryPosRepository(initial());
    await repo.mutate(state => updateCartItemMutation(state, 'cart-1', { quantity: 3, unitPrice: 9.25 }));
    expect((await repo.read())!.state.cart[0]).toMatchObject({ quantity: 3, unitPrice: 9.25, totalPrice: 27.75 });
  });

  it('formats the business timestamp independently of host timezone', () => {
    expect(malaysiaTimestamp(new Date('2026-10-01T16:30:00Z'))).toBe('2026-10-02 00:30:00');
  });
});

describe('legacy import', () => {
  it('preserves custom shop, orders, cart, and the raw legacy snapshot', async () => {
    const legacy = {
      golden_sea_laksa_settings: JSON.stringify({ ...settings(), shopNameEn: 'My Restaurant', shopNameZh: '我的店' }),
      golden_sea_laksa_orders: JSON.stringify([{ local_order_id: 'old-1', order_id: '10001', timestamp: '2025-01-01 12:00:00',
        order_type: 'Dine-in', table_no: '1', items_summary: 'old order', items: [item], total_qty: 1,
        total_amount: 8.5, status: 'Completed', paid: true, synced: false }]),
      golden_sea_laksa_cart: JSON.stringify([item]),
      golden_sea_laksa_lang: 'zh',
      golden_sea_laksa_qr_image: null,
      'cjpos.appData': '{"older":"payload"}',
    };
    const imported = await migrateLegacySnapshot(legacy, settings(), true);
    expect(imported.state.settings.shopNameEn).toBe('My Restaurant');
    expect(imported.state.settings.defaultOrderType).toBe('Dine-in');
    expect(imported.state.orders[0].local_order_id).toBe('old-1');
    expect(imported.state.cart[0].id).toBe('cart-1');
    expect(imported.state.language).toBe('zh');
    expect(imported.legacySnapshot).toEqual(legacy);
    const repository = new MemoryPosRepository();
    await repository.initialize(imported);
    expect((await repository.read())!.state.orders[0].local_order_id).toBe('old-1');
  });

  it('renames only the exact old sample identity in the Android app', async () => {
    const original = { ...settings(), shopNameEn: 'Golden Sea Laksa', shopNameZh: '金海叻沙' };
    const imported = await migrateLegacySnapshot({ golden_sea_laksa_settings: JSON.stringify(original) }, settings(), true);
    expect(imported.state.settings.shopNameEn).toBe('CJ POS Demo');
    expect(imported.legacySnapshot?.golden_sea_laksa_settings).toBe(JSON.stringify(original));
  });

  it('keeps old merchant order mode and Malay fallback when new sample defaults changed', async () => {
    const baseline = { ...settings(), defaultOrderType: 'Takeaway' as const, shopNameMs: 'Sample Malay name' };
    const oldMerchant = { ...settings(), shopNameEn: 'My Nasi Shop', shopNameZh: '我的店' };
    delete oldMerchant.defaultOrderType;
    const imported = await migrateLegacySnapshot({ golden_sea_laksa_settings: JSON.stringify(oldMerchant) }, baseline, true);
    const repository = new MemoryPosRepository();
    await repository.initialize(imported);
    const restarted = (await repository.read())!;
    expect(restarted.state.settings).toMatchObject({ shopNameEn: 'My Nasi Shop', shopNameMs: '', defaultOrderType: 'Dine-in' });
    expect(restarted.legacySnapshot?.golden_sea_laksa_settings).toBe(JSON.stringify(oldMerchant));

    const fresh = await migrateLegacySnapshot({}, baseline, true);
    expect(fresh.state.settings).toMatchObject({ shopNameMs: 'Sample Malay name', defaultOrderType: 'Takeaway' });
  });

  it('does not silently replace unreadable orders with an empty history', async () => {
    await expect(migrateLegacySnapshot({ golden_sea_laksa_orders: '{broken' }, settings(), true)).rejects.toThrow('Saved orders cannot be read');
  });
});

describe('.cjpos backup and photo lifetime', () => {
  it('round trips orders, settings, original photo bytes, and raw legacy snapshot', async () => {
    const source = initial('cjpos-photo:cover');
    const original = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
    source.photos.set('cover', original);
    source.photoVersions.cover = 'v1';
    source.state.orders.push(createOrderMutation(source.state, 'Dine-in', 'A1', undefined, new Date(), 'order-1')!.state.orders[0]);
    const backup = await createCjposBackup(source);
    const preview = await previewCjposBackup(backup);
    expect(preview).toMatchObject({ shopName: 'CJ POS Demo', orderCount: 1, menuItemCount: 1, photoCount: 1 });
    const restored = backupPreviewToRead(preview, 10);
    expect(restored.state.revision).toBe(11);
    expect(restored.legacySnapshot).toEqual(source.legacySnapshot);
    expect(new Uint8Array(await restored.photos.get('cover')!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it('rejects a missing photo and duplicate order IDs before replacing current data', async () => {
    const source = initial('cjpos-photo:cover');
    source.photos.set('cover', new Blob([new Uint8Array([1])], { type: 'image/png' }));
    const blob = await createCjposBackup(source);
    const document = JSON.parse(await blob.text());
    document.photos = [];
    await expect(previewCjposBackup(new Blob([JSON.stringify(document)]))).rejects.toThrow('photo cover is missing');
    document.photos = JSON.parse(await blob.text()).photos;
    const order = createOrderMutation(source.state, 'Dine-in', 'A1', undefined, new Date(), 'duplicate')!.state.orders[0];
    document.state.orders = [order, order];
    await expect(previewCjposBackup(new Blob([JSON.stringify(document)]))).rejects.toThrow('duplicated');
  });

  it('keeps existing data when a restore transaction fails', async () => {
    const repo = new MemoryPosRepository(initial());
    const backup = await createCjposBackup(initial());
    const preview = await previewCjposBackup(backup);
    const replacement = backupPreviewToRead(preview, 0);
    replacement.state.settings.shopNameEn = 'Replacement';
    repo.failNextWrite = new Error('disk full');
    await expect(repo.replace(replacement)).rejects.toThrow('disk full');
    expect((await repo.read())!.state.settings.shopNameEn).toBe('CJ POS Demo');
  });

  it('reuses photo URLs through unrelated revisions, and retains an old draft URL until unload', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    try {
      const registry = new PhotoUrlRegistry();
      const photos = new Map([['cover', new Blob([new Uint8Array([1])], { type: 'image/png' })]]);
      expect(registry.hydrate(settings('cjpos-photo:cover'), photos, { cover: 'v1' }).coverPhoto).toBe('blob:first');
      expect(registry.hydrate(settings('cjpos-photo:cover'), photos, { cover: 'v1' }).coverPhoto).toBe('blob:first');
      expect(registry.hydrate(settings('cjpos-photo:cover'), photos, { cover: 'v2' }).coverPhoto).toBe('blob:second');
      expect(revoke).not.toHaveBeenCalled();
      registry.revokeAll();
      expect(revoke).toHaveBeenCalledWith('blob:first');
    } finally { create.mockRestore(); revoke.mockRestore(); }
  });
});
