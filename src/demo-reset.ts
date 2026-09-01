import { ALL_LEGACY_KEYS } from './data/migrations/legacy-keys';
import { Result, err, isErr, ok } from './domain/result';
import { AppDataRepository } from './storage/app-data-repository';
import { KeyValueDriver } from './storage/driver';

export const ACTIVE_DEMO_SYNC_CHANNEL_NAME = 'golden_sea_laksa_sync';
export const PUBLIC_DEMO_RESET_MESSAGE = 'public_demo_reset';
export const PUBLIC_DEMO_RESET_SIGNAL_KEY = 'cjpos.demoResetSignal';

/**
 * Clears only this product's demo data. Passwords, session access and unrelated
 * browser data are deliberately outside the allowlist.
 */
export function resetPublicDemoStorage(driver: KeyValueDriver): Result<void> {
  const currentDataResult = new AppDataRepository(driver).clearProductData();
  if (isErr(currentDataResult)) return currentDataResult;

  try {
    for (const key of ALL_LEGACY_KEYS) driver.removeItem(key);
    return ok(undefined);
  } catch (cause) {
    return err(
      'STORAGE_WRITE_FAILED',
      'This browser could not restore the demo data. No unrelated browser data was touched.',
      cause,
    );
  }
}

/** Tell other tabs on this same browser to discard their in-memory demo copy. */
export function broadcastPublicDemoReset(): void {
  // `storage` reaches other tabs even where BroadcastChannel is unavailable.
  // The signal contains no business data and is replaced on every reset.
  try {
    window.localStorage.setItem(
      PUBLIC_DEMO_RESET_SIGNAL_KEY,
      `${Date.now()}-${Math.random()}`,
    );
  } catch {
    // BroadcastChannel below may still be available.
  }

  if (typeof BroadcastChannel === 'undefined') return;

  try {
    const resetChannel = new BroadcastChannel(ACTIVE_DEMO_SYNC_CHANNEL_NAME);
    resetChannel.postMessage({ type: PUBLIC_DEMO_RESET_MESSAGE });
    resetChannel.close();
  } catch {
    // Storage is already reset. A tab that misses this hint will load the
    // baseline the next time it refreshes.
  }
}
