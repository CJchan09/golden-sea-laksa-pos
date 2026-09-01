import { MENU_ITEMS } from './constants';
import { ItemVariation, MenuItem, ShopSettings } from './types';
import { normalizeMenuItemOptionGroups } from './domain/menu-options';

const DEMO_COVER_PHOTO = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCjegoCLzYirXlh1HTLs2_xx75ZJoMPr5SyRVMiS8xTZ1uHZhqRoWFrEDGlID_-pHYBji24mgud-wfj8HtJWpu5iDpCcuWU-on863ufLGMwqrB01nDP6Xq_QxfBQMYBFa5xys0XxG-KzBmBkXxEo0FSPF4OAZhLvJ9s6wn1yhcxFlgwpnkNCm7tg29l-8URv4vqEQliXrBD2PKOqGjwXRKUN9QqkYXarnIo5-Gpzgyqq1vMsjMMadsKz-1Yq96yxHxnRWaQib9OFU2w';

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
