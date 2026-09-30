import { v4 as uuidv4 } from 'uuid';
import type { CartItem, Language, Order, ShopSettings } from '../types';
import { SIZES, NOODLE_BASES, ADD_ONS } from '../constants';
import { createDemoBaselineSettings } from '../demo-baseline';
import { normalizeMenuItemOptionGroups } from '../domain/menu-options';
import { hydrateCartItemSnapshots } from '../domain/cart-item-display';
import { ALL_LEGACY_KEYS, LEGACY_CART_KEY, LEGACY_LANG_KEY, LEGACY_ORDERS_KEY, LEGACY_QR_IMAGE_KEY, LEGACY_SETTINGS_KEY } from '../data/migrations/legacy-keys';
import type { LegacySnapshot, PosRead } from './pos-idb';
import { prepareSettingsPhotos } from './pos-photos';

export function readLegacySnapshot(storage: Pick<Storage, 'getItem'>): LegacySnapshot {
  const snapshot: LegacySnapshot = {};
  for (const key of ALL_LEGACY_KEYS) snapshot[key] = storage.getItem(key);
  snapshot['cjpos.appData'] = storage.getItem('cjpos.appData');
  snapshot['cjpos.legacyPayload'] = storage.getItem('cjpos.legacyPayload');
  return snapshot;
}

function parseLegacy<T>(source: string | null | undefined, fallback: T, label: string): T {
  if (source == null) return fallback;
  try { return JSON.parse(source) as T; }
  catch { throw new Error(`Saved ${label} cannot be read. Original data was preserved; restore a backup before editing.`); }
}

/** Rename only the original sample pair; a merchant's custom name remains theirs. */
export function renameLegacyDemoSettings(input: ShopSettings, isCjDemo: boolean): ShopSettings {
  if (!isCjDemo || input.shopNameEn !== 'Golden Sea Laksa' || input.shopNameZh !== '金海叻沙') return input;
  return { ...input, shopNameEn: 'CJ POS Demo', shopNameZh: 'CJ POS 示范店',
    shopNameMs: !input.shopNameMs || input.shopNameMs === 'Golden Sea Laksa' ? 'CJ POS Demo' : input.shopNameMs };
}

export function normalizeSettings(input: ShopSettings, base: ShopSettings, isCjDemo: boolean, fromSavedSettings = false): ShopSettings {
  const settings = { ...base, ...input };
  // A pre-update merchant record has no Malay name or order-mode preference.
  // Do not let the new sample defaults change that merchant's behaviour.
  settings.shopNameMs = input.shopNameMs ?? (fromSavedSettings ? '' : base.shopNameMs);
  settings.defaultOrderType = input.defaultOrderType ?? (fromSavedSettings ? 'Dine-in' : base.defaultOrderType ?? 'Dine-in');
  settings.menuItems = (settings.menuItems ?? base.menuItems).map(item => normalizeMenuItemOptionGroups({
    ...item,
    sizes: item.sizes ?? [...SIZES],
    noodleBases: item.noodleBases ?? [...NOODLE_BASES],
    addOns: item.addOns ?? [...ADD_ONS],
  }));
  settings.enableTax = settings.enableTax ?? false;
  settings.taxRate = settings.taxRate ?? 6;
  settings.takeawayFee = settings.takeawayFee ?? 0.5;
  return renameLegacyDemoSettings(settings, isCjDemo);
}

export async function migrateLegacySnapshot(
  legacySnapshot: LegacySnapshot,
  base: ShopSettings = createDemoBaselineSettings(),
  isCjDemo = import.meta.env.VITE_ANDROID_APP === 'true' || import.meta.env.VITE_PUBLIC_DEMO === 'true',
): Promise<PosRead> {
  const hasSavedSettings = legacySnapshot[LEGACY_SETTINGS_KEY] != null;
  const settings = normalizeSettings(parseLegacy<ShopSettings>(legacySnapshot[LEGACY_SETTINGS_KEY], base, 'settings'), base, isCjDemo, hasSavedSettings);
  if (legacySnapshot[LEGACY_QR_IMAGE_KEY] && !settings.qrImage) settings.qrImage = legacySnapshot[LEGACY_QR_IMAGE_KEY];
  const rawOrders = parseLegacy<Order[]>(legacySnapshot[LEGACY_ORDERS_KEY], [], 'orders');
  const rawCart = parseLegacy<CartItem[]>(legacySnapshot[LEGACY_CART_KEY], [], 'cart');
  if (!Array.isArray(rawOrders) || !Array.isArray(rawCart)) throw new Error('Saved orders or cart are invalid. Original data was preserved.');
  const orders = rawOrders.map(order => ({ ...order, items: (order.items ?? []).map(item => hydrateCartItemSnapshots(item, settings.menuItems.find(menu => menu.id === item.menuItemId))) }));
  const cart = rawCart.map(item => hydrateCartItemSnapshots(item, settings.menuItems.find(menu => menu.id === item.menuItemId)));
  const rawLanguage = legacySnapshot[LEGACY_LANG_KEY];
  const language: Language = rawLanguage === 'zh' || rawLanguage === 'ms' ? rawLanguage : 'en';
  const prepared = await prepareSettingsPhotos(settings, null, new Map(), false);
  return {
    state: { orders, cart, settings: prepared.settings, language, revision: 0 },
    photos: prepared.photos,
    photoVersions: Object.fromEntries([...prepared.photos.keys()].map(key => [key, uuidv4()])),
    legacySnapshot,
  };
}
