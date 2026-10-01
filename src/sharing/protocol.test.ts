import { describe, expect, it } from 'vitest';
import type { ShopSettings } from '../types';
import { calculateOrderAmounts } from '../domain/order-amounts';
import {
  MENU_MAX_BYTES, ORDER_MAX_BYTES, RECEIPT_LINK_MAX, RECEIPT_URL, SharingError,
  makeIssuedRecord, normalizeWhatsAppNumber, parseMenuPack, parseOrderRequest,
  readMenuFile, readOrderFile, rebuildRequestCart, receiptLink, requestFile,
  requestFingerprint, requestFromCart, requestFromLink, requestMenuRevision, type MenuPack, type OrderRequest,
} from './protocol';

function menu(): MenuPack {
  return {
    kind: 'cjpos.menu', version: 1, shopId: 'shop-1', menuId: 'menu-1',
    createdAt: '2026-10-01T01:00:00.000Z', whatsappNumber: '60123456789',
    settings: {
      shopNameEn: 'Kuih shop', shopNameZh: '糕点店', shopNameMs: 'Kedai kuih', coverPhoto: '',
      enableTax: true, taxRate: 6, takeawayFee: 0.5,
      menuItems: [{ id: 'kuih', name: { en: 'Kuih', zh: '糕点', ms: 'Kuih' }, basePrice: 8,
        image: '', sizes: [], noodleBases: [], addOns: [], optionGroups: [
          { id: 'size', names: { en: 'Size', zh: '份量' }, required: true, minSelect: 1, maxSelect: 1, sortOrder: 0,
            choices: [{ id: 'large', names: { en: 'Large', zh: '大份' }, priceDeltaSen: 100, enabled: true, sortOrder: 0 }] },
          { id: 'extras', names: { en: 'Extras', zh: '加料' }, required: false, minSelect: 0, maxSelect: 2, sortOrder: 1,
            choices: [
              { id: 'coconut', names: { en: 'Coconut', zh: '椰丝' }, priceDeltaSen: 75, enabled: true, sortOrder: 0 },
              { id: 'syrup', names: { en: 'Syrup', zh: '糖浆' }, priceDeltaSen: 25, enabled: true, sortOrder: 1 },
            ] },
        ] }],
    },
  };
}

function request(): OrderRequest {
  return { kind: 'cjpos.order', version: 1, requestId: 'request-1', shopId: 'shop-1', menuId: 'menu-1',
    createdAt: '2026-10-01T02:00:00.000Z', language: 'zh', orderType: 'Takeaway', quotedTotalSen: 2120,
    customer: { name: '陈小明', phone: '+60 12-345 6789', address: '吉隆坡，糕点街 8 号', note: '少甜，谢谢！' },
    lines: [{ menuItemId: 'kuih', quantity: 2, selections: { size: ['large'], extras: ['coconut'] } }] };
}

function errorCode(action: () => unknown, code = 'INVALID_FILE') {
  expect(action).toThrowError(SharingError);
  expect(action).toThrowError(code);
}

describe('shared menu schema', () => {
  it('round trips three languages and strips unrelated merchant data', () => {
    const input = { ...menu(), secret: 'not shared', settings: { ...menu().settings, qrImage: 'private', issuedMenus: [] } };
    const parsed = parseMenuPack(input);
    expect(parsed.settings.menuItems[0].name).toEqual({ en: 'Kuih', zh: '糕点', ms: 'Kuih' });
    expect(parsed).not.toHaveProperty('secret');
    expect(parsed.settings).not.toHaveProperty('qrImage');
    expect(parsed.settings).not.toHaveProperty('issuedMenus');
  });

  it.each([null, [], 'text', 1, {}, { kind: 'cjpos.menu', version: 2, settings: {} }])('rejects invalid container %j', input => {
    errorCode(() => parseMenuPack(input));
  });

  it.each([
    ['wrong kind', (p: MenuPack) => { (p as any).kind = 'cjpos.order'; }],
    ['unknown version', (p: MenuPack) => { (p as any).version = 2; }],
    ['blank shop ID', (p: MenuPack) => { p.shopId = ' '; }],
    ['long menu ID', (p: MenuPack) => { p.menuId = 'x'.repeat(121); }],
    ['invalid date', (p: MenuPack) => { p.createdAt = 'yesterday'; }],
    ['invalid tax flag', (p: MenuPack) => { (p.settings as any).enableTax = 'true'; }],
    ['tax above 100', (p: MenuPack) => { p.settings.taxRate = 101; }],
    ['negative fee', (p: MenuPack) => { p.settings.takeawayFee = -1; }],
    ['non-finite price', (p: MenuPack) => { p.settings.menuItems[0].basePrice = Infinity; }],
    ['blank item names', (p: MenuPack) => { p.settings.menuItems[0].name = { en: ' ', zh: '' }; }],
    ['control characters', (p: MenuPack) => { p.settings.shopNameEn = 'shop\u0000'; }],
    ['duplicate items', (p: MenuPack) => { p.settings.menuItems.push(structuredClone(p.settings.menuItems[0])); }],
    ['duplicate groups', (p: MenuPack) => { p.settings.menuItems[0].optionGroups!.push(structuredClone(p.settings.menuItems[0].optionGroups![0])); }],
    ['duplicate choices', (p: MenuPack) => { const g = p.settings.menuItems[0].optionGroups![0]; g.choices.push(structuredClone(g.choices[0])); }],
    ['fractional sen', (p: MenuPack) => { p.settings.menuItems[0].optionGroups![0].choices[0].priceDeltaSen = 0.5; }],
    ['invalid minimum', (p: MenuPack) => { p.settings.menuItems[0].optionGroups![0].minSelect = 2; }],
    ['required group with zero maximum', (p: MenuPack) => { const g = p.settings.menuItems[0].optionGroups![0]; g.minSelect = 0; g.maxSelect = 0; }],
  ])('rejects %s', (_label, mutate) => {
    const p = menu(); mutate(p); errorCode(() => parseMenuPack(p));
  });

  it('enforces item, option group, choice and legacy variation limits', () => {
    const p = menu();
    p.settings.menuItems = Array.from({ length: 301 }, (_, i) => ({ ...p.settings.menuItems[0], id: `item-${i}` }));
    errorCode(() => parseMenuPack(p));
    for (const field of ['sizes', 'noodleBases', 'addOns'] as const) {
      const pack = menu(); pack.settings.menuItems[0][field] = Array.from({ length: 101 }, (_, i) => ({ id: `${i}`, name: { en: 'size', zh: '' }, price: 0 }));
      errorCode(() => parseMenuPack(pack));
    }
    const groupPack = menu(); const item = groupPack.settings.menuItems[0];
    item.optionGroups = Array.from({ length: 21 }, (_, i) => ({ ...item.optionGroups![0], id: `group-${i}` }));
    errorCode(() => parseMenuPack(groupPack));
    const choicePack = menu(); const group = choicePack.settings.menuItems[0].optionGroups![0];
    group.choices = Array.from({ length: 101 }, (_, i) => ({ ...group.choices[0], id: `choice-${i}` }));
    errorCode(() => parseMenuPack(choicePack));
  });

  it('rejects empty menus and duplicate legacy variation IDs', () => {
    const empty = menu(); empty.settings.menuItems = []; errorCode(() => parseMenuPack(empty), 'EMPTY_MENU');
    const p = menu(); const v = { id: 'same', name: { en: 'Size', zh: '' }, price: 0 };
    p.settings.menuItems[0].sizes = [v, v]; errorCode(() => parseMenuPack(p));
  });

  it('rejects duplicate option group IDs even when one group has no enabled choices', () => {
    const p = menu(); const duplicate = structuredClone(p.settings.menuItems[0].optionGroups![0]);
    duplicate.choices.forEach(choice => { choice.enabled = false; });
    p.settings.menuItems[0].optionGroups!.push(duplicate);
    errorCode(() => parseMenuPack(p));
  });

  it.each(['jpeg', 'png', 'webp'])('permits embedded %s data images', mime => {
    const p = menu(); p.settings.coverPhoto = `data:image/${mime};base64,AQID`;
    p.settings.menuItems[0].image = p.settings.coverPhoto;
    expect(parseMenuPack(p).settings.coverPhoto).toBe(p.settings.coverPhoto);
  });

  it.each(['https://example.com/photo.jpg', 'blob:photo', 'javascript:alert(1)', 'data:image/svg+xml;base64,AQID',
    'data:image/gif;base64,AQID', 'data:text/html;base64,AQID', 'data:image/png;utf8,data', 'data:image/png;base64,%%%%'])('rejects non-whitelisted photo %s', photo => {
    const p = menu(); p.settings.menuItems[0].image = photo; errorCode(() => parseMenuPack(p), 'INVALID_PHOTO');
  });

  it('rejects an oversized photo field before allocating decoded bytes', () => {
    const p = menu(); p.settings.coverPhoto = 'data:image/png;base64,' + 'A'.repeat(MENU_MAX_BYTES);
    errorCode(() => parseMenuPack(p));
  });

  it.each([-10000001, 10000001, -0.5, NaN, Infinity])('rejects invalid signed option delta %s', value => {
    const p = menu(); p.settings.menuItems[0].optionGroups![1].choices[0].priceDeltaSen = value;
    errorCode(() => parseMenuPack(p));
  });

  it('normalizes international WhatsApp numbers and rejects local/invalid values', () => {
    expect(normalizeWhatsAppNumber('+60 (12) 345-6789')).toBe('60123456789');
    for (const value of ['0123456789', '1234567', '1'.repeat(16), '60abc123456', '+60.12345678']) errorCode(() => normalizeWhatsAppNumber(value), 'INVALID_PHONE');
  });
});

describe('order request validation and current menu pricing', () => {
  it.each(['name', 'phone', 'address'] as const)('requires customer %s', field => {
    const p = request(); p.customer[field] = '  '; errorCode(() => parseOrderRequest(p));
  });
  it('normalizes optional notes and rejects invalid phone characters', () => {
    const p = request(); delete p.customer.note;
    expect(parseOrderRequest(p).customer.note).toBe('');
    p.customer.phone = 'abcdefg'; errorCode(() => parseOrderRequest(p), 'INVALID_PHONE');
  });

  it('rejects selection keys that collide after normalization instead of silently replacing choices', () => {
    const p = request(); p.lines[0].selections[' size '] = [];
    errorCode(() => parseOrderRequest(p));
  });

  it('enforces request selection group and choice count limits', () => {
    const p = request(); p.lines[0].selections = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`group-${i}`, []]));
    errorCode(() => parseOrderRequest(p));
    const q = request(); q.lines[0].selections.extras = Array.from({ length: 101 }, (_, i) => `choice-${i}`);
    errorCode(() => parseOrderRequest(q));
  });

  it.each([
    ['dine in', (p: OrderRequest) => { (p as any).orderType = 'Dine-in'; }],
    ['language', (p: OrderRequest) => { (p as any).language = 'fr'; }],
    ['empty cart', (p: OrderRequest) => { p.lines = []; }],
    ['zero quantity', (p: OrderRequest) => { p.lines[0].quantity = 0; }],
    ['fractional quantity', (p: OrderRequest) => { p.lines[0].quantity = 1.5; }],
    ['large quantity', (p: OrderRequest) => { p.lines[0].quantity = 1000; }],
    ['too many lines', (p: OrderRequest) => { p.lines = Array.from({ length: 101 }, () => structuredClone(p.lines[0])); }],
    ['too many total items', (p: OrderRequest) => { p.lines = Array.from({ length: 11 }, () => ({ ...structuredClone(p.lines[0]), quantity: 999 })); }],
    ['duplicate choices', (p: OrderRequest) => { p.lines[0].selections.size = ['large', 'large']; }],
    ['negative quote', (p: OrderRequest) => { p.quotedTotalSen = -1; }],
    ['fractional quote', (p: OrderRequest) => { p.quotedTotalSen = 0.5; }],
    ['long note', (p: OrderRequest) => { p.customer.note = 'x'.repeat(1001); }],
  ])('rejects %s', (_label, mutate) => { const p = request(); mutate(p); errorCode(() => parseOrderRequest(p)); });

  it.each([
    ['unknown item', (p: OrderRequest) => { p.lines[0].menuItemId = 'unknown'; }, 'ITEM_REMOVED'],
    ['unknown group', (p: OrderRequest) => { p.lines[0].selections.unknown = ['x']; }, 'OPTION_REMOVED'],
    ['unknown choice', (p: OrderRequest) => { p.lines[0].selections.extras = ['unknown']; }, 'OPTION_REMOVED'],
    ['missing required choice', (p: OrderRequest) => { p.lines[0].selections.size = []; }, 'OPTION_REMOVED'],
  ])('rejects %s during import', (_label, mutate, code) => {
    const p = request(); mutate(p); errorCode(() => rebuildRequestCart(parseOrderRequest(p), menu().settings), code);
  });

  it('rejects a choice disabled after the menu was shared', () => {
    const p = menu(); p.settings.menuItems[0].optionGroups![1].choices[0].enabled = false;
    errorCode(() => rebuildRequestCart(request(), p.settings), 'OPTION_REMOVED');
  });

  it('rebuilds line totals and immutable names from current menu, then applies current tax and packing once', () => {
    const settings: ShopSettings = { ...menu().settings, qrImage: null, takeawayFee: 0.5, taxRate: 6 };
    settings.menuItems[0].basePrice = 10;
    settings.menuItems[0].optionGroups![0].choices[0].priceDeltaSen = 150;
    const originalRequest = request(); originalRequest.quotedTotalSen = 1;
    const cart = rebuildRequestCart(originalRequest, settings);
    expect(cart[0]).toMatchObject({ id: 'request-1:0', quantity: 2, unitPrice: 12.25, totalPrice: 24.5, itemName: { zh: '糕点' } });
    expect(calculateOrderAmounts(cart, settings, 'Takeaway')).toEqual({ subtotal: 24.5, takeawayFee: 0.5, taxAmount: 1.5, totalAmount: 26.5 });
    settings.menuItems[0].name.zh = '改名';
    expect(cart[0].itemName?.zh).toBe('糕点');
    expect(originalRequest.quotedTotalSen).toBe(1);
  });

  it('creates a request with the same tax and packing total displayed by checkout', () => {
    const pack = menu(); const cart = rebuildRequestCart(request(), pack.settings);
    const created = requestFromCart(pack, cart, request().customer, 'ms');
    expect(created).toMatchObject({ shopId: pack.shopId, menuId: pack.menuId, language: 'ms', quotedTotalSen: 2120, orderType: 'Takeaway' });
    expect(created.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(created.lines).toEqual(request().lines);
  });

  it('preserves negative option deltas and calculates tax on the discounted amount plus packing', () => {
    const input = menu(); input.settings.menuItems[0].optionGroups![1].choices[0].priceDeltaSen = -75;
    const pack = parseMenuPack(input); const cart = rebuildRequestCart(request(), pack.settings);
    expect(cart[0]).toMatchObject({ unitPrice: 8.25, totalPrice: 16.5 });
    expect(cart[0].optionSelections?.find(option => option.choiceId === 'coconut')?.priceDeltaSen).toBe(-75);
    expect(requestFromCart(pack, cart, request().customer, 'zh').quotedTotalSen).toBe(1802);
  });

  it('rejects a set of discounts that would make the current unit price negative', () => {
    const p = menu(); p.settings.menuItems[0].basePrice = 0;
    p.settings.menuItems[0].optionGroups![0].choices[0].priceDeltaSen = 0;
    p.settings.menuItems[0].optionGroups![1].choices[0].priceDeltaSen = -75;
    errorCode(() => rebuildRequestCart(request(), parseMenuPack(p).settings), 'INVALID_PRICE');
  });

  it('takes a photo-free independent snapshot of an issued menu', () => {
    const p = menu(); p.settings.menuItems[0].image = 'data:image/png;base64,AQID';
    const saved = makeIssuedRecord(p);
    expect(saved.menuItems[0].image).toBe(''); expect(p.settings.menuItems[0].image).not.toBe('');
    p.settings.menuItems[0].optionGroups![0].choices[0].names.zh = '改变';
    expect(saved.menuItems[0].optionGroups![0].choices[0].names.zh).toBe('大份');
    expect(saved).not.toHaveProperty('whatsappNumber');
  });
});

describe('receipt menu revision', () => {
  const settings = () => ({ ...menu().settings, qrImage: null }) as ShopSettings;

  it.each(['en', 'zh', 'ms'] as const)('detects a same-price item name change in %s', language => {
    const before = settings(), after = structuredClone(before);
    after.menuItems[0].name[language] = 'Updated item';
    expect(calculateOrderAmounts(rebuildRequestCart(request(), after), after, 'Takeaway'))
      .toEqual(calculateOrderAmounts(rebuildRequestCart(request(), before), before, 'Takeaway'));
    expect(requestMenuRevision(request(), after)).not.toBe(requestMenuRevision(request(), before));
  });

  it.each(['en', 'zh', 'ms'] as const)('detects a same-price option group name change in %s', language => {
    const before = settings(), after = structuredClone(before);
    after.menuItems[0].optionGroups![0].names[language] = 'Updated size';
    expect(requestMenuRevision(request(), after)).not.toBe(requestMenuRevision(request(), before));
  });

  it.each(['en', 'zh', 'ms'] as const)('detects a same-price option choice name change in %s', language => {
    const before = settings(), after = structuredClone(before);
    after.menuItems[0].optionGroups![0].choices[0].names[language] = 'Updated large';
    expect(requestMenuRevision(request(), after)).not.toBe(requestMenuRevision(request(), before));
  });

  it.each(['required', 'minSelect', 'maxSelect'] as const)('detects a still-valid %s constraint change at the same price', field => {
    const before = settings(), after = structuredClone(before);
    const group = after.menuItems[0].optionGroups![1];
    if (field === 'required') group.required = true;
    else group[field] = 1;
    expect(calculateOrderAmounts(rebuildRequestCart(request(), after), after, 'Takeaway'))
      .toEqual(calculateOrderAmounts(rebuildRequestCart(request(), before), before, 'Takeaway'));
    expect(requestMenuRevision(request(), after)).not.toBe(requestMenuRevision(request(), before));
  });

  it.each(['enableTax', 'taxRate', 'takeawayFee'] as const)('detects a %s charge change', field => {
    const before = settings(), after = structuredClone(before);
    if (field === 'enableTax') after.enableTax = false;
    else after[field] = 1;
    expect(requestMenuRevision(request(), after)).not.toBe(requestMenuRevision(request(), before));
  });

  it('ignores item, cover and payment photo changes', () => {
    const before = settings(), after = structuredClone(before);
    after.menuItems[0].image = 'data:image/png;base64,AQID';
    after.coverPhoto = 'blob:new-cover'; after.qrImage = 'blob:new-payment';
    expect(requestMenuRevision(request(), after)).toBe(requestMenuRevision(request(), before));
  });

  it('ignores unrelated menu items and merchant contact changes', () => {
    const before = settings(), after = structuredClone(before);
    after.menuItems.push({ ...structuredClone(after.menuItems[0]), id: 'unselected', name: { en: 'Another item', zh: '' } });
    after.shopNameEn = 'Renamed shop'; after.whatsappNumber = '60111111111';
    expect(requestMenuRevision(request(), after)).toBe(requestMenuRevision(request(), before));
  });

  it('ignores name object insertion order', () => {
    const before = settings(), after = structuredClone(before);
    after.menuItems[0].name = { ms: 'Kuih', zh: '糕点', en: 'Kuih' };
    const group = after.menuItems[0].optionGroups![0];
    group.names = { zh: '份量', en: 'Size' };
    group.choices[0].names = { zh: '大份', en: 'Large' };
    expect(requestMenuRevision(request(), after)).toBe(requestMenuRevision(request(), before));
  });

  it('treats an unchanged legacy menu and its normalized shared copy as the same revision', () => {
    const before = settings();
    delete before.menuItems[0].name.ms;
    const shared = { ...parseMenuPack({ ...menu(), settings: before }).settings, qrImage: null };
    expect(requestMenuRevision(request(), shared)).toBe(requestMenuRevision(request(), before));
  });

  it('ignores surrounding whitespace in item, group and choice names', () => {
    const before = settings(), after = structuredClone(before);
    after.menuItems[0].name.en = '  Kuih  ';
    after.menuItems[0].name.zh = ' 糕点 ';
    const group = after.menuItems[0].optionGroups![0];
    group.names.en = ' Size '; group.names.ms = '  ';
    group.choices[0].names.zh = ' 大份 '; group.choices[0].names.ms = ' ';
    expect(requestMenuRevision(request(), after)).toBe(requestMenuRevision(request(), before));
  });
});

describe('files and receipt links', () => {
  it('keeps Chinese customer fields intact through UTF-8 fragment and file round trips', async () => {
    const p = parseOrderRequest(request()); const link = receiptLink(p)!;
    expect(link).toMatch(/^https:\/\/pos\.cj-chan\.work\/receive\/#[-\w]+$/);
    expect(link).not.toContain('?');
    expect(requestFromLink(link)).toEqual(p);
    expect(requestFromLink(new URL(link).hash.slice(1))).toEqual(p);
    expect(await readOrderFile(requestFile(p))).toEqual(p);
    expect(await readMenuFile(new Blob([JSON.stringify(menu())]))).toEqual(parseMenuPack(menu()));
  });

  it('canonicalizes choice and group ordering without changing the request ID', async () => {
    const a = request(); a.lines[0].selections = { size: ['large'], extras: ['syrup', 'coconut'] };
    const b = request(); b.lines[0].selections = { extras: ['coconut', 'syrup'], size: ['large'] };
    const fingerprint = requestFingerprint(a);
    expect(requestFingerprint(b)).toBe(fingerprint);
    expect(requestFingerprint(a)).toBe(fingerprint);
    expect((await readOrderFile(requestFile(a))).requestId).toBe(a.requestId);
    expect(requestFromLink(receiptLink(a)!).requestId).toBe(a.requestId);
    b.customer.note = 'changed'; expect(requestFingerprint(b)).not.toBe(fingerprint);
  });

  it('falls back to an order file when the encoded link exceeds 8000 characters', async () => {
    const p = request(); p.customer.address = '地址'.repeat(250); p.customer.note = '备注'.repeat(500);
    p.lines = Array.from({ length: 20 }, () => structuredClone(p.lines[0]));
    expect(receiptLink(p)).toBeNull();
    expect((await readOrderFile(requestFile(p))).requestId).toBe(p.requestId);
    expect(RECEIPT_LINK_MAX).toBe(8000);
    errorCode(() => requestFromLink(RECEIPT_URL + '#' + 'a'.repeat(8000)), 'ORDER_TOO_LARGE');
  });

  it.each(['https://evil.example/receive/#abc', 'http://pos.cj-chan.work/receive/#abc',
    'https://pos.cj-chan.work/menu/#abc', 'https://user:pass@pos.cj-chan.work/receive/#abc',
    'https://pos.cj-chan.work/receive/', 'not base64!', '%%%%', '_w'])('rejects invalid receipt link %s', link => {
    errorCode(() => requestFromLink(link), 'INVALID_LINK');
  });

  it('rejects corrupt and wrong-kind files and enforces byte limits', async () => {
    await expect(readOrderFile(new Blob(['{broken']))).rejects.toThrow('INVALID_FILE');
    await expect(readMenuFile(new Blob(['null']))).rejects.toThrow('INVALID_FILE');
    await expect(readOrderFile(new Blob([JSON.stringify(menu())]))).rejects.toThrow('INVALID_FILE');
    await expect(readMenuFile(new Blob([new Uint8Array(MENU_MAX_BYTES + 1)]))).rejects.toThrow('MENU_TOO_LARGE');
    await expect(readOrderFile(new Blob([new Uint8Array(ORDER_MAX_BYTES + 1)]))).rejects.toThrow('ORDER_TOO_LARGE');
  });

  it('refuses to generate an order file larger than its own importer permits', () => {
    const p = request(); const choices = Array.from({ length: 30 }, (_, i) => `choice-${i}-${'x'.repeat(100)}`);
    p.lines = Array.from({ length: 100 }, () => ({ menuItemId: 'kuih', quantity: 1, selections: { extras: [...choices] } }));
    expect(parseOrderRequest(p).lines).toHaveLength(100);
    expect(new Blob([requestFingerprint(p)]).size).toBeGreaterThan(ORDER_MAX_BYTES);
    errorCode(() => requestFile(p), 'ORDER_TOO_LARGE');
  });
});
