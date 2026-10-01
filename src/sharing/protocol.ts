import type { CartItem, CustomerContact, IssuedMenuRecord, Language, MenuItem, ShopSettings } from '../types';
import { buildOptionSelectionSnapshots, calculateOptionSelectionSen, getMenuOptionGroups, getEnabledOptionGroups, getLegacyAddOnChoiceIds, getLegacyNoodleChoiceIds, getLegacySizeChoiceId, validateOptionSelections } from '../domain/menu-options';
import { calculateOrderAmounts } from '../domain/order-amounts';
import { v4 as uuidv4 } from 'uuid';

export const MENU_MAX_BYTES = 10 * 1024 * 1024;
export const ORDER_MAX_BYTES = 256 * 1024;
export const RECEIPT_LINK_MAX = 8000;
export const MENU_OPEN_URL = 'https://pos.cj-chan.work/menu/';
export const RECEIPT_URL = 'https://pos.cj-chan.work/receive/';
export type PublicMenuSettings = Pick<ShopSettings, 'shopNameEn' | 'shopNameZh' | 'shopNameMs' | 'coverPhoto' | 'menuItems' | 'enableTax' | 'taxRate' | 'takeawayFee'>;
export interface MenuPack {
  kind: 'cjpos.menu'; version: 1; shopId: string; menuId: string; createdAt: string;
  whatsappNumber: string; settings: PublicMenuSettings;
}
export interface RequestLine { menuItemId: string; quantity: number; selections: Record<string, string[]> }
export interface OrderRequest {
  kind: 'cjpos.order'; version: 1; requestId: string; shopId: string; menuId: string;
  createdAt: string; language: Language; customer: CustomerContact; orderType: 'Takeaway';
  lines: RequestLine[]; quotedTotalSen: number;
}
export class SharingError extends Error { constructor(public code: string) { super(code); this.name = 'SharingError'; } }
function fail(code: string): never { throw new SharingError(code); }
function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_FILE');
  return value as Record<string, any>;
}
function text(value: unknown, limit: number, required = true): string {
  if (typeof value !== 'string' || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail('INVALID_FILE');
  const clean = value.trim(); if (required && !clean) fail('INVALID_FILE'); return clean;
}
function id(value: unknown): string { return text(value, 120); }
function number(value: unknown, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isSafeInteger(value))) fail('INVALID_FILE');
  return value;
}
function delta(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || Math.abs(value) > 10000000) fail('INVALID_FILE'); return value;
}
function list(value: unknown, max: number): any[] {
  if (!Array.isArray(value) || value.length > max) fail('INVALID_FILE'); return value;
}
function unique(values: string[]): void { if (new Set(values).size !== values.length) fail('INVALID_FILE'); }
function date(value: unknown): string {
  const s = text(value, 40); if (!/^\d{4}-\d\d-\d\dT/.test(s) || !Number.isFinite(Date.parse(s))) fail('INVALID_FILE'); return s;
}
function names(input: unknown) {
  const n = object(input);
  const result = { en: text(n.en ?? '', 300, false), zh: text(n.zh ?? '', 300, false), ms: text(n.ms ?? '', 300, false) };
  if (!Object.values(result).some(Boolean)) fail('INVALID_FILE'); return result;
}
function photo(value: unknown): string {
  const s = text(value ?? '', MENU_MAX_BYTES, false);
  if (s && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s)) fail('INVALID_PHOTO'); return s;
}
export function normalizeWhatsAppNumber(input: string): string {
  const result = input.replace(/[+\s()-]/g, '');
  if (!/^[1-9]\d{7,14}$/.test(result)) fail('INVALID_PHONE'); return result;
}
function menuItem(input: unknown): MenuItem {
  const value = object(input);
  const variations = (v: unknown) => list(v ?? [], 100).map(x => {
    const choice = object(x); return { id: id(choice.id), name: names(choice.name), price: number(choice.price, 100000) };
  });
  const item: MenuItem = { id: id(value.id), name: names(value.name), basePrice: number(value.basePrice, 100000), image: photo(value.image),
    sizes: variations(value.sizes), noodleBases: variations(value.noodleBases), addOns: variations(value.addOns) };
  if (value.optionGroups !== undefined) item.optionGroups = list(value.optionGroups, 20).map(x => {
    const group = object(x);
    const choices = list(group.choices, 100).map(y => {
      const choice = object(y); if (typeof choice.enabled !== 'boolean') fail('INVALID_FILE');
      return { id: id(choice.id), names: names(choice.names), priceDeltaSen: delta(choice.priceDeltaSen) as any,
        enabled: choice.enabled, sortOrder: number(choice.sortOrder ?? 0, 10000, true) };
    });
    unique(choices.map(c => c.id));
    const minSelect = number(group.minSelect, 100, true), maxSelect = number(group.maxSelect, 100, true);
    if (typeof group.required !== 'boolean' || minSelect > maxSelect || (group.required && maxSelect < 1)) fail('INVALID_FILE');
    return { id: id(group.id), names: names(group.names), required: group.required, minSelect, maxSelect, choices,
      sortOrder: number(group.sortOrder ?? 0, 10000, true) };
  });
  unique(getMenuOptionGroups(item).map(g => g.id));
  for (const variants of [item.sizes, item.noodleBases, item.addOns]) unique(variants.map(v => v.id));
  return item;
}
export function parseMenuPack(input: unknown): MenuPack {
  const p = object(input), s = object(p.settings);
  if (p.kind !== 'cjpos.menu' || p.version !== 1) fail('INVALID_FILE');
  const menuItems = list(s.menuItems, 300).map(menuItem); if (!menuItems.length) fail('EMPTY_MENU'); unique(menuItems.map(i => i.id));
  if (typeof s.enableTax !== 'boolean') fail('INVALID_FILE');
  return { kind: 'cjpos.menu', version: 1, shopId: id(p.shopId), menuId: id(p.menuId), createdAt: date(p.createdAt),
    whatsappNumber: normalizeWhatsAppNumber(text(p.whatsappNumber, 30)), settings: {
      shopNameEn: text(s.shopNameEn ?? '', 300, false), shopNameZh: text(s.shopNameZh ?? '', 300, false), shopNameMs: text(s.shopNameMs ?? '', 300, false),
      coverPhoto: photo(s.coverPhoto), menuItems, enableTax: s.enableTax, taxRate: number(s.taxRate, 100), takeawayFee: number(s.takeawayFee, 100000),
    } };
}
export function parseOrderRequest(input: unknown): OrderRequest {
  const p = object(input), c = object(p.customer);
  if (p.kind !== 'cjpos.order' || p.version !== 1 || p.orderType !== 'Takeaway' || !['en', 'zh', 'ms'].includes(p.language)) fail('INVALID_FILE');
  const lines = list(p.lines, 100).map(x => {
    const line = object(x), s = object(line.selections), selections: Record<string, string[]> = Object.create(null);
    if (Object.keys(s).length > 20) fail('INVALID_FILE');
    for (const [key, value] of Object.entries(s)) {
      const choices = list(value, 100).map(id); unique(choices);
      const groupId = id(key); if (Object.prototype.hasOwnProperty.call(selections, groupId)) fail('INVALID_FILE');
      selections[groupId] = choices.sort();
    }
    const quantity = number(line.quantity, 999, true); if (!quantity) fail('INVALID_FILE');
    return { menuItemId: id(line.menuItemId), quantity, selections };
  });
  if (!lines.length || lines.reduce((n, l) => n + l.quantity, 0) > 9999) fail('INVALID_FILE');
  const customer = { name: text(c.name, 120), phone: text(c.phone, 30), address: text(c.address, 500), note: text(c.note ?? '', 1000, false) };
  if (!/^\+?[\d\s()-]{7,30}$/.test(customer.phone) || customer.phone.replace(/\D/g, '').length < 7) fail('INVALID_PHONE');
  return { kind: 'cjpos.order', version: 1, requestId: id(p.requestId), shopId: id(p.shopId), menuId: id(p.menuId), createdAt: date(p.createdAt),
    language: p.language, customer, orderType: 'Takeaway', lines, quotedTotalSen: number(p.quotedTotalSen, 1000000000, true) };
}
export async function readMenuFile(file: Blob): Promise<MenuPack> {
  if (file.size > MENU_MAX_BYTES) fail('MENU_TOO_LARGE');
  try { return parseMenuPack(JSON.parse(await file.text())); } catch (e) { if (e instanceof SharingError) throw e; return fail('INVALID_FILE'); }
}
export async function readOrderFile(file: Blob): Promise<OrderRequest> {
  if (file.size > ORDER_MAX_BYTES) fail('ORDER_TOO_LARGE');
  try { return parseOrderRequest(JSON.parse(await file.text())); } catch (e) { if (e instanceof SharingError) throw e; return fail('INVALID_FILE'); }
}
export function rebuildRequestCart(request: OrderRequest, settings: Pick<ShopSettings, 'menuItems'>): CartItem[] {
  return request.lines.map((line, index) => {
    const item = settings.menuItems.find(i => i.id === line.menuItemId); if (!item) fail('ITEM_REMOVED');
    const groups = getEnabledOptionGroups(item);
    if (Object.keys(line.selections).some(key => !groups.some(g => g.id === key))) fail('OPTION_REMOVED');
    if (!validateOptionSelections(groups, line.selections).valid) fail('OPTION_REMOVED');
    const unitSen = Math.round(item.basePrice * 100) + calculateOptionSelectionSen(groups, line.selections);
    if (!Number.isSafeInteger(unitSen) || unitSen < 0) fail('INVALID_PRICE');
    return { id: `${request.requestId}:${index}`, menuItemId: item.id, itemName: { ...item.name },
      sizeId: getLegacySizeChoiceId(item, line.selections), noodleBaseIds: getLegacyNoodleChoiceIds(item, line.selections),
      addOnIds: getLegacyAddOnChoiceIds(item, line.selections), optionSelections: buildOptionSelectionSnapshots(groups, line.selections),
      quantity: line.quantity, unitPrice: unitSen / 100, totalPrice: unitSen * line.quantity / 100 };
  });
}
export function requestFromCart(pack: MenuPack, cart: CartItem[], customer: CustomerContact, language: Language): OrderRequest {
  const lines = cart.map(item => {
    const selections: Record<string, string[]> = Object.create(null);
    for (const option of item.optionSelections ?? []) (selections[option.optionGroupId] ??= []).push(option.choiceId);
    return { menuItemId: item.menuItemId, quantity: item.quantity, selections };
  });
  return parseOrderRequest({ kind: 'cjpos.order', version: 1, requestId: uuidv4(), shopId: pack.shopId, menuId: pack.menuId,
    createdAt: new Date().toISOString(), language, customer, orderType: 'Takeaway', lines,
    quotedTotalSen: Math.round(calculateOrderAmounts(cart, { ...pack.settings, qrImage: null }, 'Takeaway').totalAmount * 100) });
}
/** Canonical full contents, rather than a collision-prone short hash. */
export function requestFingerprint(request: OrderRequest): string {
  const p = parseOrderRequest(request);
  return JSON.stringify({ ...p, lines: p.lines.map(l => ({ ...l, selections: Object.fromEntries(Object.entries(l.selections).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) })) });
}
/** Recheck the displayed menu inside the same transaction that accepts a receipt. */
export function requestMenuRevision(request: OrderRequest, settings: ShopSettings): string {
  const canonical = (value: any, key = ''): any => {
    if (['name', 'names', 'itemName', 'groupNames', 'choiceNames'].includes(key) && value && typeof value === 'object')
      return { en: (value.en ?? '').trim(), zh: (value.zh ?? '').trim(), ms: (value.ms ?? '').trim() };
    return Array.isArray(value) ? value.map(entry => canonical(entry))
      : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(child => [child, canonical(value[child], child)])) : value;
  };
  const cart = rebuildRequestCart(request, settings);
  const selectedIds = new Set(request.lines.map(line => line.menuItemId));
  return JSON.stringify(canonical({ cart, amounts: calculateOrderAmounts(cart, settings, 'Takeaway'),
    enableTax: settings.enableTax, taxRate: settings.taxRate, takeawayFee: settings.takeawayFee,
    items: settings.menuItems.filter(item => selectedIds.has(item.id)).map(item => ({ id: item.id, name: item.name,
      basePrice: item.basePrice, groups: getEnabledOptionGroups(item) })) }));
}
export function requestFile(request: OrderRequest): Blob {
  const blob = new Blob([requestFingerprint(request)], { type: 'application/vnd.cjpos.order+json' });
  if (blob.size > ORDER_MAX_BYTES) fail('ORDER_TOO_LARGE'); return blob;
}
export function receiptLink(request: OrderRequest): string | null {
  const bytes = new TextEncoder().encode(requestFingerprint(request));
  let binary = ''; for (const b of bytes) binary += String.fromCharCode(b);
  const link = RECEIPT_URL + '#' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return link.length <= RECEIPT_LINK_MAX ? link : null;
}
export function requestFromLink(input: string): OrderRequest {
  let payload = input.trim();
  if (/^https?:/i.test(payload)) {
    let url: URL; try { url = new URL(payload); } catch { return fail('INVALID_LINK'); }
    if (url.origin !== 'https://pos.cj-chan.work' || !['/receive', '/receive/'].includes(url.pathname) || url.username || url.password) fail('INVALID_LINK');
    if (payload.length > RECEIPT_LINK_MAX) fail('ORDER_TOO_LARGE'); payload = url.hash.slice(1);
  }
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || payload.length > RECEIPT_LINK_MAX) fail('INVALID_LINK');
  try {
    const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return parseOrderRequest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, c => c.charCodeAt(0)))));
  } catch (e) { if (e instanceof SharingError) throw e; return fail('INVALID_LINK'); }
}
export function makeIssuedRecord(pack: MenuPack): IssuedMenuRecord {
  return { menuId: pack.menuId, createdAt: pack.createdAt, menuItems: pack.settings.menuItems.map(i => ({ ...structuredClone(i), image: '' })),
    enableTax: pack.settings.enableTax, taxRate: pack.settings.taxRate, takeawayFee: pack.settings.takeawayFee };
}
