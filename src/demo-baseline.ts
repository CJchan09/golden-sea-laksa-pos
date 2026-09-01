import { MENU_ITEMS } from './constants';
import { ItemVariation, MenuItem, ShopSettings } from './types';
import { normalizeMenuItemOptionGroups } from './domain/menu-options';

const DEMO_COVER_PHOTO = `${import.meta.env.BASE_URL}assets/pos-hero-v2-black-yellow.png`;

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
  return normalizeMenuItemOptionGroups(clone);
}

/** A fresh copy prevents one visitor's edits from mutating the shared baseline. */
export function createDemoBaselineSettings(): ShopSettings {
  return {
    shopNameEn: 'Golden Sea Laksa',
    shopNameZh: '金海叻沙',
    coverPhoto: DEMO_COVER_PHOTO,
    qrImage: null,
    menuItems: MENU_ITEMS.map(cloneMenuItem),
    enableTax: false,
    taxRate: 6,
    takeawayFee: 0.5,
  };
}
