import type {Language} from '../types';
import {tr} from '../i18n';

export const NATIVE_ORIGIN = 'https://appassets.androidplatform.net';
const CHUNK_BYTES = 96 * 1024;
export const MAX_NATIVE_FILE_BYTES = 256 * 1024 * 1024;
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const BACKUP_MIME = 'application/vnd.cjpos.backup+json';
export const MENU_MIME = 'application/vnd.cjpos.menu+json';
export const ORDER_MIME = 'application/vnd.cjpos.order+json';
export const MAX_MENU_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ORDER_FILE_BYTES = 256 * 1024;
// Kept as a conservative order limit for existing callers.
export const MAX_SHARED_FILE_BYTES = MAX_ORDER_FILE_BYTES;
type NativeBridge = {postMessage(message: string): void; onmessage: ((event: {data: string}) => void) | null};
interface NativeReply {id: string; ok: boolean; code?: string; error?: string; enabled?: boolean; folder?: string; key?: string; since?: string; uri?: string; exists?: boolean; sharesheetOpened?: boolean}
export interface FolderStatus {enabled: boolean; folder: string; key: string; since: string}
export class FileSaveError extends Error {
  constructor(public code: string, message = code) {super(message); this.name = 'FileSaveError';}
}
export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && window.location?.origin === NATIVE_ORIGIN;
}
const initialized = new WeakSet<NativeBridge>();
const pending = new Map<string, {resolve(value: NativeReply): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout>}>();
let sequence = 0;
function bridgeRequest(payload: Record<string, unknown>, timeout = 45_000): Promise<NativeReply> {
  const bridge = (window as unknown as {CJNative?: NativeBridge}).CJNative;
  if (!bridge) return Promise.reject(new FileSaveError('BRIDGE_UNAVAILABLE', 'Android WebView save channel is unavailable'));
  if (!initialized.has(bridge)) {
    const previous = bridge.onmessage;
    bridge.onmessage = event => {
      let reply: NativeReply;
      try {reply = JSON.parse(event.data);} catch {return;}
      const entry = pending.get(reply.id);
      if (!entry) {previous?.(event); return;}
      pending.delete(reply.id); clearTimeout(entry.timer);
      if (reply.ok) entry.resolve(reply);
      else entry.reject(new FileSaveError(reply.code || 'SAVE_FAILED', reply.error || reply.code));
    };
    initialized.add(bridge);
  }
  const id = 'cj-' + Date.now() + '-' + (++sequence);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {pending.delete(id); reject(new FileSaveError('TIMEOUT'));}, timeout);
    pending.set(id, {resolve, reject, timer});
    try {bridge.postMessage(JSON.stringify({...payload, id}));}
    catch (error) {pending.delete(id); clearTimeout(timer); reject(error);}
  });
}
export async function getExportFolder(language: Language = 'en'): Promise<FolderStatus> {
  if (!isNativeApp()) return {enabled: false, folder: '', key: '', since: ''};
  const reply = await bridgeRequest({type: 'folder-status', language});
  return {enabled: !!reply.enabled, folder: reply.folder || '', key: reply.key || '', since: reply.since || ''};
}
export async function chooseExportFolder(since: string, language: Language): Promise<FolderStatus> {
  const reply = await bridgeRequest({type: 'choose-folder', since, language}, 10 * 60_000);
  return {enabled: !!reply.enabled, folder: reply.folder || '', key: reply.key || '', since: reply.since || since};
}
export async function disableAutoExport(): Promise<void> {await bridgeRequest({type: 'disable-folder'});}
export async function reportFileExists(uri: string): Promise<boolean> {
  if (!uri || !isNativeApp()) return false;
  return !!(await bridgeRequest({type: 'report-exists', uri})).exists;
}
export interface SaveFileOptions {automatic?: boolean; day?: string; revision?: string}
export interface FileSaveResult {destination: 'native' | 'browser'; uri?: string}
export interface FileShareResult {sharesheetOpened: boolean; downloaded?: boolean; cancelled?: boolean}
export async function saveFile(blob: Blob, filename: string, mime: string, language: Language = 'en', options: SaveFileOptions = {}): Promise<FileSaveResult> {
  if ((mime === MENU_MIME && blob.size > MAX_MENU_FILE_BYTES) || (mime === ORDER_MIME && blob.size > MAX_ORDER_FILE_BYTES)) throw new FileSaveError('TOO_LARGE');
  if (!isNativeApp()) {
    if (options.automatic) throw new FileSaveError('NATIVE_ONLY');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return {destination: 'browser'};
  }
  return saveNativeFile(blob, filename, mime, language, options);
}
export async function saveNativeFile(blob: Blob, filename: string, mime: string, language: Language = 'en', options: SaveFileOptions = {}): Promise<FileSaveResult> {
  const reply = await transferNativeFile(blob, filename, mime, language, options);
  return {destination: 'native', uri: reply.uri};
}
async function transferNativeFile(blob: Blob, filename: string, mime: string, language: Language, options: SaveFileOptions, shareText?: string): Promise<NativeReply> {
  if (blob.size > MAX_NATIVE_FILE_BYTES) throw new FileSaveError('TOO_LARGE');
  if ((mime === MENU_MIME && blob.size > MAX_MENU_FILE_BYTES) || (mime === ORDER_MIME && blob.size > MAX_ORDER_FILE_BYTES)) throw new FileSaveError('TOO_LARGE');
  const transfer = 'file-' + Date.now() + '-' + (++sequence);
  await bridgeRequest({type: 'file-begin', transfer, filename, mime, size: blob.size, language, ...options,
    ...(shareText !== undefined ? {share: true, text: shareText} : {})});
  try {
    for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
      const bytes = new Uint8Array(await blob.slice(offset, offset + CHUNK_BYTES).arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      await bridgeRequest({type: 'file-chunk', transfer, offset, base64: btoa(binary)});
    }
    return await bridgeRequest({type: 'file-finish', transfer}, options.automatic || shareText !== undefined ? 60_000 : 10 * 60_000);
  } catch (error) {
    await bridgeRequest({type: 'file-abort', transfer}, 5000).catch(() => {});
    throw error;
  }
}
/** Call from a user's button press. Opening a share sheet does not mean delivery. */
export async function shareFile(blob: Blob, filename: string, mime: string, language: Language = 'en', text = ''): Promise<FileShareResult> {
  if (![MENU_MIME, ORDER_MIME].includes(mime)) throw new FileSaveError('INVALID_REQUEST');
  if ((mime === MENU_MIME && blob.size > MAX_MENU_FILE_BYTES) || (mime === ORDER_MIME && blob.size > MAX_ORDER_FILE_BYTES)) throw new FileSaveError('TOO_LARGE');
  if (text.length > 65_536) throw new FileSaveError('INVALID_REQUEST');
  if (isNativeApp()) {
    const reply = await transferNativeFile(blob, filename, mime, language, {}, text);
    return {sharesheetOpened: reply.sharesheetOpened === true};
  }
  // Keep the native share call before any await so browser user activation is retained.
  const file = new File([blob], filename, {type: mime});
  let canShare = false;
  try {canShare = typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare?.({files: [file]});}
  catch { /* Some embedded browsers reject unsupported file shares. */ }
  if (canShare) {
    try {
      await navigator.share({files: [file], ...(text ? {text} : {})});
      return {sharesheetOpened: true};
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return {sharesheetOpened: false, cancelled: true};
      // Unsupported formats and browsers still offer an explicit document download.
    }
  }
  await saveFile(blob, filename, mime, language);
  return {sharesheetOpened: false, downloaded: true};
}
export async function saveAndroidWorkbook(blob: Blob, filename: string): Promise<void> {
  await saveNativeFile(blob, filename, XLSX_MIME);
}
export function fileErrorMessage(error: unknown, language: Language): string {
  const code = error instanceof FileSaveError ? error.code : '';
  if (code === 'CANCELLED') return tr(language, 'Save cancelled. Your records are unchanged.', '已取消保存，订单资料仍保留。', 'Simpanan dibatalkan. Rekod anda kekal.');
  if (code === 'BRIDGE_UNAVAILABLE') return tr(language, 'Save channel unavailable. Update Android System WebView and reopen the app.', '保存通道不可用，请更新 Android System WebView 后重开 App。', 'Saluran simpanan tidak tersedia. Kemas kini Android System WebView dan buka semula app.');
  if (code === 'FOLDER_PERMISSION' || code === 'NO_FOLDER') return tr(language, 'Choose the automatic-save folder again. Records are waiting to be saved.', '请重新选择自动保存文件夹，报表仍在等待补存。', 'Pilih semula folder simpanan automatik. Laporan masih menunggu.');
  if (code === 'TOO_LARGE') return tr(language, 'This file exceeds 256 MB. Export a shorter period or reduce menu photo sizes.', '文件超过 256 MB，请缩短导出期间或缩小菜单照片。', 'Fail melebihi 256 MB. Eksport tempoh lebih pendek atau kecilkan foto menu.');
  if (code === 'BUSY') return tr(language, 'Another save is open. Finish it, then retry.', '另一个保存窗口尚未关闭，完成后请重试。', 'Simpanan lain sedang dibuka. Selesaikannya, kemudian cuba lagi.');
  if (code === 'TIMEOUT') return tr(language, 'Save did not finish. Check the selected folder and retry.', '保存未完成，请检查文件夹后重试。', 'Simpanan belum selesai. Semak folder dan cuba lagi.');
  return tr(language, 'Could not save. Check available space and the selected folder, then retry.', '保存失败，请检查可用空间和文件夹后重试。', 'Gagal menyimpan. Semak ruang dan folder, kemudian cuba lagi.');
}
