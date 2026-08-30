import { describe, expect, it } from 'vitest';
import { createEmptyAppData } from './schema-defaults';

describe('createEmptyAppData', () => {
  it('deeply isolates nested defaults between app-data instances', () => {
    const first = createEmptyAppData('biz_first');

    first.orderModes[0].names.en = 'Changed mode';
    first.paymentMethods[0].names.en = 'Changed payment';
    first.receiptSettings.footerText.en = 'Changed footer';
    first.localeSettings.enabledLanguages.push('zh');

    const second = createEmptyAppData('biz_second');

    expect(second.orderModes[0].names.en).toBe('Dine-in');
    expect(second.paymentMethods[0].names.en).toBe('Cash');
    expect(second.receiptSettings.footerText).toEqual({});
    expect(second.localeSettings.enabledLanguages).toEqual(['en']);
  });
});
