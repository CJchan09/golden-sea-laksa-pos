import { describe, expect, it } from 'vitest';
import type { CartItem, MenuItem } from '../types';
import { getCartItemDisplay, hydrateCartItemSnapshots } from './cart-item-display';
import { getLegacyAddOnGroupId, getLegacySizeGroupId } from './menu-options';

describe('getCartItemDisplay', () => {
  it('keeps item and option names readable after the menu item is deleted', () => {
    const item: CartItem = {
      id: 'line-1',
      menuItemId: 'dish-1',
      sizeId: '',
      noodleBaseIds: [],
      addOnIds: [],
      itemName: { en: 'Fried rice', zh: '炒饭' },
      optionSelections: [
        {
          optionGroupId: getLegacySizeGroupId('dish-1'),
          groupNames: { en: 'Size', zh: '大小份' },
          choiceId: 'large',
          choiceNames: { en: 'Large', zh: '大份' },
          priceDeltaSen: 200,
        },
        {
          optionGroupId: 'protein',
          groupNames: { en: 'Protein', zh: '肉类' },
          choiceId: 'beef',
          choiceNames: { en: 'Beef', zh: '牛肉' },
          priceDeltaSen: 300,
        },
        {
          optionGroupId: getLegacyAddOnGroupId('dish-1'),
          groupNames: { en: 'Add-ons', zh: '加料' },
          choiceId: 'egg',
          choiceNames: { en: 'Egg', zh: '蛋' },
          priceDeltaSen: 150,
        },
      ],
      quantity: 1,
      unitPrice: 13.5,
      totalPrice: 13.5,
    };

    const display = getCartItemDisplay(item, undefined, 'zh');
    expect(display.itemName).toBe('炒饭');
    expect(display.sizeName).toBe('大份');
    expect(display.optionLabels).toEqual(['肉类: 牛肉']);
    expect(display.addOnNames).toEqual(['蛋']);
  });

  it('locks legacy labels before a later menu rename', () => {
    const menuItem: MenuItem = {
      id: 'legacy-dish',
      name: { en: 'Original dish', zh: '原本餐点' },
      basePrice: 8,
      image: '',
      sizes: [{ id: 'small', name: { en: 'Small', zh: '小份' }, price: 0 }],
      noodleBases: [{ id: 'rice', name: { en: 'Rice', zh: '白饭' }, price: 0 }],
      addOns: [],
    };
    const legacyLine: CartItem = {
      id: 'legacy-line',
      menuItemId: menuItem.id,
      sizeId: 'small',
      noodleBaseIds: ['rice'],
      addOnIds: [],
      quantity: 1,
      unitPrice: 8,
      totalPrice: 8,
    };

    const hydrated = hydrateCartItemSnapshots(legacyLine, menuItem);
    menuItem.name.en = 'Renamed dish';
    menuItem.noodleBases[0].name.en = 'Renamed choice';

    const display = getCartItemDisplay(hydrated, menuItem, 'en');
    expect(display.itemName).toBe('Original dish');
    expect(display.optionLabels).toEqual(['Noodle type: Rice']);
    expect(hydrated.totalPrice).toBe(8);
  });

  it('hydrates the earliest string-only size, noodle and add-on fields', () => {
    const menuItem: MenuItem = {
      id: 'old-laksa',
      name: { en: 'Old Laksa', zh: '旧叻沙' },
      basePrice: 8,
      image: '',
      sizes: [{ id: 'Small', name: { en: 'Small', zh: '小碗' }, price: 0 }],
      noodleBases: [{ id: 'Bee Hoon', name: { en: 'Bee Hoon', zh: '米粉' }, price: 0 }],
      addOns: [{ id: 'Add Egg', name: { en: 'Add Egg', zh: '加蛋' }, price: 1 }],
    };
    const earliestLine: CartItem = {
      id: 'old-line',
      menuItemId: menuItem.id,
      sizeId: '',
      size: 'Small',
      noodleBaseIds: [],
      noodleBases: ['Bee Hoon'],
      addOnIds: [],
      addOns: ['Add Egg'],
      // A previous interrupted compatibility pass may already have written
      // empty arrays; they must not hide the older string fields.
      optionSelections: [],
      addOnSelections: [],
      quantity: 1,
      unitPrice: 9,
      totalPrice: 9,
    };

    const hydrated = hydrateCartItemSnapshots(earliestLine, menuItem);
    const display = getCartItemDisplay(hydrated, menuItem, 'zh');

    expect(hydrated.sizeId).toBe('Small');
    expect(hydrated.noodleBaseIds).toEqual(['Bee Hoon']);
    expect(hydrated.addOnIds).toEqual(['Add Egg']);
    expect(display.sizeName).toBe('小碗');
    expect(display.optionLabels).toEqual(['面类: 米粉']);
    expect(display.addOnNames).toEqual(['加蛋']);
    expect(hydrated.totalPrice).toBe(9);
  });
});
