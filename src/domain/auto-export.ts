import type {Language, Order, ShopSettings} from '../types';
import {getExportFolder, isNativeApp, reportFileExists, saveFile, XLSX_MIME, type FolderStatus} from './native-export';
import {buildOrderWorkbookSheets, createOrderWorkbookBlob} from './export-orders-xlsx';
import {receiptDate, reportingDate} from './reporting';

export const AUTO_EXPORT_EVENT = 'cjpos-auto-export-change';
export interface AutoExportStatus {state: 'disabled' | 'idle' | 'saving' | 'error'; lastSavedAt?: string; pending: number; error?: unknown; folder?: FolderStatus}
let status: AutoExportStatus = {state: 'disabled', pending: 0};
const listeners = new Set<() => void>();
export const getAutoExportStatus = () => status;
export function subscribeAutoExport(listener: () => void): () => void {listeners.add(listener); return () => {listeners.delete(listener);};}
function update(next: Partial<AutoExportStatus>): void {status = {...status, ...next}; listeners.forEach(listener => listener());}

interface ExportRecord {key: string; fingerprint: string; savedAt: string; uri: string}
let database: Promise<IDBDatabase> | undefined;
function openMetadata(): Promise<IDBDatabase> {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('cjpos-reports-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('exports', {keyPath: 'key'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {database = undefined; reject(request.error);};
  });
  return database;
}
async function readRecord(key: string): Promise<ExportRecord | undefined> {
  const db = await openMetadata();
  return new Promise((resolve, reject) => {const request = db.transaction('exports').objectStore('exports').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);});
}
async function writeRecord(record: ExportRecord): Promise<void> {
  const db = await openMetadata();
  await new Promise<void>((resolve, reject) => {const transaction = db.transaction('exports', 'readwrite'); transaction.objectStore('exports').put(record); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);});
}
export function reportDays(orders: Order[], since: string, today: string): Map<string, Order[]> {
  const grouped = new Map<string, Map<string, Order>>();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || since > today) return new Map();
  const cursor = new Date(since + 'T00:00:00Z');
  if (!Number.isFinite(cursor.getTime())) return new Map();
  for (let day = since; day <= today; cursor.setUTCDate(cursor.getUTCDate() + 1), day = cursor.toISOString().slice(0, 10)) grouped.set(day, new Map());
  for (const order of orders) for (const date of new Set([reportingDate(order.timestamp), receiptDate(order)])) grouped.get(date)?.set(order.local_order_id, order);
  return new Map([...grouped].map(([day, byId]) => [day, [...byId.values()]]));
}
export async function reportFingerprint(orders: Order[], settings: ShopSettings, day: string, language: Language): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(buildOrderWorkbookSheets(orders, settings, {from: day, to: day}, language)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}
let running = false;
const foreground = () => document.visibilityState !== 'hidden';
export async function runAutomaticExport(orders: Order[], settings: ShopSettings, language: Language): Promise<void> {
  if (!isNativeApp() || running || !foreground()) return;
  running = true;
  try {
    const folder = await getExportFolder(language);
    if (!folder.enabled) {update({state: 'disabled', pending: 0, error: undefined, folder}); return;}
    update({folder, error: undefined});
    const candidates: {day: string; orders: Order[]; fingerprint: string; key: string}[] = [];
    let latest = status.lastSavedAt;
    for (const [day, dayOrders] of reportDays(orders, folder.since, reportingDate())) {
      const key = folder.key + ':' + day;
      const fingerprint = await reportFingerprint(dayOrders, settings, day, language);
      const previous = await readRecord(key);
      if (!previous || previous.fingerprint !== fingerprint || !(await reportFileExists(previous.uri))) candidates.push({day, orders: dayOrders, fingerprint, key});
      if (previous && (!latest || previous.savedAt > latest)) latest = previous.savedAt;
    }
    update({state: candidates.length ? 'saving' : 'idle', pending: candidates.length, lastSavedAt: latest});
    for (const candidate of candidates) {
      if (!foreground()) {update({state: 'idle'}); break;}
      const currentFolder = await getExportFolder(language);
      if (!currentFolder.enabled || currentFolder.key !== folder.key) {
        update({state: currentFolder.enabled ? 'idle' : 'disabled', folder: currentFolder});
        return;
      }
      const blob = await createOrderWorkbookBlob(candidate.orders, settings, {from: candidate.day, to: candidate.day}, language);
      const saved = await saveFile(blob, 'CJ-POS-' + candidate.day + '.xlsx', XLSX_MIME, language, {automatic: true, day: candidate.day, revision: candidate.fingerprint});
      const savedAt = new Date().toISOString();
      await writeRecord({key: candidate.key, fingerprint: candidate.fingerprint, savedAt, uri: saved.uri || ''});
      update({lastSavedAt: savedAt, pending: Math.max(0, status.pending - 1)});
    }
    update({state: 'idle'});
  } catch (error) {update({state: 'error', error});}
  finally {running = false;}
}
