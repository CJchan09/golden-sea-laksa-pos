import { describe, expect, it } from 'vitest';
import { createDemoBaselineSettings } from './demo-baseline';

describe('createDemoBaselineSettings', () => {
  it('returns a fresh deep copy for every visitor reset', () => {
    const changed = createDemoBaselineSettings();
    changed.shopNameEn = 'Changed shop';
    changed.menuItems[0].name.en = 'Changed dish';
    changed.menuItems[0].sizes[0].name.en = 'Changed size';
    changed.menuItems[0].addOns.push({
      id: 'extra',
      name: { en: 'Extra', zh: '额外' },
      price: 99,
    });
    changed.menuItems[0].optionGroups?.[0].choices.push({
      id: 'huge',
      names: { en: 'Huge', zh: '超大' },
      priceDeltaSen: 999,
      enabled: true,
      sortOrder: 99,
    });

    const fresh = createDemoBaselineSettings();

    expect(fresh.shopNameEn).toBe('Golden Sea Laksa');
    expect(fresh.menuItems[0].name.en).toBe('Laksa Without Kerang');
    expect(fresh.menuItems[0].sizes[0].name.en).toBe('Small');
    expect(fresh.menuItems[0].addOns.some((item) => item.id === 'extra')).toBe(false);
    expect(fresh.menuItems[0].optionGroups).toHaveLength(3);
    expect(fresh.menuItems[0].optionGroups?.[0].choices.some((choice) => choice.id === 'huge')).toBe(false);
  });
});
