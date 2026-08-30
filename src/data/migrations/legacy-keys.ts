/**
 * Pre-v1 storage keys, from the Golden Sea Laksa build.
 *
 * These are READ ONLY. The migration never writes them and never deletes them:
 * keeping them intact is the rollback path if a merchant has to go back to an
 * older build.
 */

export const LEGACY_ORDERS_KEY = 'golden_sea_laksa_orders';
export const LEGACY_CART_KEY = 'golden_sea_laksa_cart';
export const LEGACY_LANG_KEY = 'golden_sea_laksa_lang';
export const LEGACY_SETTINGS_KEY = 'golden_sea_laksa_settings';
export const LEGACY_QR_IMAGE_KEY = 'golden_sea_laksa_qr_image';

export const ALL_LEGACY_KEYS = [
  LEGACY_ORDERS_KEY,
  LEGACY_CART_KEY,
  LEGACY_LANG_KEY,
  LEGACY_SETTINGS_KEY,
  LEGACY_QR_IMAGE_KEY,
] as const;

/**
 * Images and the raw legacy menu are parked here verbatim rather than being
 * forced into the v1 model. Phase 1B maps the menu into Option Groups and
 * Phase 3 moves images into IndexedDB; until then nothing is lost and nothing
 * is misrepresented as already migrated.
 */
export const PRESERVED_LEGACY_PAYLOAD_KEY = 'cjpos.legacyPayload';
