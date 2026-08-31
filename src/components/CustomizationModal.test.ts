import { describe, expect, it } from 'vitest';
import { MenuItem } from '../types';
import { calculateCustomizationTotal } from './CustomizationModal';

const item: MenuItem = {
  id: 'laksa',
  name: { en: 'Laksa', zh: '叻沙' },
  basePrice: 10,
  image: '',
  sizes: [{ id: 'large', name: { en: 'Large', zh: '大' }, price: 2 }],
  noodleBases: [
    { id: 'mee', name: { en: 'Mee', zh: '面' }, price: 1 },
    { id: 'hoon', name: { en: 'Bee Hoon', zh: '米粉' }, price: 0.5 },
  ],
  addOns: [{ id: 'egg', name: { en: 'Egg', zh: '蛋' }, price: 1.5 }],
};

describe('calculateCustomizationTotal', () => {
  it('includes selected size, noodle bases, add-ons, and quantity', () => {
    expect(calculateCustomizationTotal(item, {
      sizeId: 'large',
      noodleBaseIds: ['mee', 'hoon'],
      addOnIds: ['egg'],
      quantity: 2,
    })).toBe(30);
  });

  it('ignores option ids that do not belong to the item', () => {
    expect(calculateCustomizationTotal(item, {
      sizeId: 'missing',
      noodleBaseIds: ['missing'],
      addOnIds: ['missing'],
      quantity: 1,
    })).toBe(10);
  });
});
