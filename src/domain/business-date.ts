/**
 * Business date.
 *
 * F&B outlets routinely trade past midnight. Using the calendar day would push
 * a 01:30 order into the next day's numbering sequence and next day's takings,
 * which is the kind of reconciliation error an owner notices immediately.
 *
 * `businessDayCutoff` (default 04:00 local) is the boundary instead: anything
 * before it belongs to the previous business date.
 */

/** "HH:MM" in 24-hour local time. */
export type CutoffTime = string;

export const DEFAULT_BUSINESS_DAY_CUTOFF: CutoffTime = '04:00';

/** A business date as `YYYY-MM-DD`. Not a timestamp -- no timezone attached. */
export type BusinessDate = string;

export function parseCutoffMinutes(cutoff: CutoffTime): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(cutoff.trim());
  if (!match) {
    throw new TypeError(`businessDayCutoff must be "HH:MM" in 24-hour time, received: ${cutoff}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatLocalDate(date: Date): BusinessDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Resolve the business date for an instant.
 *
 * Uses the runtime's local timezone, which is the device standing at the
 * counter -- the same clock the staff reads off the wall.
 */
export function toBusinessDate(
  at: Date,
  cutoff: CutoffTime = DEFAULT_BUSINESS_DAY_CUTOFF
): BusinessDate {
  const cutoffMinutes = parseCutoffMinutes(cutoff);
  const minutesIntoDay = at.getHours() * 60 + at.getMinutes();

  if (minutesIntoDay >= cutoffMinutes) return formatLocalDate(at);

  const previous = new Date(at.getTime());
  previous.setDate(previous.getDate() - 1);
  return formatLocalDate(previous);
}

/** Start instant of a business date, for range queries over history. */
export function businessDateStart(
  businessDate: BusinessDate,
  cutoff: CutoffTime = DEFAULT_BUSINESS_DAY_CUTOFF
): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(businessDate);
  if (!match) throw new TypeError(`businessDate must be "YYYY-MM-DD", received: ${businessDate}`);

  const cutoffMinutes = parseCutoffMinutes(cutoff);
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Math.floor(cutoffMinutes / 60),
    cutoffMinutes % 60,
    0,
    0
  );
}
