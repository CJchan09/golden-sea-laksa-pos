import {afterEach, describe, expect, it, vi} from 'vitest';
import {BACKUP_MIME, MAX_NATIVE_FILE_BYTES, MAX_MENU_FILE_BYTES, MAX_ORDER_FILE_BYTES, MENU_MIME, ORDER_MIME, NATIVE_ORIGIN, isNativeApp, reportFileExists, saveFile, saveNativeFile, shareFile, XLSX_MIME} from './native-export';
afterEach(() => vi.unstubAllGlobals());
function setup(cancel = false) {
  const requests: any[] = [];
  const bridge: {onmessage: ((event: {data: string}) => void) | null; postMessage: ReturnType<typeof vi.fn>} = {
    onmessage: null,
    postMessage: vi.fn((raw: string) => {
      const request = JSON.parse(raw); requests.push(request);
      queueMicrotask(() => bridge.onmessage?.({data: JSON.stringify({id: request.id, ok: !(cancel && request.type === 'file-finish'), code: cancel && request.type === 'file-finish' ? 'CANCELLED' : undefined, uri: 'content://saved/file', sharesheetOpened: true})}));
    }),
  };
  vi.stubGlobal('window', {location: {origin: NATIVE_ORIGIN}, CJNative: bridge});
  return {requests, bridge};
}
describe('native file saving', () => {
  it('distinguishes browser preview from bundled Android origin at runtime', () => {
    vi.stubGlobal('window', {location: {origin: 'http://127.0.0.1:4187'}});
    expect(isNativeApp()).toBe(false);
    vi.stubGlobal('window', {location: {origin: NATIVE_ORIGIN}});
    expect(isNativeApp()).toBe(true);
    vi.stubGlobal('window', {location: {origin: NATIVE_ORIGIN + '.evil.example'}});
    expect(isNativeApp()).toBe(false);
  });
  it('uses browser download when the Android build is previewed in a browser', async () => {
    vi.stubGlobal('window', {location: {origin: 'http://localhost:4187'}});
    const link = {href: '', download: '', click: vi.fn(), remove: vi.fn()};
    vi.stubGlobal('document', {createElement: vi.fn(() => link), body: {appendChild: vi.fn()}});
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const timeout = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => 0 as any);
    expect(await saveFile(new Blob(['data']), 'test.xlsx', XLSX_MIME)).toEqual({destination: 'browser'});
    expect(link.download).toBe('test.xlsx');
    expect(link.click).toHaveBeenCalledOnce();
    create.mockRestore(); timeout.mockRestore();
  });
  it('refuses to claim a native save if the WebView channel is missing', async () => {
    vi.stubGlobal('window', {location: {origin: NATIVE_ORIGIN}});
    await expect(saveFile(new Blob(['a']), 'orders.xlsx', XLSX_MIME)).rejects.toMatchObject({code: 'BRIDGE_UNAVAILABLE'});
  });
  it('transfers large typed backups as ordered bounded chunks without changing bytes', async () => {
    const {requests} = setup();
    const bytes = new Uint8Array(220_000).map((_, index) => index % 251);
    await saveNativeFile(new Blob([bytes]), 'backup.cjpos', BACKUP_MIME, 'ms');
    expect(requests[0]).toMatchObject({type: 'file-begin', mime: BACKUP_MIME, filename: 'backup.cjpos', size: bytes.length, language: 'ms'});
    const chunks = requests.filter(request => request.type === 'file-chunk');
    expect(chunks).toHaveLength(3);
    expect(chunks.map(chunk => chunk.offset)).toEqual([0, 98_304, 196_608]);
    expect(Buffer.concat(chunks.map(chunk => Buffer.from(chunk.base64, 'base64')))).toEqual(Buffer.from(bytes));
    expect(requests.at(-1).type).toBe('file-finish');
  });
  it('reports cancellation and releases the transfer with an abort', async () => {
    const {requests} = setup(true);
    await expect(saveNativeFile(new Blob(['data']), 'orders.xlsx', XLSX_MIME)).rejects.toMatchObject({code: 'CANCELLED'});
    expect(requests.at(-1).type).toBe('file-abort');
  });
  it('rejects oversized files before opening a native transfer', async () => {
    const {bridge} = setup();
    await expect(saveNativeFile({size: MAX_NATIVE_FILE_BYTES + 1} as Blob, 'too-large.cjpos', BACKUP_MIME)).rejects.toMatchObject({code: 'TOO_LARGE'});
    expect(bridge.postMessage).not.toHaveBeenCalled();
  });
  it('probes saved reports before treating an unchanged daily report as present', async () => {
    const {requests} = setup();
    expect(await reportFileExists('content://saved/deleted-report')).toBe(false);
    expect(requests[0]).toMatchObject({type: 'report-exists', uri: 'content://saved/deleted-report'});
  });
});

describe('portable menu and order sharing', () => {
  it.each([['menu.cjmenu', MENU_MIME], ['order.cjorder', ORDER_MIME]])('saves %s with its exact MIME and bytes', async (filename, mime) => {
    const {requests} = setup();
    const bytes = '{"version":1}';
    await saveFile(new Blob([bytes]), filename, mime, 'zh');
    expect(requests[0]).toMatchObject({filename, mime, language: 'zh'});
    expect(Buffer.from(requests.find(request => request.type === 'file-chunk').base64, 'base64').toString()).toBe(bytes);
    expect(requests[0].share).toBeUndefined();
  });
  it('opens Android sharing through the bounded file bridge without claiming delivery', async () => {
    const {requests} = setup();
    expect(await shareFile(new Blob(['order']), 'order.cjorder', ORDER_MIME, 'ms', 'Order summary')).toEqual({sharesheetOpened: true});
    expect(requests[0]).toMatchObject({type: 'file-begin', share: true, text: 'Order summary', mime: ORDER_MIME});
    expect(requests.at(-1).type).toBe('file-finish');
  });
  it.each([[MENU_MIME, MAX_MENU_FILE_BYTES], [ORDER_MIME, MAX_ORDER_FILE_BYTES]])('rejects files above the %s limit before opening a native operation', async (mime, maxBytes) => {
    const {bridge} = setup();
    const oversized = {size: Number(maxBytes) + 1} as Blob;
    await expect(shareFile(oversized, 'portable-file', String(mime))).rejects.toMatchObject({code: 'TOO_LARGE'});
    await expect(saveFile(oversized, 'portable-file', String(mime))).rejects.toMatchObject({code: 'TOO_LARGE'});
    expect(bridge.postMessage).not.toHaveBeenCalled();
  });
  it('supports photo menu files above 256 KB without raising the order limit', async () => {
    const {requests} = setup();
    const bytes = new Uint8Array(MAX_ORDER_FILE_BYTES + 1);
    expect(await shareFile(new Blob([bytes]), 'photos.cjmenu', MENU_MIME)).toEqual({sharesheetOpened: true});
    expect(requests[0]).toMatchObject({mime: MENU_MIME, size: bytes.length});
    await expect(shareFile(new Blob([bytes]), 'large.cjorder', ORDER_MIME)).rejects.toMatchObject({code: 'TOO_LARGE'});
  });
  it('accepts the exact 10 MB menu boundary and the exact 256 KB order boundary', async () => {
    const {requests} = setup();
    await saveFile(new Blob([new Uint8Array(MAX_MENU_FILE_BYTES)]), 'photos.cjmenu', MENU_MIME);
    await saveFile(new Blob([new Uint8Array(MAX_ORDER_FILE_BYTES)]), 'order.cjorder', ORDER_MIME);
    expect(requests.filter(request => request.type === 'file-begin').map(request => request.size)).toEqual([MAX_MENU_FILE_BYTES, MAX_ORDER_FILE_BYTES]);
  });
  it('refuses arbitrary share MIME types and oversized text', async () => {
    const {bridge} = setup();
    await expect(shareFile(new Blob(['x']), 'payload.html', 'text/html')).rejects.toMatchObject({code: 'INVALID_REQUEST'});
    await expect(shareFile(new Blob(['x']), 'menu.cjmenu', MENU_MIME, 'en', 'x'.repeat(65_537))).rejects.toMatchObject({code: 'INVALID_REQUEST'});
    expect(bridge.postMessage).not.toHaveBeenCalled();
  });
  it('shares a browser File only when the platform supports that exact file', async () => {
    vi.stubGlobal('window', {location: {origin: 'https://pos.cj-chan.work'}});
    const share = vi.fn(async (_data: ShareData) => {});
    const canShare = vi.fn((_data: ShareData) => true);
    vi.stubGlobal('navigator', {share, canShare});
    expect(await shareFile(new Blob(['menu']), 'menu.cjmenu', MENU_MIME, 'en', 'Menu')).toEqual({sharesheetOpened: true});
    expect(canShare.mock.calls[0][0].files[0].name).toBe('menu.cjmenu');
    expect(share.mock.calls[0][0]).toMatchObject({text: 'Menu'});
  });
  it('does not download a second copy after the user cancels sharing', async () => {
    vi.stubGlobal('window', {location: {origin: 'https://pos.cj-chan.work'}});
    vi.stubGlobal('navigator', {canShare: () => true, share: vi.fn(async () => {throw new DOMException('Cancelled', 'AbortError');})});
    const createElement = vi.fn();
    vi.stubGlobal('document', {createElement});
    expect(await shareFile(new Blob(['menu']), 'menu.cjmenu', MENU_MIME)).toEqual({sharesheetOpened: false, cancelled: true});
    expect(createElement).not.toHaveBeenCalled();
  });
  it.each([false, 'throws'])('falls back to document download when file sharing is unsupported (%s)', async supported => {
    vi.stubGlobal('window', {location: {origin: 'http://192.168.0.180:4191'}});
    vi.stubGlobal('navigator', {share: vi.fn(), canShare: () => {if (supported === 'throws') throw new TypeError('unsupported'); return false;}});
    const link = {href: '', download: '', click: vi.fn(), remove: vi.fn()};
    vi.stubGlobal('document', {createElement: vi.fn(() => link), body: {appendChild: vi.fn()}});
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const timeout = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => 0 as any);
    expect(await shareFile(new Blob(['menu']), 'menu.cjmenu', MENU_MIME)).toEqual({sharesheetOpened: false, downloaded: true});
    expect(link.download).toBe('menu.cjmenu');
    expect(link.click).toHaveBeenCalledOnce();
    create.mockRestore(); timeout.mockRestore();
  });
});
