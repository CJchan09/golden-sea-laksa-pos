import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyGuestDraft, GuestDraftRepository } from './guest-db';

function controlledIdb() {
  const data = new Map<string, unknown>();
  const openings: any[] = [], transactions: any[] = [], reads: any[] = [];
  let transactionCreated: (value: any) => void;
  const nextTransaction = new Promise<any>(resolve => { transactionCreated = resolve; });
  const db = {
    createObjectStore: vi.fn(),
    transaction: vi.fn((store: string, mode: string) => {
      const tx: any = { store, mode, error: null, oncomplete: null, onabort: null, onerror: null };
      tx.objectStore = vi.fn(() => ({
        get: vi.fn((key: string) => {
          const request: any = { result: structuredClone(data.get(key)), error: null, onsuccess: null, onerror: null };
          reads.push(request); queueMicrotask(() => request.onsuccess?.()); return request;
        }),
        put: vi.fn((value: unknown, key: string) => { tx.pending = { value, key }; }),
      }));
      tx.commit = () => { if (tx.pending) data.set(tx.pending.key, structuredClone(tx.pending.value)); tx.oncomplete?.(); };
      transactions.push(tx); transactionCreated(tx); return tx;
    }),
  };
  const open = vi.fn((name: string, version: number) => {
    const request: any = { name, version, result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
    openings.push(request); return request;
  });
  vi.stubGlobal('indexedDB', { open });
  return { open, openings, transactions, reads, db, data, nextTransaction,
    ready: (index = 0) => { openings[index].onupgradeneeded?.(); openings[index].onsuccess?.(); } };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('isolated guest draft repository event contract', () => {
  it('creates independent empty drafts with all required contact fields', () => {
    const a = emptyGuestDraft(), b = emptyGuestDraft(); a.customer.name = 'Customer'; a.language = 'zh';
    expect(b).toEqual({ pack: null, cart: [], customer: { name: '', phone: '', address: '', note: '' }, language: 'en', request: null });
    expect(a.cart).not.toBe(b.cart);
  });

  it('opens only its separate guest database and reuses the connection', async () => {
    const idb = controlledIdb(), repo = new GuestDraftRepository();
    const first = repo.read(), second = repo.read(); idb.ready();
    expect(await first).toBeNull(); expect(await second).toBeNull();
    expect(idb.open).toHaveBeenCalledExactlyOnceWith('cjpos-guest-menu-v1', 1);
    expect(idb.db.createObjectStore).toHaveBeenCalledWith('drafts');
    expect(idb.db.transaction).toHaveBeenCalledWith('drafts', 'readonly');
  });

  it('resolves a save only on transaction completion and stores a detached copy', async () => {
    const idb = controlledIdb(), repo = new GuestDraftRepository(); const draft = emptyGuestDraft();
    draft.customer.name = '陈小明';
    const saved = vi.fn(); const pending = repo.save(draft).then(saved); idb.ready();
    const tx = await idb.nextTransaction;
    expect(saved).not.toHaveBeenCalled();
    expect(tx.mode).toBe('readwrite');
    draft.customer.name = 'Changed after put'; tx.commit(); await pending;
    expect(saved).toHaveBeenCalledOnce();
    expect((await repo.read())?.customer.name).toBe('陈小明');
  });

  it('keeps drafts isolated by key', async () => {
    const idb = controlledIdb(), a = new GuestDraftRepository('menu-a'), b = new GuestDraftRepository('menu-b');
    const draft = emptyGuestDraft(); draft.customer.name = 'A';
    const save = a.save(draft); idb.ready(); (await idb.nextTransaction).commit(); await save;
    const read = b.read(); idb.ready(1); expect(await read).toBeNull();
    expect((await a.read())?.customer.name).toBe('A');
  });

  it('persists the exact request ID and payload for a later resend', async () => {
    const idb = controlledIdb(), repo = new GuestDraftRepository(); const draft = emptyGuestDraft();
    draft.request = { kind: 'cjpos.order', version: 1, requestId: 'keep-this-request-id', shopId: 'shop-1', menuId: 'menu-1',
      createdAt: '2026-10-01T02:00:00.000Z', language: 'zh', orderType: 'Takeaway', quotedTotalSen: 300,
      customer: { name: '顾客', phone: '60123456789', address: '吉隆坡', note: '' },
      lines: [{ menuItemId: 'item-1', quantity: 1, selections: {} }] };
    const payload = structuredClone(draft.request);
    const save = repo.save(draft); idb.ready(); (await idb.nextTransaction).commit(); await save;
    expect((await repo.read())?.request).toEqual(payload);
    expect((await repo.read())?.request?.requestId).toBe('keep-this-request-id');
  });

  it.each(['onabort', 'onerror'] as const)('rejects %s without claiming the draft was saved', async event => {
    const idb = controlledIdb(), repo = new GuestDraftRepository();
    const saved = repo.save(emptyGuestDraft()); const failure = expect(saved).rejects.toThrow('quota');
    idb.ready(); const tx = await idb.nextTransaction;
    tx.error = new Error('quota'); tx[event](); await failure;
    expect(idb.data.size).toBe(0);
  });

  it('uses a clear fallback error when a save aborts without a database error', async () => {
    const idb = controlledIdb(), repo = new GuestDraftRepository();
    const saved = repo.save(emptyGuestDraft()); const failure = expect(saved).rejects.toThrow('Guest save failed');
    idb.ready(); (await idb.nextTransaction).onabort(); await failure;
  });

  it.each(['onerror', 'onblocked'] as const)('permits retry after opening fails through %s', async event => {
    const idb = controlledIdb(), repo = new GuestDraftRepository();
    const failed = repo.read(); const assertion = expect(failed).rejects.toThrow(event === 'onblocked' ? 'blocked' : 'denied');
    idb.openings[0].error = new Error('denied'); idb.openings[0][event](); await assertion;
    const retry = repo.read(); idb.ready(1); expect(await retry).toBeNull();
    expect(idb.open).toHaveBeenCalledTimes(2);
  });

  it('permits retry after indexedDB.open throws synchronously', async () => {
    const idb = controlledIdb(), repo = new GuestDraftRepository();
    idb.open.mockImplementationOnce(() => { throw new Error('storage temporarily unavailable'); });
    await expect(repo.read()).rejects.toThrow('storage temporarily unavailable');
    const retry = repo.read(); const result = expect(retry).resolves.toBeNull();
    if (idb.openings.length) idb.ready();
    await result;
    expect(idb.open).toHaveBeenCalledTimes(2);
  });
});
