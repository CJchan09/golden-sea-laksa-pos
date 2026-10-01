import { describe, expect, it } from 'vitest';
import type { CartItem } from '../types';
import { upsertGuestCartItem } from './guest-cart';

function item(id = 'modal-generated-id'): CartItem {
  return { id, menuItemId: 'kuih', itemName: { en: 'Kuih', zh: '糕点', ms: 'Kuih' },
    sizeId: '', noodleBaseIds: [], addOnIds: [], quantity: 1, unitPrice: 8, totalPrice: 8,
    optionSelections: [{ optionGroupId: 'extras', groupNames: { en: 'Extras', zh: '加料' },
      choiceId: 'coconut', choiceNames: { en: 'Coconut', zh: '椰丝' }, priceDeltaSen: 0 }] };
}

describe('guest cart save retries', () => {
  it('assigns the modal pending ID to an item without an ID, matching the modal callback', () => {
    const { id, ...input } = item();
    const cart = upsertGuestCartItem([], input, 'pending-1');
    expect(cart).toEqual([{ ...input, id: 'pending-1' }]);
    expect(input).not.toHaveProperty('id');
    expect(id).toBe('modal-generated-id');
  });

  it('repeated saves with the same pending ID never append a duplicate row', () => {
    const other = item('existing-order-line');
    let cart = upsertGuestCartItem([other], item(), 'pending-1');
    for (let attempt = 0; attempt < 5; attempt++) {
      // The modal can generate a fresh item ID on retry; its pending ID remains stable.
      cart = upsertGuestCartItem(cart, item(`retry-${attempt}`), 'pending-1');
    }
    expect(cart).toHaveLength(2);
    expect(cart.map(row => row.id)).toEqual(['existing-order-line', 'pending-1']);
    expect(cart[0]).toBe(other);
  });

  it('a retry replaces quantity, price and choices with the latest modal values', () => {
    const first = upsertGuestCartItem([], item(), 'pending-1');
    const changed = { ...item('retry-id'), quantity: 3, unitPrice: 9, totalPrice: 27,
      optionSelections: [{ optionGroupId: 'extras', groupNames: { en: 'Extras', zh: '加料' },
        choiceId: 'syrup', choiceNames: { en: 'Syrup', zh: '糖浆' }, priceDeltaSen: 100 }] };
    const retry = upsertGuestCartItem(first, changed, 'pending-1');
    expect(retry).toEqual([{ ...changed, id: 'pending-1' }]);
    expect(first[0].quantity).toBe(1);
    expect(first[0].optionSelections![0].choiceId).toBe('coconut');
  });

  it('editing a saved row preserves its position and ID without mutating the input array', () => {
    const before = [item('first'), item('editing'), item('last')];
    const original = structuredClone(before);
    const result = upsertGuestCartItem(before, { ...item(), quantity: 2, totalPrice: 16 }, 'editing');
    expect(result.map(row => row.id)).toEqual(['first', 'editing', 'last']);
    expect(result[1].quantity).toBe(2);
    expect(before).toEqual(original);
    expect(result).not.toBe(before);
  });

  it('a separately opened new modal can add an identical item as a distinct row', () => {
    const first = upsertGuestCartItem([], item(), 'pending-1');
    const second = upsertGuestCartItem(first, item(), 'pending-2');
    expect(second.map(row => row.id)).toEqual(['pending-1', 'pending-2']);
    expect(first).toHaveLength(1);
  });
});
