/**
 * Money.
 *
 * CJ decision 2026-08-30: every persisted amount is an INTEGER number of sen.
 * Floats are banned for money because the product stacks percentage tax onto
 * percentage service charge onto a fixed packaging fee, and float drift there
 * shows up as one-sen mismatches on the merchant's daily reconciliation --
 * exactly the "Calculation Error Rate" the metrics doc wants at zero.
 *
 * Convention: any field holding money is named `...Sen` and typed `Sen`.
 */

/** An integer number of sen. 100 sen = RM 1.00. */
export type Sen = number;

export function isSen(value: unknown): value is Sen {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

export function assertSen(value: unknown, label = 'amount'): asserts value is Sen {
  if (!isSen(value)) {
    throw new TypeError(`${label} must be an integer number of sen, received: ${String(value)}`);
  }
}

/**
 * Round half away from zero.
 *
 * `Math.round` rounds half toward +Infinity, so it is asymmetric for negatives
 * (`Math.round(-2.5) === -2`). Refunds and negative price deltas need the
 * symmetric behaviour merchants expect.
 */
export function roundHalfAwayFromZero(n: number): number {
  return n < 0 ? -Math.round(-n) : Math.round(n);
}

/**
 * Parse a ringgit amount into sen.
 *
 * Strings take a pure string path (no float multiplication at all) so values
 * like "10.07" cannot drift. Numbers are accepted for migrating legacy float
 * data and are routed through the same string path via `toFixed`.
 */
export function fromRinggit(value: string | number): Sen {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot convert non-finite number to sen: ${value}`);
    }
    // toFixed(2) resolves the float to its intended 2-decimal presentation
    // before we touch it, e.g. 10.07 -> "10.07", 0.1 + 0.2 -> "0.30".
    return fromRinggit(value.toFixed(2));
  }

  const raw = value.trim();
  if (raw === '') throw new TypeError('Cannot convert empty string to sen');

  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(raw);
  if (!match) throw new TypeError(`Not a valid ringgit amount: ${value}`);

  const [, sign, whole = '', frac = ''] = match;
  if (whole === '' && frac === '') throw new TypeError(`Not a valid ringgit amount: ${value}`);

  // Take exactly two decimals, rounding the third if present.
  const cents = (frac + '00').slice(0, 2);
  const needsRounding = frac.length > 2 && Number(frac[2]) >= 5;

  let sen = Number(whole || '0') * 100 + Number(cents);
  if (needsRounding) sen += 1;

  return sign === '-' ? -sen : sen;
}

/** Sen -> ringgit as a number. Display only; never persist the result. */
export function toRinggit(sen: Sen): number {
  assertSen(sen);
  return sen / 100;
}

/** Sen -> fixed 2-decimal string, no currency symbol. */
export function senToDecimalString(sen: Sen): string {
  assertSen(sen);
  const negative = sen < 0;
  const abs = Math.abs(sen);
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

export interface MoneyFormatOptions {
  /** e.g. "RM". Not hardcoded -- currency is merchant-configurable. */
  currencySymbol: string;
  /** Space between symbol and number. Defaults to false (RM10.00). */
  spaceAfterSymbol?: boolean;
}

export function formatMoney(sen: Sen, options: MoneyFormatOptions): string {
  const gap = options.spaceAfterSymbol ? ' ' : '';
  const text = senToDecimalString(sen);
  return text.startsWith('-')
    ? `-${options.currencySymbol}${gap}${text.slice(1)}`
    : `${options.currencySymbol}${gap}${text}`;
}

/**
 * Apply a percentage to a sen amount, rounding to whole sen immediately.
 *
 * Rounding happens per charge rather than once at the end so the receipt's
 * printed lines always add up to the printed total. `baseSen * rate` stays
 * exact for integer and half-integer rates, which covers SST 6% / service 10%.
 */
export function applyPercentage(baseSen: Sen, ratePercent: number): Sen {
  assertSen(baseSen, 'baseSen');
  if (!Number.isFinite(ratePercent)) {
    throw new TypeError(`Percentage must be finite, received: ${ratePercent}`);
  }
  return roundHalfAwayFromZero((baseSen * ratePercent) / 100);
}

export function sumSen(amounts: readonly Sen[]): Sen {
  let total = 0;
  for (const amount of amounts) {
    assertSen(amount);
    total += amount;
  }
  return total;
}

/** Multiply a unit price by a whole-unit quantity. */
export function multiplySen(unitSen: Sen, quantity: number): Sen {
  assertSen(unitSen, 'unitSen');
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new TypeError(`Quantity must be a non-negative integer, received: ${quantity}`);
  }
  return unitSen * quantity;
}
