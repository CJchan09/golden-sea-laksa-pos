import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function baselineFor(android: boolean, publicDemo = false) {
  vi.stubEnv('VITE_ANDROID_APP', android ? 'true' : 'false');
  vi.stubEnv('VITE_PUBLIC_DEMO', publicDemo ? 'true' : 'false');
  vi.resetModules();
  const { createDemoBaselineSettings } = await import('./demo-baseline');
  return createDemoBaselineSettings;
}

describe('createDemoBaselineSettings', () => {
  it.each([
    { platform: 'private website', android: false, publicDemo: false, shop: 'Golden Sea Laksa' },
    { platform: 'public website', android: false, publicDemo: true, shop: 'CJ POS Demo' },
    { platform: 'Android', android: true, publicDemo: true, shop: 'CJ POS Demo' },
  ])('returns a fresh deep copy for the $platform reset', async ({ android, publicDemo, shop }) => {
    const createDemoBaselineSettings = await baselineFor(android, publicDemo);
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

    expect(fresh.shopNameEn).toBe(shop);
    expect(fresh.defaultOrderType).toBe('Takeaway');
    expect(fresh.menuItems[0].name.en).toBe('Laksa Without Kerang');
    expect(fresh.menuItems[0].sizes[0].name.en).toBe('Small');
    expect(fresh.menuItems[0].addOns.some((item) => item.id === 'extra')).toBe(false);
    expect(fresh.menuItems[0].optionGroups).toHaveLength(3);
    expect(fresh.menuItems[0].optionGroups?.[0].choices.some((choice) => choice.id === 'huge')).toBe(false);
  });

  it('migrates the old public sample while preserving a custom merchant', async () => {
    const createDemoBaselineSettings = await baselineFor(false, true);
    const { migrateLegacySnapshot, renameLegacyDemoSettings } = await import('./storage/pos-legacy');
    const sample = { ...createDemoBaselineSettings(), shopNameEn: 'Golden Sea Laksa', shopNameZh: '金海叻沙', shopNameMs: 'Golden Sea Laksa' };
    const imported = await migrateLegacySnapshot({ golden_sea_laksa_settings: JSON.stringify(sample) }, createDemoBaselineSettings());
    expect(imported.state.settings.shopNameEn).toBe('CJ POS Demo');
    expect(imported.state.settings.shopNameMs).toBe('CJ POS Demo');
    const custom = { ...sample, shopNameEn: 'My Bakery' };
    expect(renameLegacyDemoSettings(custom, true)).toBe(custom);
  });

  it('starts a new Android shop in English with takeaway selected', async () => {
    const createDemoBaselineSettings = await baselineFor(true);
    const { migrateLegacySnapshot } = await import('./storage/pos-legacy');
    const imported = await migrateLegacySnapshot({}, createDemoBaselineSettings(), true);
    expect(imported.state.language).toBe('en');
    expect(imported.state.settings.shopNameEn).toBe('CJ POS Demo');
    expect(imported.state.settings.defaultOrderType).toBe('Takeaway');
  });
});
