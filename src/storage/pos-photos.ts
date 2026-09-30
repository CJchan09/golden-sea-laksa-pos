import type { ShopSettings } from '../types';

export const PHOTO_REF_PREFIX = 'cjpos-photo:';
const MAX_PHOTO_BYTES = 20_000_000;

export function photoKeyFromRef(value: string): string | null {
  return value.startsWith(PHOTO_REF_PREFIX) ? value.slice(PHOTO_REF_PREFIX.length) : null;
}

function eachImage(settings: ShopSettings, visit: (source: string, key: string, assign: (value: string) => void) => void): void {
  visit(settings.coverPhoto, 'cover', value => { settings.coverPhoto = value; });
  if (settings.qrImage) visit(settings.qrImage, 'qr', value => { settings.qrImage = value; });
  for (const item of settings.menuItems) {
    if (item.image) visit(item.image, `menu:${item.id}`, value => { item.image = value; });
  }
}

async function imageBlob(source: string): Promise<Blob> {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Could not read an image for the local backup (${response.status}).`);
  const blob = await response.blob();
  if (blob.size > MAX_PHOTO_BYTES) throw new Error('A photo is larger than the 20 MB local limit.');
  if (blob.type && !blob.type.startsWith('image/')) throw new Error('A selected photo is not an image.');
  return blob;
}

export class PhotoUrlRegistry {
  private urls = new Map<string, { url: string; version: string }>();
  private allUrls = new Set<string>();
  private references = new Map<string, string>();

  sourceReference(url: string): string | null {
    return this.references.get(url) ?? null;
  }

  hydrate(settings: ShopSettings, photos: Map<string, Blob>, versions: Record<string, string>): ShopSettings {
    const copy = structuredClone(settings);
    eachImage(copy, (source, _key, assign) => {
      const photoKey = photoKeyFromRef(source);
      if (!photoKey) return;
      const blob = photos.get(photoKey);
      if (!blob) throw new Error(`Stored photo ${photoKey} is missing.`);
      const version = versions[photoKey] ?? `${blob.size}:${blob.type}`;
      const cached = this.urls.get(photoKey);
      if (cached?.version === version) {
        assign(cached.url);
        return;
      }
      if (cached) this.references.delete(cached.url);
      const url = URL.createObjectURL(blob);
      this.urls.set(photoKey, { url, version });
      this.allUrls.add(url);
      this.references.set(url, source);
      assign(url);
    });
    return copy;
  }

  revokeAll(): void {
    for (const url of this.allUrls) URL.revokeObjectURL(url);
    this.urls.clear();
    this.allUrls.clear();
    this.references.clear();
  }
}

/** Convert all available images to Blob records before a settings transaction. */
export async function prepareSettingsPhotos(
  input: ShopSettings,
  registry: PhotoUrlRegistry | null,
  existingPhotos: Map<string, Blob>,
  strict = true,
): Promise<{ settings: ShopSettings; photos: Map<string, Blob> }> {
  const settings = structuredClone(input);
  const photos = new Map<string, Blob>();
  const jobs: Promise<void>[] = [];
  eachImage(settings, (source, key, assign) => {
    if (!source) return;
    const known = photoKeyFromRef(source) ? source : registry?.sourceReference(source);
    if (known) {
      const storedKey = photoKeyFromRef(known)!;
      if (!existingPhotos.has(storedKey)) throw new Error(`Stored photo ${storedKey} is missing.`);
      assign(known);
      return;
    }
    jobs.push((async () => {
      try {
        const blob = await imageBlob(source);
        photos.set(key, blob);
        assign(`${PHOTO_REF_PREFIX}${key}`);
      } catch (error) {
        if (strict || source.startsWith('data:') || source.startsWith('blob:')) throw error;
        // Old remote images may be offline during first migration. Preserve
        // their original URL; backup export later requires the actual bytes.
      }
    })());
  });
  await Promise.all(jobs);
  return { settings, photos };
}

/** Include every referenced photo; external URLs are fetched or export fails. */
export async function materializeBackupPhotos(
  input: ShopSettings,
  existingPhotos: Map<string, Blob>,
): Promise<{ settings: ShopSettings; photos: Map<string, Blob> }> {
  const settings = structuredClone(input);
  const photos = new Map(existingPhotos);
  const converted = await prepareSettingsPhotos(settings, null, photos, true);
  for (const [key, value] of converted.photos) photos.set(key, value);
  return { settings: converted.settings, photos };
}

export function referencedPhotoKeys(settings: ShopSettings): Set<string> {
  const keys = new Set<string>();
  const copy = structuredClone(settings);
  eachImage(copy, source => {
    const key = photoKeyFromRef(source);
    if (key) keys.add(key);
  });
  return keys;
}
