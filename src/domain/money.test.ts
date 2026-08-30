import { describe, expect, it } from 'vitest';
import {
  applyPercentage,
  formatMoney,
  fromRinggit,
  isSen,
  multiplySen,
  roundHalfAwayFromZero,
  senToDecimalString,
  sumSen,
  toRinggit,
} from './money';

describe('fromRinggit', () => {
  it('converts plain strings', () => {
    expect(fromRinggit('0')).toBe(0);
    expect(fromRinggit('8')).toBe(800);
    expect(fromRinggit('8.00')).toBe(800);
    expect(fromRinggit('10.07')).toBe(1007);
    expect(fromRinggit('0.5')).toBe(50);
    expect(fromRinggit('.5')).toBe(50);
  });

  it('handles negatives', () => {
    expect(fromRinggit('-2.50')).toBe(-250);
  });

  it('rounds a third decimal half up', () => {
    expect(fromRinggit('1.005')).toBe(101);
    expect(fromRinggit('1.004')).toBe(100);
  });

  it('converts numbers without float drift', () => {
    // The classic float traps that would otherwise land a sen off.
    expect(fromRinggit(10.07)).toBe(1007);
    expect(fromRinggit(0.1 + 0.2)).toBe(30);
    expect(fromRinggit(1.005)).toBe(100); // 1.005 is stored as 1.00499...
    expect(fromRinggit(8.0)).toBe(800);
  });

  it('rejects junk', () => {
    expect(() => fromRinggit('')).toThrow();
    expect(() => fromRinggit('abc')).toThrow();
    expect(() => fromRinggit(Number.NaN)).toThrow();
    expect(() => fromRinggit(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('round-trips through the decimal string form', () => {
    for (const value of ['0.00', '0.01', '7.50', '10.07', '123.45', '9999.99']) {
      expect(senToDecimalString(fromRinggit(value))).toBe(value);
    }
  });
});

describe('toRinggit / senToDecimalString', () => {
  it('formats padded cents', () => {
    expect(senToDecimalString(5)).toBe('0.05');
    expect(senToDecimalString(50)).toBe('0.50');
    expect(senToDecimalString(1007)).toBe('10.07');
    expect(senToDecimalString(-250)).toBe('-2.50');
  });

  it('exposes a display-only float', () => {
    expect(toRinggit(1007)).toBeCloseTo(10.07, 10);
  });

  it('refuses non-integer sen', () => {
    expect(() => senToDecimalString(10.5)).toThrow();
    expect(isSen(10.5)).toBe(false);
    expect(isSen(10)).toBe(true);
  });
});

describe('formatMoney', () => {
  it('uses the configured symbol rather than a hardcoded RM', () => {
    expect(formatMoney(1007, { currencySymbol: 'RM' })).toBe('RM10.07');
    expect(formatMoney(1007, { currencySymbol: 'S$', spaceAfterSymbol: true })).toBe('S$ 10.07');
  });

  it('places the sign before the symbol', () => {
    expect(formatMoney(-250, { currencySymbol: 'RM' })).toBe('-RM2.50');
  });
});

describe('roundHalfAwayFromZero', () => {
  it('is symmetric, unlike Math.round', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(Math.round(-2.5)).toBe(-2); // documents why we do not use Math.round
  });
});

describe('applyPercentage', () => {
  it('computes SST 6% and service 10%', () => {
    expect(applyPercentage(1000, 6)).toBe(60);
    expect(applyPercentage(1000, 10)).toBe(100);
  });

  it('rounds to whole sen', () => {
    expect(applyPercentage(1007, 6)).toBe(60); // 60.42
    expect(applyPercentage(1009, 6)).toBe(61); // 60.54
  });

  it('accepts fractional rates', () => {
    expect(applyPercentage(2000, 2.5)).toBe(50);
  });

  it('rejects non-integer bases', () => {
    expect(() => applyPercentage(10.5, 6)).toThrow();
  });
});

describe('stacked charges', () => {
  // This is the exact worked example printed in Admin_Configuration_Spec.md.
  it('matches the documented RM10 example to the sen', () => {
    const subtotal = fromRinggit('10.00');

    const serviceCharge = applyPercentage(subtotal, 10);
    expect(serviceCharge).toBe(100);

    const tax = applyPercentage(subtotal + serviceCharge, 6);
    expect(tax).toBe(66);

    const packaging = fromRinggit('0.50');
    const total = sumSen([subtotal, serviceCharge, tax, packaging]);

    expect(total).toBe(1216);
    expect(senToDecimalString(total)).toBe('12.16');
  });

  it('keeps printed lines adding up to the printed total', () => {
    // Rounding per charge (not once at the end) is what guarantees this.
    const subtotal = fromRinggit('7.77');
    const service = applyPercentage(subtotal, 10); // 77.7 -> 78
    const tax = applyPercentage(subtotal + service, 6); // 51.3 -> 51
    const total = sumSen([subtotal, service, tax]);

    expect(service).toBe(78);
    expect(tax).toBe(51);
    expect(total).toBe(777 + 78 + 51);
  });
});

describe('sumSen / multiplySen', () => {
  it('sums integers exactly', () => {
    expect(sumSen([1, 2, 3])).toBe(6);
    expect(sumSen([])).toBe(0);
  });

  it('rejects floats hiding in a list', () => {
    expect(() => sumSen([100, 0.5])).toThrow();
  });

  it('multiplies by whole quantities', () => {
    expect(multiplySen(850, 3)).toBe(2550);
    expect(multiplySen(850, 0)).toBe(0);
    expect(() => multiplySen(850, 1.5)).toThrow();
    expect(() => multiplySen(850, -1)).toThrow();
  });
});
