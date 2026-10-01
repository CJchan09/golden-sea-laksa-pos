import type { CartItem, CustomerContact, Language } from '../types';
import type { MenuPack, OrderRequest } from './protocol';

export interface GuestDraft { pack: MenuPack | null; cart: CartItem[]; customer: CustomerContact; language: Language; request: OrderRequest | null }
export const emptyGuestDraft = (): GuestDraft => ({ pack: null, cart: [], customer: { name: '', phone: '', address: '', note: '' }, language: 'en', request: null });
/** Separate database: this code never opens the merchant POS repository. */
export class GuestDraftRepository {
  private opening: Promise<IDBDatabase> | null = null;
  constructor(private key = 'guest') {}
  private open(): Promise<IDBDatabase> {
    return this.opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cjpos-guest-menu-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => { this.opening = null; reject(request.error); };
      request.onblocked = () => { this.opening = null; reject(new Error('Guest storage is blocked')); };
    }).catch(error => { this.opening = null; throw error; });
  }
  async read(): Promise<GuestDraft | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction('drafts', 'readonly').objectStore('drafts').get(this.key);
      request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error);
    });
  }
  async save(draft: GuestDraft): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('drafts', 'readwrite');
      transaction.objectStore('drafts').put(structuredClone(draft), this.key);
      transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error ?? new Error('Guest save failed'));
      transaction.onerror = () => reject(transaction.error);
    });
  }
}
