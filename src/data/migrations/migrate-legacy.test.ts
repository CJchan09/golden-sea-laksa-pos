import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '../../domain/result';
import { createEmptyAppData } from '../schema-defaults';
import { AppDataRepository } from '../../storage/app-data-repository';
import { MemoryDriver } from '../../storage/driver';
import { MIGRATION_STATE_KEY } from '../../storage/keys';
import {
  LEGACY_ORDERS_KEY,
  LEGACY_QR_IMAGE_KEY,
  LEGACY_SETTINGS_KEY,
  PRESERVED_LEGACY_PAYLOAD_KEY,
} from './legacy-keys';
import { LEGACY_CATEGORY_ID, LegacySource, migrateLegacyData } from './migrate-legacy';
import { runMigrationIfNeeded } from './run-migration';

// ==================== Fixtures ====================

const LEGACY_SETTINGS = {
  shopNameEn: 'Golden Sea Laksa',
  shopNameZh: '金海叻沙',
  coverPhoto: 'data:image/png;base64,COVER',
  qrImage: 'data:image/png;base64,QR',
  enableTax: true,
  taxRate: 6,
  takeawayFee: 0.5,
  menuItems: [
    {
      id: 'm1',
      name: { en: 'Laksa Without Kerang', zh: '叻沙(没血蛤)' },
      basePrice: 8.0,
      image: 'https://example.test/laksa.jpg',
      sizes: [
        { id: 'Small', name: { en: 'Small', zh: '小碗' }, price: 0 },
        { id: 'Big', name: { en: 'Big', zh: '大碗' }, price: 1.0 },
      ],
      noodleBases: [{ id: 'Bee Hoon', name: { en: 'Bee Hoon', zh: '米粉' }, price: 0 }],
      addOns: [{ id: 'Add Egg', name: { en: 'Add Egg', zh: '加蛋' }, price: 1.0 }],
    },
  ],
};

const LEGACY_ORDERS = [
  {
    local_order_id: 'uuid-order-1',
    order_id: '30001',
    timestamp: '2026-03-21 14:05:00',
    order_type: 'Takeaway' as const,
    items: [
      {
        id: 'line-1',
        menuItemId: 'm1',
        sizeId: 'Big',
        noodleBaseIds: ['Bee Hoon'],
        addOnIds: ['Add Egg'],
        quantity: 1,
        unitPrice: 10.0,
        totalPrice: 10.0,
      },
    ],
    subtotal: 10.0,
    takeaway_fee: 0.5,
    tax_amount: 0.63,
    total_amount: 11.13,
    status: 'Completed' as const,
    paid: true,
    payment_method: 'Cash' as const,
    synced: true,
  },
  {
    local_order_id: 'uuid-order-2',
    order_id: '30002',
    // After midnight: belongs to the previous business date.
    timestamp: '2026-03-22 02:30:00',
    order_type: 'Dine-in' as const,
    table_no: 'T04',
    items: [],
    subtotal: 8.0,
    total_amount: 8.0,
    status: 'Cancelled' as const,
    paid: false,
  },
];

function sourceOf(entries: Record<string, string>): LegacySource {
  return { get: (key) => entries[key] ?? null };
}

const FULL_SOURCE = sourceOf({
  [LEGACY_SETTINGS_KEY]: JSON.stringify(LEGACY_SETTINGS),
  [LEGACY_ORDERS_KEY]: JSON.stringify(LEGACY_ORDERS),
});

// ==================== Success path ====================

describe('migrateLegacyData - success', () => {
  it('migrates settings, menu and orders', () => {
    const result = migrateLegacyData(FULL_SOURCE, { businessId: 'biz_1' });
    expect(result.ok).toBe(true);
    if (isErr(result)) return;

    const { data, report } = result.value;
    expect(report.ordersMigrated).toBe(2);
    expect(report.ordersSkippedInvalid).toBe(0);
    expect(data.businessProfile.displayName).toBe('Golden Sea Laksa');
    expect(data.businessProfile.secondaryName).toBe('金海叻沙');
    expect(data.menuItems).toHaveLength(1);
    expect(data.menuItems[0].basePriceSen).toBe(800);
  });

  it('converts every amount to integer sen', () => {
    const result = migrateLegacyData(FULL_SOURCE, { businessId: 'biz_1' });
    if (isErr(result)) throw new Error('expected success');

    const order = result.value.data.orders.find((o) => o.orderUid === 'uuid-order-1')!;
    expect(order.subtotalSen).toBe(1000);
    expect(order.totalSen).toBe(1113);
    expect(order.charges.map((c) => c.amountSen)).toEqual([50, 63]);
    expect(Number.isInteger(order.lines[0].lineTotalSen)).toBe(true);
  });

  it('preserves the display number exactly as the customer received it', () => {
    const result = migrateLegacyData(FULL_SOURCE, { businessId: 'biz_1' });
    if (isErr(result)) throw new Error('expected success');

    const numbers = result.value.data.orders.map((o) => o.displayNumber);
    expect(numbers).toEqual(['30001', '30002']);
  });

  it('advances the counter past every number already issued', () => {
    const result = migrateLegacyData(FULL_SOURCE, { businessId: 'biz_1' });
    if (isErr(result)) throw new Error('expected success');
    expect(result.value.data.numberingSettings.nextNumber).toBe(30003);
  });

  it('snapshots option names and prices onto the order line', () => {
    const result = migrateLegacyData(FULL_SOURCE, { businessId: 'biz_1' });
    if (isErr(result)) throw new Error('expected success');

    const line = result.value.data.orders.find((o) => o.orderUid === 'uuid-order-1')!.lines[0];
    expect(line.itemNames.en).toBe('Laksa Without Kerang');
    expect(line.options).toHaveLength(3);
    expect(line.options[0]).toMatchObject({ choiceId: 'Big', priceDeltaSen: 100 });
    expect(line.options[2]).toMatchObject({ choiceId: 'Add Egg', priceDeltaSen: 100 });
  });

  it('assigns business dates using the 04:00 cutoff', () => {
    const result = migrateLegacyData(FULL_SOURCE, { businessId: 'biz_1' });
    if (isErr(result)) throw new Error('expected success');

    const byUid = new Map(result.value.data.orders.map((o) => [o.orderUid, o]));
    expect(byUid.get('uuid-order-1')!.businessDate).toBe('2026-03-21');
    // 02:30 on the 22nd is still the night of the 21st.
    expect(byUid.get('uuid-order-2')!.businessDate).toBe('2026-03-21');
  });

  it('keeps cancelled orders with their number and status', () => {
    const result = migrateLegacyData(FULL_SOURCE, { businessId: 'biz_1' });
    if (isErr(result)) throw new Error('expected success');

    const cancelled = result.value.data.orders.find((o) => o.orderUid === 'uuid-order-2')!;
    expect(cancelled.fulfillmentStatus).toBe('cancelled');
    expect(cancelled.displayNumber).toBe('30002');
    expect(cancelled.cancelledAt).toBeTruthy();
  });

  it('rebuilds the charge rules in the order the old build applied them', () => {
    const result = migrateLegacyData(FULL_SOURCE, { businessId: 'biz_1' });
    if (isErr(result)) throw new Error('expected success');

    const rules = [...result.value.data.chargeRules].sort(
      (a, b) => a.calculationOrder - b.calculationOrder
    );
    expect(rules.map((r) => r.type)).toEqual(['fixed', 'percentage']);
    expect(rules[0].amountSen).toBe(50);
    expect(rules[0].appliesToOrderModeIds).toEqual(['mode_takeaway']);
    expect(rules[1].ratePercent).toBe(6);
  });

  it('preserves images and the raw legacy menu instead of dropping them', () => {
    const result = migrateLegacyData(FULL_SOURCE, { businessId: 'biz_1' });
    if (isErr(result)) throw new Error('expected success');

    const payload = result.value.preservedPayload;
    expect(payload.coverPhoto).toBe('data:image/png;base64,COVER');
    expect(payload.qrImage).toBe('data:image/png;base64,QR');
    expect((payload.menuItems as unknown[]).length).toBe(1);
    expect(result.value.report.warnings.join(' ')).toContain('images');
  });

  it('falls back to the standalone qr image key', () => {
    const source = sourceOf({
      [LEGACY_SETTINGS_KEY]: JSON.stringify({ ...LEGACY_SETTINGS, qrImage: null }),
      [LEGACY_QR_IMAGE_KEY]: 'data:image/png;base64,OLDQR',
    });
    const result = migrateLegacyData(source, { businessId: 'biz_1' });
    if (isErr(result)) throw new Error('expected success');
    expect(result.value.preservedPayload.qrImage).toBe('data:image/png;base64,OLDQR');
  });
});

// ==================== Partial and corrupt data ====================

describe('migrateLegacyData - imperfect data', () => {
  it('migrates settings alone when there is no order history', () => {
    const source = sourceOf({ [LEGACY_SETTINGS_KEY]: JSON.stringify(LEGACY_SETTINGS) });
    const result = migrateLegacyData(source, { businessId: 'biz_1' });
    expect(result.ok).toBe(true);
    if (isOk(result)) expect(result.value.report.ordersMigrated).toBe(0);
  });

  it('tolerates orders missing optional fields', () => {
    const source = sourceOf({
      [LEGACY_ORDERS_KEY]: JSON.stringify([
        {
          local_order_id: 'uuid-thin',
          order_id: '7',
          timestamp: '2026-03-21 10:00:00',
          order_type: 'Dine-in',
          total_amount: 5,
          status: 'Pending',
          paid: false,
        },
      ]),
    });

    const result = migrateLegacyData(source, { businessId: 'biz_1' });
    expect(result.ok).toBe(true);
    if (isErr(result)) return;

    const order = result.value.data.orders[0];
    expect(order.lines).toEqual([]);
    expect(order.subtotalSen).toBe(0);
    expect(order.totalSen).toBe(500);
  });

  it('skips an order with an unreadable date and warns, without failing the run', () => {
    const source = sourceOf({
      [LEGACY_ORDERS_KEY]: JSON.stringify([
        { local_order_id: 'bad-date', order_id: '9', timestamp: 'yesterday', total_amount: 1, status: 'Pending', paid: false },
        ...LEGACY_ORDERS,
      ]),
    });

    const result = migrateLegacyData(source, { businessId: 'biz_1' });
    expect(result.ok).toBe(true);
    if (isErr(result)) return;

    expect(result.value.report.ordersMigrated).toBe(2);
    expect(result.value.report.ordersSkippedInvalid).toBe(1);
    expect(result.value.report.warnings.join(' ')).toContain('unreadable date');
  });

  it('rejects an impossible calendar date instead of silently normalising it', () => {
    const source = sourceOf({
      [LEGACY_ORDERS_KEY]: JSON.stringify([
        {
          local_order_id: 'impossible-date',
          order_id: '10',
          timestamp: '2026-02-31 12:00:00',
          order_type: 'Dine-in',
          total_amount: 1,
          status: 'Pending',
          paid: false,
        },
      ]),
    });

    const result = migrateLegacyData(source, { businessId: 'biz_1' });
    expect(result.ok).toBe(true);
    if (isErr(result)) return;

    expect(result.value.report.ordersMigrated).toBe(0);
    expect(result.value.report.ordersSkippedInvalid).toBe(1);
    expect(result.value.data.orders).toEqual([]);
  });

  it('fails loudly on corrupt order JSON rather than importing nothing quietly', () => {
    const source = sourceOf({ [LEGACY_ORDERS_KEY]: '[{ broken' });
    const result = migrateLegacyData(source, { businessId: 'biz_1' });

    expect(result.ok).toBe(false);
    if (isErr(result)) {
      expect(result.error.code).toBe('MIGRATION_FAILED');
      expect(result.error.message).toContain('untouched');
    }
  });

  it('fails loudly on corrupt settings JSON', () => {
    const source = sourceOf({ [LEGACY_SETTINGS_KEY]: 'not json at all' });
    const result = migrateLegacyData(source, { businessId: 'biz_1' });
    expect(result.ok).toBe(false);
  });

  it('returns a migration Result for valid JSON with invalid runtime field types', () => {
    const source = sourceOf({
      [LEGACY_SETTINGS_KEY]: JSON.stringify({
        menuItems: [
          {
            id: 'bad-price',
            name: { en: 'Bad price', zh: '错误价格' },
            basePrice: 'not-a-number',
          },
        ],
      }),
    });

    expect(() => migrateLegacyData(source, { businessId: 'biz_1' })).not.toThrow();
    const result = migrateLegacyData(source, { businessId: 'biz_1' });

    expect(result.ok).toBe(false);
    if (isErr(result)) {
      expect(result.error.code).toBe('MIGRATION_FAILED');
      expect(result.error.message).toContain('original data is untouched');
    }
  });

  it('keeps a chosen option readable after it was deleted from the menu', () => {
    const source = sourceOf({
      // Settings without the menu the order refers to.
      [LEGACY_SETTINGS_KEY]: JSON.stringify({ ...LEGACY_SETTINGS, menuItems: [] }),
      [LEGACY_ORDERS_KEY]: JSON.stringify(LEGACY_ORDERS),
    });

    const result = migrateLegacyData(source, { businessId: 'biz_1' });
    if (isErr(result)) throw new Error('expected success');

    const line = result.value.data.orders[0].lines[0];
    // The customer still chose "Big", so it must stay on the receipt.
    expect(line.options[0].choiceNames.en).toBe('Big');
    expect(line.lineTotalSen).toBe(1000);
  });
});

// ==================== Idempotency ====================

describe('migrateLegacyData - re-runnable', () => {
  it('merges without overwriting current merchant data or mutating the input', () => {
    const existing = createEmptyAppData('biz_1');
    existing.businessProfile.displayName = 'Current Shop';
    existing.businessProfile.secondaryName = '当前店铺';
    existing.localeSettings.primaryLanguage = 'ms';
    existing.localeSettings.enabledLanguages = ['ms'];
    existing.menuCategories = [
      {
        id: LEGACY_CATEGORY_ID,
        names: { en: 'Current category' },
        sortOrder: 9,
        enabled: true,
      },
    ];
    existing.menuItems = [
      {
        id: 'm1',
        categoryId: LEGACY_CATEGORY_ID,
        names: { en: 'Current item' },
        basePriceSen: 999,
        optionGroupIds: [],
        enabled: true,
        sortOrder: 9,
      },
    ];
    existing.chargeRules = [
      {
        id: 'charge_legacy_tax',
        names: { en: 'Current tax' },
        type: 'percentage',
        ratePercent: 9,
        appliesToOrderModeIds: [],
        calculationOrder: 4,
        showOnReceipt: false,
        enabled: true,
      },
    ];
    const before = JSON.parse(JSON.stringify(existing));

    const result = migrateLegacyData(FULL_SOURCE, { businessId: 'biz_1', existing });
    if (isErr(result)) throw new Error('expected success');

    const migrated = result.value.data;
    expect(existing).toEqual(before);
    expect(migrated.businessProfile.displayName).toBe('Current Shop');
    expect(migrated.businessProfile.secondaryName).toBe('当前店铺');
    expect(migrated.localeSettings.primaryLanguage).toBe('ms');
    expect(new Set(migrated.localeSettings.enabledLanguages)).toEqual(
      new Set(['ms', 'en', 'zh'])
    );
    expect(migrated.menuCategories.find((category) => category.id === LEGACY_CATEGORY_ID)?.names.en)
      .toBe('Current category');
    expect(migrated.menuItems.find((item) => item.id === 'm1')).toMatchObject({
      names: { en: 'Current item' },
      basePriceSen: 999,
    });
    expect(migrated.chargeRules.find((rule) => rule.id === 'charge_legacy_tax')).toMatchObject({
      names: { en: 'Current tax' },
      ratePercent: 9,
      showOnReceipt: false,
    });
    expect(result.value.report.menuItemsMigrated).toBe(0);
    // Packaging was missing and is added; the current tax rule is preserved.
    expect(result.value.report.chargeRulesCreated).toBe(1);
  });

  it('does not duplicate orders on a second pass', () => {
    const first = migrateLegacyData(FULL_SOURCE, { businessId: 'biz_1' });
    if (isErr(first)) throw new Error('expected success');

    const second = migrateLegacyData(FULL_SOURCE, {
      businessId: 'biz_1',
      existing: first.value.data,
    });
    if (isErr(second)) throw new Error('expected success');

    expect(second.value.data.orders).toHaveLength(2);
    expect(second.value.report.ordersMigrated).toBe(0);
    expect(second.value.report.ordersSkippedDuplicate).toBe(2);
  });

  it('does not renumber orders it already imported', () => {
    const first = migrateLegacyData(FULL_SOURCE, { businessId: 'biz_1' });
    if (isErr(first)) throw new Error('expected success');
    const before = first.value.data.orders.map((o) => `${o.orderUid}:${o.displayNumber}`);

    const second = migrateLegacyData(FULL_SOURCE, {
      businessId: 'biz_1',
      existing: first.value.data,
    });
    if (isErr(second)) throw new Error('expected success');
    const after = second.value.data.orders.map((o) => `${o.orderUid}:${o.displayNumber}`);

    expect(after).toEqual(before);
  });
});

// ==================== Runner ====================

describe('runMigrationIfNeeded', () => {
  function driverWithLegacy() {
    return new MemoryDriver({
      [LEGACY_SETTINGS_KEY]: JSON.stringify(LEGACY_SETTINGS),
      [LEGACY_ORDERS_KEY]: JSON.stringify(LEGACY_ORDERS),
    });
  }

  it('migrates, persists, preserves images and marks completion', () => {
    const driver = driverWithLegacy();
    const repo = new AppDataRepository(driver);

    const result = runMigrationIfNeeded(repo, { get: (k) => driver.getItem(k) }, 'biz_1');
    expect(result.ok).toBe(true);
    if (isErr(result)) return;
    expect(result.value.kind).toBe('migrated');

    expect(driver.getItem(MIGRATION_STATE_KEY)).not.toBeNull();
    expect(driver.getItem(PRESERVED_LEGACY_PAYLOAD_KEY)).not.toBeNull();

    const reloaded = repo.load();
    expect(reloaded.ok).toBe(true);
    if (isOk(reloaded)) expect(reloaded.value?.orders).toHaveLength(2);
  });

  it('never removes or rewrites the legacy keys', () => {
    const driver = driverWithLegacy();
    const before = driver.snapshot();

    runMigrationIfNeeded(new AppDataRepository(driver), { get: (k) => driver.getItem(k) }, 'biz_1');

    expect(driver.getItem(LEGACY_SETTINGS_KEY)).toBe(before[LEGACY_SETTINGS_KEY]);
    expect(driver.getItem(LEGACY_ORDERS_KEY)).toBe(before[LEGACY_ORDERS_KEY]);
  });

  it('is a no-op on the second call', () => {
    const driver = driverWithLegacy();
    const repo = new AppDataRepository(driver);
    const legacy = { get: (k: string) => driver.getItem(k) };

    runMigrationIfNeeded(repo, legacy, 'biz_1');
    const second = runMigrationIfNeeded(repo, legacy, 'biz_1');

    expect(second.ok).toBe(true);
    if (isOk(second)) {
      expect(second.value.kind).toBe('already-done');
      if (second.value.kind === 'already-done') {
        expect(second.value.data.orders).toHaveLength(2);
      }
    }
  });

  it('reports not-needed on a clean install', () => {
    const driver = new MemoryDriver();
    const result = runMigrationIfNeeded(
      new AppDataRepository(driver),
      { get: (k) => driver.getItem(k) },
      'biz_1'
    );

    expect(result.ok).toBe(true);
    if (isOk(result)) expect(result.value.kind).toBe('not-needed');
  });

  it('writes nothing when storage is full', () => {
    const driver = driverWithLegacy();
    const quota = new Error('quota');
    quota.name = 'QuotaExceededError';
    driver.failOnWrite = quota;

    const result = runMigrationIfNeeded(
      new AppDataRepository(driver),
      { get: (k) => driver.getItem(k) },
      'biz_1'
    );

    expect(result.ok).toBe(false);
    if (isErr(result)) expect(result.error.code).toBe('STORAGE_QUOTA_EXCEEDED');
    // No half-finished state: no marker, so a retry starts cleanly.
    expect(driver.getItem(MIGRATION_STATE_KEY)).toBeNull();
    // And the merchant's original data is still there.
    expect(driver.getItem(LEGACY_ORDERS_KEY)).not.toBeNull();
  });

  it('treats a damaged completion marker as not-done rather than skipping data', () => {
    const driver = driverWithLegacy();
    driver.setItem(MIGRATION_STATE_KEY, '{ corrupt');
    const repo = new AppDataRepository(driver);

    const result = runMigrationIfNeeded(repo, { get: (k) => driver.getItem(k) }, 'biz_1');
    expect(result.ok).toBe(true);
    if (isOk(result)) expect(result.value.kind).toBe('migrated');
  });

  it('rejects a parseable but structurally invalid completion marker', () => {
    const driver = driverWithLegacy();
    const repo = new AppDataRepository(driver);
    expect(repo.save(createEmptyAppData('biz_1')).ok).toBe(true);
    driver.setItem(MIGRATION_STATE_KEY, '{}');

    const result = runMigrationIfNeeded(repo, { get: (k) => driver.getItem(k) }, 'biz_1');

    expect(result.ok).toBe(true);
    if (isErr(result)) return;
    expect(result.value.kind).toBe('migrated');
    expect(result.value.data?.orders).toHaveLength(2);
  });

  it('does not claim success when the completion marker write is silently dropped', () => {
    const driver = driverWithLegacy();
    const realSetItem = driver.setItem.bind(driver);
    driver.setItem = (key, value) => {
      if (key !== MIGRATION_STATE_KEY) realSetItem(key, value);
    };

    const result = runMigrationIfNeeded(
      new AppDataRepository(driver),
      { get: (k) => driver.getItem(k) },
      'biz_1'
    );

    expect(result.ok).toBe(false);
    if (isErr(result)) expect(result.error.code).toBe('MIGRATION_FAILED');
    expect(driver.getItem(MIGRATION_STATE_KEY)).toBeNull();
  });
});
