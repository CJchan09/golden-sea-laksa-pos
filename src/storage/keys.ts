/**
 * Storage namespace.
 *
 * Neutral product namespace, not the pilot restaurant's name. Legacy
 * `golden_sea_laksa_*` keys are read by the migration but never written again.
 * A Reset must only ever clear keys under this prefix.
 */

export const STORAGE_NAMESPACE = 'cjpos';

export const APP_DATA_KEY = `${STORAGE_NAMESPACE}.appData`;
export const MIGRATION_STATE_KEY = `${STORAGE_NAMESPACE}.migrationState`;
export const BACKUP_META_KEY = `${STORAGE_NAMESPACE}.backupMeta`;

/** Cross-tab channel. Same browser only -- not a cross-device transport. */
export const SYNC_CHANNEL_NAME = `${STORAGE_NAMESPACE}_sync`;

export function isProductKey(key: string): boolean {
  return key.startsWith(`${STORAGE_NAMESPACE}.`);
}
