/**
 * Migration runner: decides whether to migrate, does it, and only then marks
 * it done.
 *
 * The ordering here is the whole point. Write the new data, verify it read
 * back, and only then record completion. If any step fails, the legacy keys
 * are still exactly where they were, so the merchant can go back to the old
 * build with nothing lost.
 */

import { AppDataSchema, CURRENT_SCHEMA_VERSION } from '../app-schema';
import { Result, err, isErr, ok } from '../../domain/result';
import { AppDataRepository } from '../../storage/app-data-repository';
import { MIGRATION_STATE_KEY } from '../../storage/keys';
import { PRESERVED_LEGACY_PAYLOAD_KEY } from './legacy-keys';
import {
  LegacySource,
  MigrationReport,
  hasLegacyData,
  migrateLegacyData,
} from './migrate-legacy';

export interface MigrationState {
  completedAt: string;
  fromVersion: string;
  toSchemaVersion: number;
  report: MigrationReport;
}

export type MigrationOutcome =
  | { kind: 'not-needed'; data: AppDataSchema | null }
  | { kind: 'already-done'; data: AppDataSchema; state: MigrationState }
  | { kind: 'migrated'; data: AppDataSchema; report: MigrationReport };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMigrationReport(value: unknown): value is MigrationReport {
  if (!isRecord(value) || !Array.isArray(value.warnings)) return false;
  if (!value.warnings.every((warning) => typeof warning === 'string')) return false;

  const countKeys = [
    'ordersMigrated',
    'ordersSkippedDuplicate',
    'ordersSkippedInvalid',
    'menuItemsMigrated',
    'chargeRulesCreated',
  ] as const;

  return countKeys.every((key) => {
    const count = value[key];
    return typeof count === 'number' && Number.isInteger(count) && count >= 0;
  });
}

function isMigrationState(value: unknown): value is MigrationState {
  if (!isRecord(value)) return false;
  if (value.fromVersion !== 'golden_sea_laksa_v0') return false;
  if (value.toSchemaVersion !== CURRENT_SCHEMA_VERSION) return false;
  if (typeof value.completedAt !== 'string') return false;

  const completedAt = new Date(value.completedAt);
  if (Number.isNaN(completedAt.getTime()) || completedAt.toISOString() !== value.completedAt) {
    return false;
  }

  return isMigrationReport(value.report);
}

export function readMigrationState(repo: AppDataRepository): MigrationState | null {
  const raw = repo.readRaw(MIGRATION_STATE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isMigrationState(parsed) ? parsed : null;
  } catch {
    // A damaged marker must not be read as "already migrated" -- that would
    // silently skip a merchant's data. Treat it as not done and let the
    // orderUid de-duplication keep a second run safe.
    return null;
  }
}

export function runMigrationIfNeeded(
  repo: AppDataRepository,
  legacy: LegacySource,
  businessId: string
): Result<MigrationOutcome> {
  const existingRead = repo.load();
  if (isErr(existingRead)) return existingRead;
  const existing = existingRead.value;

  const state = readMigrationState(repo);
  if (
    state !== null &&
    existing !== null &&
    state.toSchemaVersion === existing.schemaVersion
  ) {
    return ok({ kind: 'already-done', data: existing, state });
  }

  if (!hasLegacyData(legacy)) {
    return ok({ kind: 'not-needed', data: existing });
  }

  const migration = migrateLegacyData(legacy, { businessId, existing });
  if (isErr(migration)) return migration;

  const { data, report, preservedPayload } = migration.value;

  // Preserve images and raw legacy options first. If this fails we stop, so we
  // never end up with migrated orders and a lost menu.
  const preserved = repo.writeRaw(PRESERVED_LEGACY_PAYLOAD_KEY, JSON.stringify(preservedPayload));
  if (isErr(preserved)) return preserved;

  // save() reads back what it wrote, so a success here means the data is
  // genuinely on the device.
  const saved = repo.save(data);
  if (isErr(saved)) return saved;

  const newState: MigrationState = {
    completedAt: new Date().toISOString(),
    fromVersion: 'golden_sea_laksa_v0',
    toSchemaVersion: data.schemaVersion,
    report,
  };

  const marked = repo.writeRaw(MIGRATION_STATE_KEY, JSON.stringify(newState));
  if (isErr(marked)) {
    // The data is safely stored; only the marker failed. Report it rather than
    // claiming success, but do not roll back -- a re-run de-duplicates anyway.
    return err(
      'MIGRATION_FAILED',
      'Your data was migrated and saved, but the completion marker could not be written. ' +
        'The migration will simply run again next time and will not duplicate anything.'
    );
  }

  return ok({ kind: 'migrated', data, report });
}
