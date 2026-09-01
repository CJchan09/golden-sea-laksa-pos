import { describe, expect, it } from 'vitest';
import { isErr } from './domain/result';
import { resetPublicDemoStorage } from './demo-reset';
import { MemoryDriver } from './storage/driver';

describe('resetPublicDemoStorage', () => {
  it('clears demo data while preserving passwords and unrelated browser data', () => {
    const driver = new MemoryDriver({
      golden_sea_laksa_settings: '{broken-json',
      golden_sea_laksa_orders: '[{"id":"test-order"}]',
      golden_sea_laksa_cart: '[{"id":"test-cart"}]',
      golden_sea_laksa_lang: 'zh',
      golden_sea_laksa_qr_image: 'data:image/png;base64,test',
      'cjpos.appData': '{"future":"data"}',
      'cjpos.migrationState': '{"done":true}',
      'cjpos.legacyPayload': '{"image":"preserved-until-reset"}',
      'cjpos.demoResetSignal': 'old-signal',
      golden_sea_laksa_admin_pw: 'owner-password',
      golden_sea_admin_auth: 'true',
      some_other_site_token: 'keep-me',
    });

    expect(resetPublicDemoStorage(driver).ok).toBe(true);
    expect(driver.snapshot()).toEqual({
      golden_sea_laksa_admin_pw: 'owner-password',
      golden_sea_admin_auth: 'true',
      some_other_site_token: 'keep-me',
    });
  });

  it('reports a storage failure instead of claiming the reset succeeded', () => {
    const driver = new MemoryDriver({ 'cjpos.appData': '{}' });
    driver.removeItem = () => {
      throw new Error('blocked');
    };

    const result = resetPublicDemoStorage(driver);

    expect(result.ok).toBe(false);
    if (isErr(result)) expect(result.error.code).toBe('STORAGE_WRITE_FAILED');
  });
});
