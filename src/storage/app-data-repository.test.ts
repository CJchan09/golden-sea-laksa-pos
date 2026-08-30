import { describe, expect, it } from 'vitest';
import { isErr, isOk } from '../domain/result';
import { AppDataRepository } from './app-data-repository';
import { MemoryDriver } from './driver';
import { APP_DATA_KEY, MIGRATION_STATE_KEY } from './keys';
import { createEmptyAppData } from '../data/schema-defaults';

function quotaError(): Error {
  const e = new Error('quota');
  e.name = 'QuotaExceededError';
  return e;
}

describe('AppDataRepository.load', () => {
  it('treats an empty device as "nothing stored yet", not an error', () => {
    const result = new AppDataRepository(new MemoryDriver()).load();
    expect(result.ok).toBe(true);
    if (isOk(result)) expect(result.value).toBeNull();
  });

  it('round-trips a saved schema', () => {
    const repo = new AppDataRepository(new MemoryDriver());
    const data = createEmptyAppData('biz_1');
    data.businessProfile.displayName = 'Kedai Kopi';

    expect(repo.save(data).ok).toBe(true);

    const loaded = repo.load();
    expect(loaded.ok).toBe(true);
    if (isOk(loaded)) expect(loaded.value?.businessProfile.displayName).toBe('Kedai Kopi');
  });

  it('reports unreadable JSON and leaves the bytes untouched', () => {
    const driver = new MemoryDriver({ [APP_DATA_KEY]: '{ this is not json' });
    const result = new AppDataRepository(driver).load();

    expect(result.ok).toBe(false);
    if (isErr(result)) expect(result.error.code).toBe('PARSE_FAILED');
    // The only copy of the merchant's orders must survive so it can be exported.
    expect(driver.getItem(APP_DATA_KEY)).toBe('{ this is not json');
  });

  it('rejects data from a newer app version instead of mangling it', () => {
    const data = { ...createEmptyAppData('biz_1'), schemaVersion: 999 };
    const driver = new MemoryDriver({ [APP_DATA_KEY]: JSON.stringify(data) });

    const result = new AppDataRepository(driver).load();
    expect(result.ok).toBe(false);
    if (isErr(result)) expect(result.error.code).toBe('SCHEMA_INVALID');
  });

  it('rejects float money', () => {
    const data = createEmptyAppData('biz_1');
    (data.orders as unknown[]).push({
      orderUid: 'o1',
      displayNumber: '1',
      totalSen: 10.5,
      lines: [],
    });
    const driver = new MemoryDriver({ [APP_DATA_KEY]: JSON.stringify(data) });

    const result = new AppDataRepository(driver).load();
    expect(result.ok).toBe(false);
    if (isErr(result)) expect(result.error.message).toContain('whole sen');
  });

  it('rejects duplicate order ids', () => {
    const data = createEmptyAppData('biz_1');
    const order = { orderUid: 'dup', displayNumber: '1', totalSen: 100, lines: [] };
    (data.orders as unknown[]).push(order, { ...order });
    const driver = new MemoryDriver({ [APP_DATA_KEY]: JSON.stringify(data) });

    const result = new AppDataRepository(driver).load();
    expect(result.ok).toBe(false);
    if (isErr(result)) expect(result.error.message).toContain('Duplicate orderUid');
  });
});

describe('AppDataRepository.save', () => {
  it('surfaces a quota rejection with an actionable message', () => {
    const driver = new MemoryDriver();
    driver.failOnWrite = quotaError();

    const result = new AppDataRepository(driver).save(createEmptyAppData('biz_1'));
    expect(result.ok).toBe(false);
    if (isErr(result)) {
      expect(result.error.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(result.error.message).toContain('backup');
    }
  });

  it('does not report success when the driver silently drops the write', () => {
    // Private-browsing modes have historically accepted setItem and stored
    // nothing. Telling the merchant "saved" there would be a lie.
    const driver = new MemoryDriver();
    driver.setItem = () => {};

    const result = new AppDataRepository(driver).save(createEmptyAppData('biz_1'));
    expect(result.ok).toBe(false);
    if (isErr(result)) expect(result.error.code).toBe('VERIFY_FAILED');
  });
});

describe('AppDataRepository.writeRaw', () => {
  it('does not report success when a raw marker write is silently dropped', () => {
    const driver = new MemoryDriver();
    driver.setItem = () => {};

    const result = new AppDataRepository(driver).writeRaw(MIGRATION_STATE_KEY, '{"done":true}');

    expect(result.ok).toBe(false);
    if (isErr(result)) expect(result.error.code).toBe('VERIFY_FAILED');
    expect(driver.getItem(MIGRATION_STATE_KEY)).toBeNull();
  });
});

describe('AppDataRepository.clearProductData', () => {
  it('clears only this product namespace', () => {
    const driver = new MemoryDriver({
      [APP_DATA_KEY]: '{}',
      [MIGRATION_STATE_KEY]: '{}',
      golden_sea_laksa_orders: '[]',
      some_other_site_token: 'keep-me',
    });

    expect(new AppDataRepository(driver).clearProductData().ok).toBe(true);

    expect(driver.getItem(APP_DATA_KEY)).toBeNull();
    expect(driver.getItem(MIGRATION_STATE_KEY)).toBeNull();
    // Legacy keys are the rollback path and must survive a reset.
    expect(driver.getItem('golden_sea_laksa_orders')).toBe('[]');
    expect(driver.getItem('some_other_site_token')).toBe('keep-me');
  });
});
