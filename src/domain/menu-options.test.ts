import { describe, expect, it } from 'vitest';
import type { OptionGroup } from '../data/app-schema';
import type { MenuItem } from '../types';
import {
  buildOptionSelectionSnapshots,
  calculateOptionSelectionSen,
  getLegacyAddOnGroupId,
  getLegacyNoodleGroupId,
  getLegacySizeGroupId,
  getEnabledOptionGroups,
  getMenuOptionGroups,
  normalizeMenuItemOptionGroups,
  validateOptionSelections,
} from './menu-options';

function legacyItem(): MenuItem {
  return {
    id: 'dish-1',
    name: { en: 'Dish', zh: '餐点' },
    basePrice: 8,
    image: '',
    sizes: [{ id: 'regular', name: { en: 'Regular', zh: '普通' }, price: 0 }],
    noodleBases: [
      { id: 'rice', name: { en: 'Rice', zh: '白饭' }, price: 0 },
      { id: 'fried-rice', name: { en: 'Fried rice', zh: '炒饭' }, price: 1.2 },
    ],
    addOns: [{ id: 'egg', name: { en: 'Egg', zh: '蛋' }, price: 1.5 }],
  };
}

const groups: OptionGroup[] = [
  {
    id: 'staple',
    names: { en: 'Staple', zh: '主食' },
    required: true,
    minSelect: 1,
    maxSelect: 1,
    sortOrder: 0,
    choices: [
      { id: 'rice', names: { en: 'Rice', zh: '饭' }, priceDeltaSen: 100, enabled: true, sortOrder: 0 },
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
      { id: 'chicken', names: { en: 'Chicken', zh: '鸡肉' }, priceDeltaSen: 200, enabled: true, sortOrder: 0 },
      { id: 'beef', names: { en: 'Beef', zh: '牛肉' }, priceDeltaSen: 300, enabled: false, sortOrder: 1 },
    ],
  },
];

describe('legacy menu option adapter', () => {
  it('maps size, noodles and add-ons to stable generic groups with sen prices', () => {
    const item = legacyItem();
    const normalized = normalizeMenuItemOptionGroups(item);

    expect(normalized.optionGroups?.map((group) => group.id)).toEqual([
      getLegacySizeGroupId(item.id),
      getLegacyNoodleGroupId(item.id),
      getLegacyAddOnGroupId(item.id),
    ]);
    expect(normalized.optionGroups?.[1].maxSelect).toBe(2);
    expect(normalized.optionGroups?.[1].choices[1].priceDeltaSen).toBe(120);
    expect(normalized.optionGroups?.[2].required).toBe(false);
  });

  it('treats an explicit empty optionGroups array as authoritative', () => {
    const item = { ...legacyItem(), optionGroups: [] };
    expect(getMenuOptionGroups(item)).toEqual([]);
    expect(normalizeMenuItemOptionGroups(item).optionGroups).toEqual([]);
  });

  it('is idempotent and does not mutate the input', () => {
    const item = legacyItem();
    const first = normalizeMenuItemOptionGroups(item);
    first.optionGroups?.[0].choices.splice(0, 1);

    expect(item.sizes).toHaveLength(1);
    const second = normalizeMenuItemOptionGroups(normalizeMenuItemOptionGroups(item));
    expect(second.optionGroups).toHaveLength(3);
    expect(second.optionGroups?.[0].choices).toHaveLength(1);
  });

  it('keeps size first and add-ons last when custom groups are added later', () => {
    const normalized = normalizeMenuItemOptionGroups(legacyItem());
    normalized.optionGroups?.push({
      id: 'protein',
      names: { en: 'Protein', zh: '肉类' },
      required: true,
      minSelect: 1,
      maxSelect: 1,
      sortOrder: 99,
      choices: [
        { id: 'beef', names: { en: 'Beef', zh: '牛肉' }, priceDeltaSen: 300, enabled: true, sortOrder: 0 },
      ],
    });

    expect(getEnabledOptionGroups(normalized).map((group) => group.id)).toEqual([
      getLegacySizeGroupId(normalized.id),
      getLegacyNoodleGroupId(normalized.id),
      'protein',
      getLegacyAddOnGroupId(normalized.id),
    ]);
  });
});

describe('generic option selection', () => {
  it('validates each required group independently', () => {
    const missingProtein = validateOptionSelections(groups, { staple: ['rice'] });
    expect(missingProtein).toMatchObject({ valid: false, group: { id: 'protein' }, reason: 'minimum' });

    expect(validateOptionSelections(groups, {
      staple: ['rice'],
      protein: ['chicken'],
    })).toEqual({ valid: true });
  });

  it('rejects disabled and unknown choices', () => {
    expect(validateOptionSelections(groups, {
      staple: ['rice'],
      protein: ['beef'],
    }).reason).toBe('disabled-choice');
    expect(validateOptionSelections(groups, {
      staple: ['rice'],
      protein: ['missing'],
    }).reason).toBe('unknown-choice');
  });

  it('adds every selected delta once and creates immutable snapshots', () => {
    const selections = { staple: ['rice', 'rice'], protein: ['chicken'] };
    expect(calculateOptionSelectionSen(groups, selections)).toBe(300);

    const snapshots = buildOptionSelectionSnapshots(groups, selections);
    expect(snapshots.map((snapshot) => snapshot.choiceId)).toEqual(['rice', 'chicken']);
    groups[0].names.en = 'Changed';
    expect(snapshots[0].groupNames.en).toBe('Staple');
  });
});
