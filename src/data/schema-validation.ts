/**
 * Structural validation for anything read off disk or handed to Import.
 *
 * Deliberately shallow: it proves the shape is safe to work with, it does not
 * enforce business rules. The point is that a corrupt or foreign file is
 * rejected BEFORE it can overwrite a merchant's real orders.
 */

import { isSen } from '../domain/money';
import { AppDataSchema, CURRENT_SCHEMA_VERSION } from './app-schema';
import { Result, err, ok } from '../domain/result';

const REQUIRED_ARRAYS = [
  'orderModes',
  'paymentMethods',
  'chargeRules',
  'menuCategories',
  'menuItems',
  'optionGroups',
  'orders',
] as const;

const REQUIRED_OBJECTS = [
  'businessProfile',
  'localeSettings',
  'featureFlags',
  'receiptSettings',
  'numberingSettings',
] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateAppData(data: unknown): Result<AppDataSchema> {
  if (!isPlainObject(data)) {
    return err('SCHEMA_INVALID', 'Backup file is not a JSON object.');
  }

  if (typeof data.schemaVersion !== 'number' || !Number.isInteger(data.schemaVersion)) {
    return err('SCHEMA_INVALID', 'Missing or invalid schemaVersion.');
  }

  if (data.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return err(
      'SCHEMA_INVALID',
      `This file was created by a newer version (schema ${data.schemaVersion}). ` +
        `Update the app before importing it.`
    );
  }

  for (const key of REQUIRED_OBJECTS) {
    if (!isPlainObject(data[key])) {
      return err('SCHEMA_INVALID', `Missing or invalid section: ${key}.`);
    }
  }

  for (const key of REQUIRED_ARRAYS) {
    if (!Array.isArray(data[key])) {
      return err('SCHEMA_INVALID', `Missing or invalid list: ${key}.`);
    }
  }

  const orders = data.orders as unknown[];
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    if (!isPlainObject(o)) {
      return err('SCHEMA_INVALID', `Order at position ${i} is not an object.`);
    }
    if (typeof o.orderUid !== 'string' || o.orderUid === '') {
      return err('SCHEMA_INVALID', `Order at position ${i} has no orderUid.`);
    }
    if (typeof o.displayNumber !== 'string') {
      return err('SCHEMA_INVALID', `Order ${o.orderUid} has no displayNumber.`);
    }
    if (!isSen(o.totalSen)) {
      return err(
        'SCHEMA_INVALID',
        `Order ${o.orderUid} has a non-integer total (${String(o.totalSen)}). ` +
          `Amounts must be whole sen.`
      );
    }
    if (!Array.isArray(o.lines)) {
      return err('SCHEMA_INVALID', `Order ${o.orderUid} has no lines array.`);
    }
  }

  const uids = new Set<string>();
  for (const o of orders as Array<{ orderUid: string }>) {
    if (uids.has(o.orderUid)) {
      return err('SCHEMA_INVALID', `Duplicate orderUid in file: ${o.orderUid}.`);
    }
    uids.add(o.orderUid);
  }

  return ok(data as unknown as AppDataSchema);
}
