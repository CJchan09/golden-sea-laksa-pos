import { v4 as uuidv4 } from 'uuid';
import type { ShopSettings } from '../types';
import { MENU_MAX_BYTES, normalizeWhatsAppNumber, parseMenuPack, SharingError, type MenuPack } from './protocol';

/** Compression only reads originals. Missing photos fail the whole export. */
export async function compressedPhoto(source: string): Promise<string> {
  if (!source) return '';
  const response = await fetch(source);
  if (!response.ok) throw new SharingError('PHOTO_UNAVAILABLE');
  const blob = await response.blob();
  if (blob.size > 20_000_000 || (blob.type && !blob.type.startsWith('image/'))) throw new SharingError('INVALID_PHOTO');
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(); img.src = url;
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new SharingError('INVALID_PHOTO')); });
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 60_000_000) throw new SharingError('INVALID_PHOTO');
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new SharingError('INVALID_PHOTO');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}
export function menuPackFile(pack: MenuPack): Blob {
  const file = new Blob([JSON.stringify(parseMenuPack(pack))], { type: 'application/vnd.cjpos.menu+json' });
  if (file.size > MENU_MAX_BYTES) throw new SharingError('MENU_TOO_LARGE'); return file;
}
export async function createMenuPack(input: ShopSettings, whatsappNumber: string): Promise<MenuPack> {
  if (!input.shopId) throw new SharingError('NO_SHOP_ID');
  const settings = structuredClone(input), cache = new Map<string, string>();
  const read = async (source: string) => {
    if (cache.has(source)) return cache.get(source)!;
    const photo = await compressedPhoto(source); cache.set(source, photo); return photo;
  };
  const coverPhoto = await read(settings.coverPhoto);
  const menuItems = [];
  for (const item of settings.menuItems) menuItems.push({ ...item, image: await read(item.image) });
  const pack = parseMenuPack({ kind: 'cjpos.menu', version: 1, shopId: settings.shopId, menuId: uuidv4(), createdAt: new Date().toISOString(),
    whatsappNumber: normalizeWhatsAppNumber(whatsappNumber), settings: { shopNameEn: settings.shopNameEn, shopNameZh: settings.shopNameZh,
      shopNameMs: settings.shopNameMs ?? '', coverPhoto, menuItems, enableTax: settings.enableTax, taxRate: settings.taxRate, takeawayFee: settings.takeawayFee } });
  menuPackFile(pack); return pack;
}
