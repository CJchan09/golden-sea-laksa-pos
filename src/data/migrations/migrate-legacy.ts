/**
 * Migration: pre-v1 Golden Sea Laksa data -> AppDataSchema v1.
 *
 * Contract (Phase 1A):
 *  - re-runnable: running it twice must not duplicate a single order
 *  - non-destructive: legacy keys are never written or removed
 *  - honest: a partial or failed run returns an error and writes nothing
 *
 * Historical orders keep the exact numbers, names and amounts they were sold
 * under. A merchant reconciling last month's takings must see what the
 * customer saw, not what today's menu says.
 */

import {
  AppDataSchema,
  AppliedCharge,
  ChargeRule,
  CURRENT_SCHEMA_VERSION,
  LangCode,
  LocalizedText,
  MenuCategory,
  MenuItem,
  Order,
  OrderLine,
  OrderLineOptionSnapshot,
} from '../app-schema';
import { DEFAULT_BUSINESS_DAY_CUTOFF, toBusinessDate } from '../../domain/business-date';
import { fromRinggit, Sen, sumSen } from '../../domain/money';
import { Result, err, ok } from '../../domain/result';
import { createEmptyAppData } from '../schema-defaults';
import {
  LEGACY_LANG_KEY,
  LEGACY_ORDERS_KEY,
  LEGACY_QR_IMAGE_KEY,
  LEGACY_SETTINGS_KEY,
} from './legacy-keys';

// ==================== Legacy shapes (as they exist on disk) ====================

interface LegacyVariation {
  id: string;
  name: { en: string; zh: string };
  price: number;
}

interface LegacyMenuItem {
  id: string;
  name: { en: string; zh: string };
  basePrice: number;
  image?: string;
  sizes?: LegacyVariation[];
  noodleBases?: LegacyVariation[];
  addOns?: LegacyVariation[];
}

interface LegacyCartItem {
  id: string;
  menuItemId: string;
  sizeId?: string;
  noodleBaseIds?: string[];
  addOnIds?: string[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface LegacyOrder {
  local_order_id: string;
  order_id: string;
  timestamp: string;
  order_type: 'Dine-in' | 'Takeaway';
  table_no?: string;
  items?: LegacyCartItem[];
  subtotal?: number;
  tax_amount?: number;
  takeaway_fee?: number;
  total_amount: number;
  status: 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';
  paid: boolean;
  payment_method?: 'Cash' | 'QR Pay';
  synced?: boolean;
}

interface LegacySettings {
  shopNameEn?: string;
  shopNameZh?: string;
  coverPhoto?: string;
  qrImage?: string | null;
  menuItems?: LegacyMenuItem[];
  enableTax?: boolean;
  taxRate?: number;
  takeawayFee?: number;
}

// ==================== Stable legacy ids ====================

export const LEGACY_CATEGORY_ID = 'cat_legacy_menu';
export const LEGACY_SIZE_GROUP_ID = 'legacy_size';
export const LEGACY_NOODLE_GROUP_ID = 'legacy_noodle_base';
export const LEGACY_ADDON_GROUP_ID = 'legacy_add_on';

const LEGACY_TAX_RULE_ID = 'charge_legacy_tax';
const LEGACY_PACKAGING_RULE_ID = 'charge_legacy_packaging';

const ORDER_MODE_MAP: Record<string, string> = {
  'Dine-in': 'mode_dine_in',
  Takeaway: 'mode_takeaway',
};

const PAYMENT_MAP: Record<string, string> = {
  Cash: 'pay_cash',
  'QR Pay': 'pay_qr',
};

const MODE_NAMES: Record<string, LocalizedText> = {
  mode_dine_in: { en: 'Dine-in', zh: '堂食', ms: 'Makan Sini' },
  mode_takeaway: { en: 'Takeaway', zh: '打包', ms: 'Bungkus' },
};

const PAYMENT_NAMES: Record<string, LocalizedText> = {
  pay_cash: { en: 'Cash', zh: '现金', ms: 'Tunai' },
  pay_qr: { en: 'QR Pay', zh: '扫码付款', ms: 'Bayar QR' },
};

// ==================== Helpers ====================

function toLocalized(name: { en?: string; zh?: string } | undefined): LocalizedText {
  if (!name) return {};
  const out: LocalizedText = {};
  if (name.en) out.en = name.en;
  if (name.zh) out.zh = name.zh;
  return out;
}

/** "2026-03-21 14:05:00" -> Date in local time. */
function parseLegacyTimestamp(ts: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(ts.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? '0');

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const d = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  // The Date constructor normalises impossible values (2026-02-31 becomes
  // 2026-03-03). Historical takings must never move days silently, so require
  // every local component to round-trip exactly.
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day ||
    d.getHours() !== hour ||
    d.getMinutes() !== minute ||
    d.getSeconds() !== second
  ) {
    return null;
  }

  return d;
}

interface JsonReadOk<T> {
  ok: true;
  value: T | null;
}
interface JsonReadErr {
  ok: false;
  reason: string;
}
type JsonRead<T> = JsonReadOk<T> | JsonReadErr;

function isJsonErr<T>(read: JsonRead<T>): read is JsonReadErr {
  return read.ok === false;
}

function parseJson<T>(raw: string | null): JsonRead<T> {
  if (raw === null) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

// ==================== Report ====================

export interface MigrationReport {
  ordersMigrated: number;
  ordersSkippedDuplicate: number;
  ordersSkippedInvalid: number;
  menuItemsMigrated: number;
  chargeRulesCreated: number;
  /** Non-fatal problems worth surfacing on the Data page. */
  warnings: string[];
}

export interface MigrationOutput {
  data: AppDataSchema;
  report: MigrationReport;
  /** Images and raw legacy menu, preserved for Phase 1B / Phase 3. */
  preservedPayload: Record<string, unknown>;
}

export interface LegacySource {
  get(key: string): string | null;
}

export interface MigrationOptions {
  businessId: string;
  /** Pass the current data when re-running, so nothing already imported is lost. */
  existing?: AppDataSchema | null;
}

/** AppDataSchema is deliberately JSON-only because it is persisted as JSON. */
function cloneAppData(data: AppDataSchema): AppDataSchema {
  return JSON.parse(JSON.stringify(data)) as AppDataSchema;
}

/** Existing records win on id collision; migration may only add missing data. */
function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const merged = [...existing];
  const ids = new Set(existing.map((item) => item.id));
  for (const item of incoming) {
    if (!ids.has(item.id)) {
      merged.push(item);
      ids.add(item.id);
    }
  }
  return merged;
}

// ==================== Migration ====================

function migrateLegacyDataUnchecked(
  source: LegacySource,
  options: MigrationOptions
): Result<MigrationOutput> {
  const warnings: string[] = [];

  const settingsRead = parseJson<LegacySettings>(source.get(LEGACY_SETTINGS_KEY));
  if (isJsonErr(settingsRead)) {
    return err(
      'MIGRATION_FAILED',
      `Old settings could not be read (${settingsRead.reason}). Nothing was changed and your original data is untouched.`
    );
  }
  const ordersRead = parseJson<LegacyOrder[]>(source.get(LEGACY_ORDERS_KEY));
  if (isJsonErr(ordersRead)) {
    return err(
      'MIGRATION_FAILED',
      `Old order history could not be read (${ordersRead.reason}). Nothing was changed and your original data is untouched.`
    );
  }

  const settings = settingsRead.value ?? {};
  const legacyOrders = Array.isArray(ordersRead.value) ? ordersRead.value : [];
  if (ordersRead.value !== null && !Array.isArray(ordersRead.value)) {
    warnings.push(
      'Old order history was not a list and has been ignored. The original value is still on the device.'
    );
  }

  // Work on a deep copy when re-running. Migration must be a pure preparation
  // step: an error must not mutate the live in-memory store before repository
  // save/verification has succeeded.
  const hadExistingData = options.existing !== null && options.existing !== undefined;
  const data: AppDataSchema = hadExistingData
    ? cloneAppData(options.existing as AppDataSchema)
    : createEmptyAppData(options.businessId);
  data.schemaVersion = CURRENT_SCHEMA_VERSION;

  // ---- Business profile ----
  // Fill blanks only. A missing/damaged marker can trigger a re-run months
  // later; old Golden Sea settings must never overwrite current merchant edits.
  if (!data.businessProfile.displayName && settings.shopNameEn) {
    data.businessProfile.displayName = settings.shopNameEn;
  }
  if (!data.businessProfile.secondaryName && settings.shopNameZh) {
    data.businessProfile.secondaryName = settings.shopNameZh;
  }

  // ---- Locale ----
  const legacyLang = source.get(LEGACY_LANG_KEY);
  const primary: LangCode = legacyLang === 'zh' ? 'zh' : 'en';
  const enabledLanguages = new Set<LangCode>(data.localeSettings.enabledLanguages);
  enabledLanguages.add('en');
  enabledLanguages.add('zh');
  data.localeSettings = {
    ...data.localeSettings,
    // Preserve the current preference on a re-run; only a fresh migration may
    // import the old preference.
    primaryLanguage: hadExistingData ? data.localeSettings.primaryLanguage : primary,
    enabledLanguages: [...enabledLanguages],
  };

  // ---- Charge rules ----
  // Order matters: the old build added packaging first, then taxed the sum.
  const chargeRules: ChargeRule[] = [];
  const takeawayFee = settings.takeawayFee ?? 0;
  if (takeawayFee > 0) {
    chargeRules.push({
      id: LEGACY_PACKAGING_RULE_ID,
      names: { en: 'Packaging', zh: '打包费', ms: 'Bungkusan' },
      type: 'fixed',
      amountSen: fromRinggit(takeawayFee),
      appliesToOrderModeIds: ['mode_takeaway'],
      calculationOrder: 0,
      showOnReceipt: true,
      enabled: true,
    });
  }
  if (settings.enableTax && (settings.taxRate ?? 0) > 0) {
    chargeRules.push({
      id: LEGACY_TAX_RULE_ID,
      names: { en: 'Tax', zh: '税', ms: 'Cukai' },
      type: 'percentage',
      ratePercent: settings.taxRate,
      appliesToOrderModeIds: [],
      calculationOrder: 1,
      showOnReceipt: true,
      enabled: true,
    });
  }
  const chargeRuleCountBefore = data.chargeRules.length;
  data.chargeRules = mergeById(data.chargeRules, chargeRules);
  const chargeRulesCreated = data.chargeRules.length - chargeRuleCountBefore;

  // ---- Menu ----
  const legacyMenu = Array.isArray(settings.menuItems) ? settings.menuItems : [];
  let menuItemsMigrated = 0;
  if (legacyMenu.length > 0) {
    const category: MenuCategory = {
      id: LEGACY_CATEGORY_ID,
      names: { en: 'Menu', zh: '菜单', ms: 'Menu' },
      sortOrder: 0,
      enabled: true,
    };
    data.menuCategories = mergeById(data.menuCategories, [category]);

    const migratedMenuItems = legacyMenu.map(
      (item, index): MenuItem => ({
        id: item.id,
        categoryId: LEGACY_CATEGORY_ID,
        names: toLocalized(item.name),
        basePriceSen: fromRinggit(item.basePrice ?? 0),
        // Option groups are wired in Phase 1B; raw definitions are preserved below.
        optionGroupIds: [],
        enabled: true,
        sortOrder: index,
      })
    );
    const menuItemCountBefore = data.menuItems.length;
    data.menuItems = mergeById(data.menuItems, migratedMenuItems);
    menuItemsMigrated = data.menuItems.length - menuItemCountBefore;
  }

  // ---- Orders ----
  const existingUids = new Set(data.orders.map((o) => o.orderUid));
  const cutoff = data.numberingSettings.businessDayCutoff || DEFAULT_BUSINESS_DAY_CUTOFF;
  const menuById = new Map(legacyMenu.map((m) => [m.id, m]));

  let migrated = 0;
  let skippedDuplicate = 0;
  let skippedInvalid = 0;

  for (const legacy of legacyOrders) {
    if (!legacy || typeof legacy.local_order_id !== 'string' || legacy.local_order_id === '') {
      skippedInvalid++;
      continue;
    }
    // Re-runnable: the legacy uuid becomes the permanent orderUid, so a second
    // pass recognises what it already imported.
    if (existingUids.has(legacy.local_order_id)) {
      skippedDuplicate++;
      continue;
    }

    const at = parseLegacyTimestamp(legacy.timestamp ?? '');
    if (!at) {
      skippedInvalid++;
      warnings.push(
        `Order ${legacy.order_id ?? legacy.local_order_id} had an unreadable date and was skipped.`
      );
      continue;
    }

    const lines: OrderLine[] = (legacy.items ?? []).map((cartItem, lineIndex) => {
      const menuItem = menuById.get(cartItem.menuItemId);
      const options: OrderLineOptionSnapshot[] = [];

      const pushOption = (
        groupId: string,
        groupNames: LocalizedText,
        variations: LegacyVariation[] | undefined,
        choiceId: string
      ) => {
        const variation = variations?.find((v) => v.id === choiceId);
        options.push({
          optionGroupId: groupId,
          groupNames,
          choiceId,
          // Fall back to the stored id when the menu no longer defines it --
          // the customer still chose it, so it belongs on the receipt.
          choiceNames: variation ? toLocalized(variation.name) : { en: choiceId },
          priceDeltaSen: fromRinggit(variation?.price ?? 0),
        });
      };

      if (cartItem.sizeId) {
        pushOption(LEGACY_SIZE_GROUP_ID, { en: 'Size', zh: '份量' }, menuItem?.sizes, cartItem.sizeId);
      }
      for (const id of cartItem.noodleBaseIds ?? []) {
        pushOption(LEGACY_NOODLE_GROUP_ID, { en: 'Noodle', zh: '面类' }, menuItem?.noodleBases, id);
      }
      for (const id of cartItem.addOnIds ?? []) {
        pushOption(LEGACY_ADDON_GROUP_ID, { en: 'Add-on', zh: '加料' }, menuItem?.addOns, id);
      }

      const quantity =
        Number.isInteger(cartItem.quantity) && cartItem.quantity > 0 ? cartItem.quantity : 1;

      return {
        id: cartItem.id || `${legacy.local_order_id}_line_${lineIndex}`,
        menuItemId: cartItem.menuItemId,
        itemNames: menuItem ? toLocalized(menuItem.name) : { en: cartItem.menuItemId },
        basePriceSen: fromRinggit(menuItem?.basePrice ?? 0),
        options,
        quantity,
        unitPriceSen: fromRinggit(cartItem.unitPrice ?? 0),
        // Trust the stored total: it is what the customer actually paid.
        lineTotalSen: fromRinggit(cartItem.totalPrice ?? 0),
      };
    });

    const charges: AppliedCharge[] = [];
    const packagingSen: Sen = fromRinggit(legacy.takeaway_fee ?? 0);
    if (packagingSen !== 0) {
      charges.push({
        chargeRuleId: LEGACY_PACKAGING_RULE_ID,
        names: { en: 'Packaging', zh: '打包费', ms: 'Bungkusan' },
        type: 'fixed',
        amountSen: packagingSen,
        showOnReceipt: true,
      });
    }
    const taxSen: Sen = fromRinggit(legacy.tax_amount ?? 0);
    if (taxSen !== 0) {
      charges.push({
        chargeRuleId: LEGACY_TAX_RULE_ID,
        names: { en: 'Tax', zh: '税', ms: 'Cukai' },
        type: 'percentage',
        ratePercent: settings.taxRate,
        amountSen: taxSen,
        showOnReceipt: true,
      });
    }

    const subtotalSen: Sen =
      legacy.subtotal !== undefined
        ? fromRinggit(legacy.subtotal)
        : sumSen(lines.map((l) => l.lineTotalSen));

    const modeId = ORDER_MODE_MAP[legacy.order_type] ?? 'mode_dine_in';
    const paymentId = legacy.payment_method ? PAYMENT_MAP[legacy.payment_method] : undefined;
    const isCancelled = legacy.status === 'Cancelled';

    const order: Order = {
      orderUid: legacy.local_order_id,
      // Preserved verbatim. Reassigning a number a customer already holds
      // would break their receipt and the owner's reconciliation.
      displayNumber: String(legacy.order_id ?? ''),
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      businessDate: toBusinessDate(at, cutoff),
      orderModeId: modeId,
      orderModeNames: MODE_NAMES[modeId] ?? {},
      tableLabel: legacy.table_no,
      lines,
      subtotalSen,
      charges,
      totalSen: fromRinggit(legacy.total_amount ?? 0),
      paymentStatus: legacy.paid ? 'paid' : 'unpaid',
      fulfillmentStatus: isCancelled
        ? 'cancelled'
        : legacy.status === 'Preparing'
          ? 'preparing'
          : legacy.status === 'Completed'
            ? 'completed'
            : 'pending',
      paymentMethodId: paymentId,
      paymentMethodNames: paymentId ? PAYMENT_NAMES[paymentId] : undefined,
      cancelledAt: isCancelled ? at.toISOString() : undefined,
      synced: legacy.synced === true,
      migratedFrom: 'golden_sea_laksa_v0',
    };

    data.orders.push(order);
    existingUids.add(order.orderUid);
    migrated++;
  }

  // Keep the counter ahead of every number already issued.
  const highest = data.orders.reduce((max, o) => {
    const n = Number(o.displayNumber);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  data.numberingSettings = {
    ...data.numberingSettings,
    nextNumber: Math.max(data.numberingSettings.nextNumber, highest + 1),
  };

  // ---- Preserve what v1 cannot yet represent ----
  const preservedPayload: Record<string, unknown> = {
    preservedAt: new Date().toISOString(),
    note: 'Images and raw legacy menu options. Phase 1B maps options; Phase 3 moves images to IndexedDB.',
    coverPhoto: settings.coverPhoto ?? null,
    qrImage: settings.qrImage ?? source.get(LEGACY_QR_IMAGE_KEY) ?? null,
    menuItems: legacyMenu,
  };

  if (legacyMenu.some((m) => m.image)) {
    warnings.push(
      'Menu images were preserved but are not shown yet. They are restored when image storage lands.'
    );
  }

  return ok({
    data,
    report: {
      ordersMigrated: migrated,
      ordersSkippedDuplicate: skippedDuplicate,
      ordersSkippedInvalid: skippedInvalid,
      menuItemsMigrated,
      chargeRulesCreated,
      warnings,
    },
    preservedPayload,
  });
}

/**
 * Public boundary: legacy JSON is untrusted runtime data even when JSON.parse
 * succeeds. Convert every unexpected shape/value failure into a Result so the
 * caller can stop safely instead of crashing halfway through app startup.
 */
export function migrateLegacyData(
  source: LegacySource,
  options: MigrationOptions = { businessId: 'biz_migrated' }
): Result<MigrationOutput> {
  try {
    return migrateLegacyDataUnchecked(source, options);
  } catch (cause) {
    return err(
      'MIGRATION_FAILED',
      'Old data contained an unsupported value and could not be migrated. ' +
        'Nothing was changed and your original data is untouched.',
      cause
    );
  }
}

/** True when there is anything worth migrating. */
export function hasLegacyData(source: LegacySource): boolean {
  return source.get(LEGACY_ORDERS_KEY) !== null || source.get(LEGACY_SETTINGS_KEY) !== null;
}
