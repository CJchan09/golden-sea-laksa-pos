import { MENU_ITEMS } from './constants';
import { ItemVariation, MenuItem, ShopSettings } from './types';
import { normalizeMenuItemOptionGroups } from './domain/menu-options';

const DEMO_COVER_PHOTO = `${import.meta.env.BASE_URL}assets/pos-menu-cover-v3.webp`;
const IS_CJ_DEMO = import.meta.env.VITE_ANDROID_APP === 'true' || import.meta.env.VITE_PUBLIC_DEMO === 'true';

function cloneVariation(variation: ItemVariation): ItemVariation {
  return {
    ...variation,
    name: { ...variation.name },
  };
}

function cloneMenuItem(item: MenuItem): MenuItem {
  const clone: MenuItem = {
    ...item,
    name: { ...item.name },
    sizes: item.sizes.map(cloneVariation),
    noodleBases: item.noodleBases.map(cloneVariation),
    addOns: item.addOns.map(cloneVariation),
  };
  if (Object.prototype.hasOwnProperty.call(item, 'optionGroups')) {
    clone.optionGroups = (item.optionGroups ?? []).map((group) => ({
      ...group,
      names: { ...group.names },
      choices: group.choices.map((choice) => ({
        ...choice,
        names: { ...choice.names },
      })),
    }));
  }
  const normalized = normalizeMenuItemOptionGroups(clone);
  normalized.optionGroups = normalized.optionGroups?.map(group => ({
    ...group,
    names: { ...group.names, ms: group.id.endsWith('legacy-size-group') ? 'Saiz' : group.id.endsWith('legacy-add-on-group') ? 'Tambahan' : group.id.endsWith('legacy-noodle-group') ? 'Jenis mi' : group.names.ms },
  }));
  return normalized;
}

/** A fresh copy prevents one visitor's edits from mutating the shared baseline. */
export function createDemoBaselineSettings(): ShopSettings {
  return {
    shopNameEn: IS_CJ_DEMO ? 'CJ POS Demo' : 'Golden Sea Laksa',
    shopNameZh: IS_CJ_DEMO ? 'CJ POS 示范店' : '金海叻沙',
    shopNameMs: IS_CJ_DEMO ? 'CJ POS Demo' : 'Golden Sea Laksa',
    defaultOrderType: 'Takeaway',
    coverPhoto: DEMO_COVER_PHOTO,
    qrImage: null,
    menuItems: MENU_ITEMS.map(cloneMenuItem),
    enableTax: false,
    taxRate: 6,
    takeawayFee: 0.5,
  };
}
