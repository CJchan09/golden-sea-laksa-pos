import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShopSettings } from '../types';
import { compressedPhoto, createMenuPack, menuPackFile } from './menu-pack';
import { MENU_MAX_BYTES, readMenuFile, type MenuPack } from './protocol';

function settings(): ShopSettings {
  return { shopId: 'shop-1', shopNameEn: 'My shop', shopNameZh: '我的店', shopNameMs: 'Kedai saya',
    coverPhoto: '', qrImage: 'private-bank-qr', enableTax: true, taxRate: 6, takeawayFee: 0.5,
    menuItems: [{ id: 'item-1', name: { en: 'Kuih', zh: '糕点' }, basePrice: 2.5,
      image: '', sizes: [], noodleBases: [], addOns: [], optionGroups: [] }], issuedMenus: [] };
}

describe('menu pack photo export', () => {
  let dimensions: { width: number; height: number; fails: boolean };
  let canvas: { width: number; height: number; getContext: ReturnType<typeof vi.fn>; toDataURL: ReturnType<typeof vi.fn> };
  let fetchMock: ReturnType<typeof vi.fn>;
  let revoke: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dimensions = { width: 2560, height: 1280, fails: false };
    canvas = { width: 0, height: 0, getContext: vi.fn(() => ({ fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() })),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,AQID') };
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
    // Control browser decoding events, without pretending this is a real image decoder.
    vi.stubGlobal('Image', class {
      onload?: () => void; onerror?: () => void;
      naturalWidth = dimensions.width; naturalHeight = dimensions.height;
      set src(_value: string) { queueMicrotask(() => dimensions.fails ? this.onerror?.() : this.onload?.()); }
    });
    fetchMock = vi.fn(async () => new Response(new Blob(['photo'], { type: 'image/png' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:temporary-photo');
    revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('leaves an empty source empty without a network request', async () => {
    expect(await compressedPhoto('')).toBe(''); expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves aspect ratio within 1280 pixels and releases the temporary URL', async () => {
    expect(await compressedPhoto('blob:original')).toBe('data:image/jpeg;base64,AQID');
    expect(canvas).toMatchObject({ width: 1280, height: 640 });
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    expect(revoke).toHaveBeenCalledWith('blob:temporary-photo');
    expect(revoke).not.toHaveBeenCalledWith('blob:original');
  });

  it('does not upscale a small original', async () => {
    dimensions = { width: 320, height: 640, fails: false };
    await compressedPhoto('photo.png'); expect(canvas).toMatchObject({ width: 320, height: 640 });
  });

  it('fails the export when a photo cannot be fetched', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    await expect(compressedPhoto('missing.png')).rejects.toThrow('PHOTO_UNAVAILABLE');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it.each([
    ['large photo', new Blob([new Uint8Array(20_000_001)], { type: 'image/png' })],
    ['non-image file', new Blob(['<html>'], { type: 'text/html' })],
  ])('rejects %s before decoding', async (_label, blob) => {
    fetchMock.mockResolvedValue(new Response(blob));
    await expect(compressedPhoto('photo')).rejects.toThrow('INVALID_PHOTO');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it.each([
    { width: 0, height: 200, fails: false },
    { width: 10000, height: 6001, fails: false },
    { width: 100, height: 100, fails: true },
  ])('rejects invalid decoded photo %j and releases the URL', async value => {
    dimensions = value;
    await expect(compressedPhoto('photo')).rejects.toThrow('INVALID_PHOTO');
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:temporary-photo');
  });

  it('cleans up when the canvas cannot create a 2D context', async () => {
    canvas.getContext.mockReturnValue(null);
    await expect(compressedPhoto('photo')).rejects.toThrow('INVALID_PHOTO');
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:temporary-photo');
  });

  it('exports public fields and compressed copies, reusing duplicate sources without mutating originals', async () => {
    const input = settings(); input.coverPhoto = 'blob:original'; input.menuItems[0].image = 'blob:original';
    const before = structuredClone(input);
    const pack = await createMenuPack(input, '+60 (12) 345-6789');
    expect(input).toEqual(before);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('blob:original');
    expect(pack).toMatchObject({ kind: 'cjpos.menu', version: 1, shopId: input.shopId, whatsappNumber: '60123456789' });
    expect(pack.settings.coverPhoto).toBe('data:image/jpeg;base64,AQID');
    expect(pack.settings.menuItems[0].image).toBe('data:image/jpeg;base64,AQID');
    expect(pack.settings).not.toHaveProperty('qrImage');
    expect(pack.settings).not.toHaveProperty('issuedMenus');
    expect(pack.menuId).toMatch(/^[a-f0-9-]{36}$/);
  });

  it('requires a stable merchant ID', async () => {
    const input = settings(); delete input.shopId;
    await expect(createMenuPack(input, '60123456789')).rejects.toThrow('NO_SHOP_ID');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never returns a partial menu if any photo fails', async () => {
    const input = settings(); input.menuItems[0].image = 'missing.jpg';
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    await expect(createMenuPack(input, '60123456789')).rejects.toThrow('PHOTO_UNAVAILABLE');
    expect(input.menuItems[0].image).toBe('missing.jpg');
  });

  it('writes a typed file that the menu importer can read', async () => {
    const pack = await createMenuPack(settings(), '60123456789'); const file = menuPackFile(pack);
    expect(file.type).toBe('application/vnd.cjpos.menu+json');
    expect(await readMenuFile(file)).toEqual(pack);
  });

  it('rejects an aggregate menu file over 10 MiB even when individual fields are within bounds', () => {
    const largePhoto = 'data:image/jpeg;base64,' + 'A'.repeat(Math.ceil(MENU_MAX_BYTES / 2));
    const p: MenuPack = { kind: 'cjpos.menu', version: 1, shopId: 'shop-1', menuId: 'menu-1',
      createdAt: '2026-10-01T00:00:00Z', whatsappNumber: '60123456789', settings: { ...settings(), coverPhoto: largePhoto } };
    p.settings.menuItems[0].image = largePhoto;
    expect(() => menuPackFile(p)).toThrow('MENU_TOO_LARGE');
  });
});
