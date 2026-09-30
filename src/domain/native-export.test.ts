import {afterEach, describe, expect, it, vi} from 'vitest';
import {BACKUP_MIME, MAX_NATIVE_FILE_BYTES, NATIVE_ORIGIN, isNativeApp, reportFileExists, saveFile, saveNativeFile, XLSX_MIME} from './native-export';
afterEach(() => vi.unstubAllGlobals());
function setup(cancel = false) {
  const requests: any[] = [];
  const bridge: {onmessage: ((event: {data: string}) => void) | null; postMessage: ReturnType<typeof vi.fn>} = {
    onmessage: null,
    postMessage: vi.fn((raw: string) => {
      const request = JSON.parse(raw); requests.push(request);
      queueMicrotask(() => bridge.onmessage?.({data: JSON.stringify({id: request.id, ok: !(cancel && request.type === 'file-finish'), code: cancel && request.type === 'file-finish' ? 'CANCELLED' : undefined, uri: 'content://saved/file'})}));
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
