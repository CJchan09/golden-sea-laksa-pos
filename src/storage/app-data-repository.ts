/**
 * The single door between the app and persisted data.
 *
 * Phase 1A rules enforced here:
 *  - every failure comes back as a Result, never a silent no-op
 *  - a write is verified by reading it back before it counts as saved
 *  - nothing prunes orders by age; only the owner deletes their own records
 */

import { AppDataSchema } from '../data/app-schema';
import { validateAppData } from '../data/schema-validation';
import { Result, err, isQuotaError, ok } from '../domain/result';
import { KeyValueDriver } from './driver';
import { APP_DATA_KEY, isProductKey } from './keys';

export class AppDataRepository {
  constructor(private readonly driver: KeyValueDriver) {}

  /** `null` value means "nothing stored yet", which is not an error. */
  load(): Result<AppDataSchema | null> {
    let raw: string | null;
    try {
      raw = this.driver.getItem(APP_DATA_KEY);
    } catch (e) {
      return err('STORAGE_UNAVAILABLE', 'Browser storage could not be read.', e);
    }

    if (raw === null) return ok(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Keep the corrupt payload in place. Overwriting it would destroy the
      // only copy of the merchant's orders; the UI offers a raw export instead.
      return err(
        'PARSE_FAILED',
        'Stored data is not readable JSON. It has been left untouched so it can still be exported.',
        e
      );
    }

    return validateAppData(parsed);
  }

  save(data: AppDataSchema): Result<void> {
    let serialised: string;
    try {
      serialised = JSON.stringify(data);
    } catch (e) {
      return err('STORAGE_WRITE_FAILED', 'Data could not be serialised.', e);
    }

    try {
      this.driver.setItem(APP_DATA_KEY, serialised);
    } catch (e) {
      if (isQuotaError(e)) {
        return err(
          'STORAGE_QUOTA_EXCEEDED',
          'This device has run out of browser storage. Export a backup, then remove old images or archive old orders.',
          e
        );
      }
      return err('STORAGE_WRITE_FAILED', 'Data could not be saved to this device.', e);
    }

    // Read back. A driver that quietly drops writes (private mode, extensions)
    // must not be reported to the merchant as a successful save.
    let verify: string | null;
    try {
      verify = this.driver.getItem(APP_DATA_KEY);
    } catch (e) {
      return err('VERIFY_FAILED', 'Saved data could not be read back for verification.', e);
    }
    if (verify !== serialised) {
      return err('VERIFY_FAILED', 'Saved data did not read back correctly. Nothing was confirmed.');
    }

    return ok(undefined);
  }

  /** Raw read for the migration and for exporting unreadable data. */
  readRaw(key: string): string | null {
    try {
      return this.driver.getItem(key);
    } catch {
      return null;
    }
  }

  writeRaw(key: string, value: string): Result<void> {
    try {
      this.driver.setItem(key, value);
    } catch (e) {
      if (isQuotaError(e)) {
        return err('STORAGE_QUOTA_EXCEEDED', 'Out of browser storage.', e);
      }
      return err('STORAGE_WRITE_FAILED', 'Could not write to browser storage.', e);
    }

    // Migration payloads and completion markers are just as important as the
    // main app-data document. A browser/extension that silently drops one of
    // these writes must not let the runner claim that migration completed.
    let verify: string | null;
    try {
      verify = this.driver.getItem(key);
    } catch (e) {
      return err('VERIFY_FAILED', 'Raw storage write could not be read back for verification.', e);
    }
    if (verify !== value) {
      return err('VERIFY_FAILED', 'Raw storage write did not read back correctly.');
    }

    return ok(undefined);
  }

  /** Clears only this product's keys. Other sites' data is never touched. */
  clearProductData(): Result<void> {
    try {
      for (const key of this.driver.keys()) {
        if (isProductKey(key)) this.driver.removeItem(key);
      }
      return ok(undefined);
    } catch (e) {
      return err('STORAGE_WRITE_FAILED', 'Could not clear stored data.', e);
    }
  }
}
