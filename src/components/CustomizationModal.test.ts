import { describe, expect, it } from 'vitest';
import { MenuItem } from '../types';
import { getEnabledOptionGroups, validateOptionSelections } from '../domain/menu-options';
import { calculateCustomizationTotal } from './CustomizationModal';

const item: MenuItem = {
  id: 'fried-rice',
  name: { en: 'Fried Rice', zh: '炒饭' },
  basePrice: 10.07,
  image: '',
  sizes: [],
  noodleBases: [],
  addOns: [],
  optionGroups: [
    {
      id: 'staple',
      names: { en: 'Staple', zh: '主食' },
      required: true,
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 0,
      choices: [
        { id: 'rice', names: { en: 'Rice', zh: '饭' }, priceDeltaSen: 0, enabled: true, sortOrder: 0 },
        { id: 'noodle', names: { en: 'Noodles', zh: '面' }, priceDeltaSen: 43, enabled: true, sortOrder: 1 },
      ],
    },
    {
      id: 'protein',
      names: { en: 'Protein', zh: '肉类' },
      required: true,
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 1,
      choices: [
        { id: 'chicken', names: { en: 'Chicken', zh: '鸡肉' }, priceDeltaSen: 0, enabled: true, sortOrder: 0 },
        { id: 'beef', names: { en: 'Beef', zh: '牛肉' }, priceDeltaSen: 250, enabled: true, sortOrder: 1 },
      ],
    },
    {
      id: 'extras',
      names: { en: 'Extras', zh: '加料' },
      required: false,
      minSelect: 0,
      maxSelect: 2,
      sortOrder: 2,
      choices: [
        { id: 'egg', names: { en: 'Egg', zh: '蛋' }, priceDeltaSen: 125, enabled: true, sortOrder: 0 },
      ],
    },
  ],
};

describe('calculateCustomizationTotal', () => {
  it('adds independent option groups in sen, then applies quantity', () => {
    expect(calculateCustomizationTotal(item, {
      optionSelections: {
        staple: ['noodle'],
        protein: ['beef'],
        extras: ['egg'],
      },
      quantity: 2,
    })).toBe(28.5);
  });

  it('does not charge for an unknown choice and validation rejects it', () => {
    const selections = {
      staple: ['missing'],
      protein: ['chicken'],
      extras: [],
    };

    expect(calculateCustomizationTotal(item, {
      optionSelections: selections,
      quantity: 1,
    })).toBe(10.07);

    expect(validateOptionSelections(getEnabledOptionGroups(item), selections)).toMatchObject({
      valid: false,
      reason: 'unknown-choice',
      group: { id: 'staple' },
    });
  });
});
