/**
 * Minimal Result type so storage and migration failures are values, not thrown
 * exceptions that get swallowed by a `catch {}` somewhere up the tree.
 *
 * Phase 1A rule: nothing in the storage or migration layer may silently succeed.
 *
 * Narrow with the `isOk` / `isErr` predicates rather than `if (!r.ok)`. This
 * project does not run TypeScript in strict mode, and discriminant narrowing on
 * a boolean literal is unreliable without `strictNullChecks`; a type predicate
 * narrows correctly either way.
 */

export type AppErrorCode =
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'STORAGE_WRITE_FAILED'
  | 'PARSE_FAILED'
  | 'SCHEMA_INVALID'
  | 'MIGRATION_FAILED'
  | 'VERIFY_FAILED';

export interface AppError {
  code: AppErrorCode;
  message: string;
  /** Original thrown value, kept for logging. Never rendered to merchants. */
  cause?: unknown;
}

export interface OkResult<T> {
  ok: true;
  value: T;
}

export interface ErrResult {
  ok: false;
  error: AppError;
}

export type Result<T> = OkResult<T> | ErrResult;

export function ok<T>(value: T): OkResult<T> {
  return { ok: true, value };
}

/** Returns `ErrResult`, which is assignable to `Result<T>` for any T. */
export function err(code: AppErrorCode, message: string, cause?: unknown): ErrResult {
  return { ok: false, error: { code, message, cause } };
}

export function isOk<T>(result: Result<T>): result is OkResult<T> {
  return result.ok === true;
}

export function isErr<T>(result: Result<T>): result is ErrResult {
  return result.ok === false;
}

/** True when a thrown value looks like a browser storage quota rejection. */
export function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  // Chrome/Edge: QuotaExceededError. Firefox: NS_ERROR_DOM_QUOTA_REACHED.
  // Safari private mode historically threw code 22 with an empty name.
  const name = e.name;
  const code = (e as any).code;
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}
