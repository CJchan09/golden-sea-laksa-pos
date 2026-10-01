import type { Order, ShopSettings } from '../types';
import type { LegacySnapshot, PosRead, PosState } from './pos-idb';
import { materializeBackupPhotos, referencedPhotoKeys } from './pos-photos';
import { v4 as uuidv4 } from 'uuid';

export const CJPOS_BACKUP_VERSION = 1;
const BACKUP_KIND = 'cjpos.full-backup';
const MAX_BACKUP_BYTES = 150_000_000;
const MAX_PHOTO_BYTES = 20_000_000;

interface PhotoEntry {
  key: string;
  mimeType: string;
  base64: string;
}

export interface BackupDocument {
  kind: typeof BACKUP_KIND;
  version: typeof CJPOS_BACKUP_VERSION;
  createdAt: string;
  state: PosState;
  photos: PhotoEntry[];
  legacySnapshot: LegacySnapshot | null;
}

export interface BackupPreview {
  createdAt: string;
  orderCount: number;
  menuItemCount: number;
  shopName: string;
  photoCount: number;
  orderDateFrom: string | null;
  orderDateTo: string | null;
  /** Validated source for an atomic replacement; never merge into current data. */
  document: BackupDocument;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid CJ POS backup: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateCartItem(value: unknown): void {
  assert(isRecord(value), 'an order or cart line is invalid');
  assert(typeof value.id === 'string' && value.id.length > 0, 'line ID is invalid');
  assert(typeof value.menuItemId === 'string', 'line menu item is invalid');
  assert(typeof value.sizeId === 'string', 'line size is invalid');
  assert(Array.isArray(value.noodleBaseIds) && value.noodleBaseIds.every(id => typeof id === 'string'), 'line noodle selections are invalid');
  assert(Array.isArray(value.addOnIds) && value.addOnIds.every(id => typeof id === 'string'), 'line add-on selections are invalid');
  assert(Number.isSafeInteger(value.quantity) && (value.quantity as number) > 0, 'line quantity is invalid');
  assert(typeof value.unitPrice === 'number' && Number.isFinite(value.unitPrice), 'line unit price is invalid');
  assert(typeof value.totalPrice === 'number' && Number.isFinite(value.totalPrice), 'line total is invalid');
  assert(value.optionSelections === undefined || Array.isArray(value.optionSelections), 'line option snapshots are invalid');
  assert(value.addOnSelections === undefined || Array.isArray(value.addOnSelections), 'line add-on snapshots are invalid');
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x4000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x4000));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  assert(binary.length <= MAX_PHOTO_BYTES, 'a photo exceeds 20 MB');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function validateSettings(value: unknown): asserts value is ShopSettings {
  assert(isRecord(value), 'settings are missing');
  assert(value.shopId === undefined || (typeof value.shopId === 'string' && value.shopId.length > 0), 'shop ID is invalid');
  assert(value.whatsappNumber === undefined || typeof value.whatsappNumber === 'string', 'WhatsApp number is invalid');
  assert(typeof value.shopNameEn === 'string' && typeof value.shopNameZh === 'string', 'shop name is invalid');
  assert(typeof value.coverPhoto === 'string', 'cover photo reference is invalid');
  assert(value.qrImage === null || typeof value.qrImage === 'string', 'payment QR reference is invalid');
  assert(Array.isArray(value.menuItems), 'menu items are missing');
  const ids = new Set<string>();
  for (const item of value.menuItems) {
    assert(isRecord(item) && typeof item.id === 'string' && item.id.length > 0, 'menu item ID is invalid');
    assert(!ids.has(item.id), 'menu item IDs are duplicated');
    ids.add(item.id);
    assert(isRecord(item.name) && typeof item.name.en === 'string' && typeof item.name.zh === 'string', 'menu item name is invalid');
    assert(typeof item.basePrice === 'number' && Number.isFinite(item.basePrice), 'menu price is invalid');
    assert(typeof item.image === 'string', 'menu image reference is invalid');
    assert(Array.isArray(item.sizes) && Array.isArray(item.noodleBases) && Array.isArray(item.addOns), 'menu options are invalid');
    assert(item.optionGroups === undefined || Array.isArray(item.optionGroups), 'option groups are invalid');
  }
  assert(typeof value.enableTax === 'boolean' && Number.isFinite(value.taxRate), 'tax settings are invalid');
  assert(Number.isFinite(value.takeawayFee), 'takeaway fee is invalid');
  if (value.issuedMenus !== undefined) {
    assert(Array.isArray(value.issuedMenus), 'issued menus are invalid');
    const menuIds = new Set<string>();
    for (const issued of value.issuedMenus) {
      assert(isRecord(issued) && typeof issued.menuId === 'string' && issued.menuId.length > 0, 'issued menu ID is invalid');
      assert(!menuIds.has(issued.menuId), 'issued menu IDs are duplicated');
      menuIds.add(issued.menuId);
      assert(typeof issued.createdAt === 'string' && Number.isFinite(Date.parse(issued.createdAt)), 'issued menu date is invalid');
      validateSettings({ shopNameEn: '', shopNameZh: '', coverPhoto: '', qrImage: null,
        menuItems: issued.menuItems, enableTax: issued.enableTax, taxRate: issued.taxRate,
        takeawayFee: issued.takeawayFee });
      assert((issued.menuItems as ShopSettings['menuItems']).every(item => item.image === ''), 'issued menus must not contain photos');
    }
  }
}

function validateOrder(value: unknown): asserts value is Order {
  assert(isRecord(value), 'order is invalid');
  assert(typeof value.local_order_id === 'string' && value.local_order_id.length > 0, 'order ID is missing');
  assert(typeof value.order_id === 'string', 'display order number is invalid');
  assert(typeof value.timestamp === 'string' && value.timestamp.length > 0, 'order timestamp is invalid');
  assert(Array.isArray(value.items), 'order lines are invalid');
  for (const item of value.items) validateCartItem(item);
  assert(typeof value.total_amount === 'number' && Number.isFinite(value.total_amount), 'order total is invalid');
  assert(typeof value.paid === 'boolean', 'payment status is invalid');
  assert(value.paid_at === undefined || (typeof value.paid_at === 'string' && Number.isFinite(Date.parse(value.paid_at))), 'payment timestamp is invalid');
  assert(['Pending', 'Preparing', 'Completed', 'Cancelled'].includes(String(value.status)), 'order status is invalid');
  if (value.customer !== undefined) {
    assert(isRecord(value.customer), 'customer details are invalid');
    assert(typeof value.customer.name === 'string' && typeof value.customer.phone === 'string' && typeof value.customer.address === 'string', 'customer details are invalid');
    assert(value.customer.note === undefined || typeof value.customer.note === 'string', 'customer note is invalid');
  }
  for (const key of ['sourceRequestId', 'sourceFingerprint', 'sourceMenuId']) {
    assert(value[key] === undefined || (typeof value[key] === 'string' && value[key].length > 0), 'order source is invalid');
  }
}

export function validateBackupDocument(input: unknown): BackupDocument {
  assert(isRecord(input), 'file is not an object');
  assert(input.kind === BACKUP_KIND, 'file type is not .cjpos');
  assert(input.version === CJPOS_BACKUP_VERSION, 'backup version is unsupported');
  assert(typeof input.createdAt === 'string' && Number.isFinite(Date.parse(input.createdAt)), 'creation time is invalid');
  assert(isRecord(input.state), 'data is missing');
  const state = input.state;
  validateSettings(state.settings);
  assert(Array.isArray(state.orders), 'orders are missing');
  const ids = new Set<string>();
  for (const order of state.orders) {
    validateOrder(order);
    assert(!ids.has(order.local_order_id), 'order IDs are duplicated');
    ids.add(order.local_order_id);
  }
  assert(Array.isArray(state.cart), 'cart is invalid');
  for (const item of state.cart) validateCartItem(item);
  assert(['en', 'zh', 'ms'].includes(String(state.language)), 'language is invalid');
  assert(Number.isSafeInteger(state.revision) && (state.revision as number) >= 0, 'revision is invalid');
  assert(Array.isArray(input.photos), 'photos are missing');
  const photoKeys = new Set<string>();
  for (const photo of input.photos) {
    assert(isRecord(photo) && typeof photo.key === 'string' && photo.key.length > 0, 'photo key is invalid');
    assert(!photoKeys.has(photo.key), 'photo keys are duplicated');
    photoKeys.add(photo.key);
    assert(typeof photo.mimeType === 'string' && photo.mimeType.startsWith('image/'), 'photo type is invalid');
    assert(typeof photo.base64 === 'string' && photo.base64.length <= Math.ceil(MAX_PHOTO_BYTES * 4 / 3) + 8, 'photo data is invalid');
    try { base64ToBlob(photo.base64, photo.mimeType); }
    catch { throw new Error('Invalid CJ POS backup: a photo cannot be decoded'); }
  }
  for (const key of referencedPhotoKeys(state.settings)) {
    assert(photoKeys.has(key), `photo ${key} is missing`);
  }
  assert(input.legacySnapshot === null || (isRecord(input.legacySnapshot) && Object.values(input.legacySnapshot).every(value => value === null || typeof value === 'string')), 'legacy snapshot is invalid');
  return input as unknown as BackupDocument;
}

export async function createCjposBackup(read: PosRead): Promise<Blob> {
  const materialized = await materializeBackupPhotos(read.state.settings, read.photos);
  const keys = referencedPhotoKeys(materialized.settings);
  const entries: PhotoEntry[] = [];
  for (const key of keys) {
    const photo = materialized.photos.get(key);
    if (!photo) throw new Error(`Photo ${key} is missing from local storage.`);
    if (photo.size > MAX_PHOTO_BYTES) throw new Error('A photo exceeds the 20 MB backup limit.');
    entries.push({ key, mimeType: photo.type || 'image/png', base64: await blobToBase64(photo) });
  }
  const document: BackupDocument = {
    kind: BACKUP_KIND,
    version: CJPOS_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    state: { ...read.state, settings: materialized.settings },
    photos: entries,
    legacySnapshot: read.legacySnapshot,
  };
  validateBackupDocument(document);
  const blob = new Blob([JSON.stringify(document)], { type: 'application/x-cjpos+json' });
  if (blob.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 150 MB local limit.');
  return blob;
}

export async function previewCjposBackup(file: Blob): Promise<BackupPreview> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 150 MB local limit.');
  const document = validateBackupDocument(JSON.parse(await file.text()));
  const orderDates = document.state.orders.map(order => order.timestamp.slice(0, 10)).sort();
  return {
    createdAt: document.createdAt,
    orderCount: document.state.orders.length,
    menuItemCount: document.state.settings.menuItems.length,
    shopName: document.state.settings.shopNameEn || document.state.settings.shopNameZh || 'CJ POS',
    photoCount: document.photos.length,
    orderDateFrom: orderDates[0] ?? null,
    orderDateTo: orderDates.at(-1) ?? null,
    document,
  };
}

export function backupPreviewToRead(preview: BackupPreview, revision: number): PosRead {
  const document = validateBackupDocument(preview.document);
  const photos = new Map<string, Blob>();
  for (const photo of document.photos) photos.set(photo.key, base64ToBlob(photo.base64, photo.mimeType));
  const state = structuredClone(document.state);
  state.settings = { ...state.settings, shopId: state.settings.shopId || uuidv4() };
  return {
    state: { ...state, revision: Math.max(revision, document.state.revision) + 1 },
    photos,
    photoVersions: Object.fromEntries([...photos.keys()].map(key => [key, `${Date.now()}-${Math.random()}`])),
    legacySnapshot: document.legacySnapshot,
  };
}
