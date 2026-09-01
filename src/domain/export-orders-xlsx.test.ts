import {describe, expect, it} from 'vitest';
import {buildOrderWorkbookSheets} from './export-orders-xlsx';
import type {Order, ShopSettings} from '../types';

const settings: ShopSettings = {
  shopNameEn: 'Test Store',
  shopNameZh: '测试店',
  coverPhoto: '',
  qrImage: null,
  menuItems: [{
    id: 'meal-1',
    name: {en: '=Unsafe-looking meal', zh: '测试餐'},
    basePrice: 8,
    image: '',
    sizes: [],
    noodleBases: [],
    addOns: [],
  }],
  enableTax: false,
  taxRate: 6,
  takeawayFee: 0.5,
};

const order: Order = {
  local_order_id: 'order-uid-1',
  order_id: '90001',
  timestamp: '2026-09-01 10:30:00',
  order_type: 'Dine-in',
  table_no: '@Table 1',
  items_summary: '=SUM(A1:A2)',
  items: [{
    id: 'line-1',
    menuItemId: 'meal-1',
    sizeId: 'regular',
    noodleBaseIds: [],
    addOnIds: [],
    optionSelections: [{
      optionGroupId: 'protein',
      groupNames: {en: 'Protein', zh: '肉类'},
      choiceId: 'beef',
      choiceNames: {en: '+Beef', zh: '牛肉'},
      priceDeltaSen: 200,
    }],
    quantity: 2,
    unitPrice: 10,
    totalPrice: 20,
  }],
  total_qty: 2,
  subtotal: 20,
  takeaway_fee: 0,
  tax_amount: 0,
  total_amount: 20,
  status: 'Completed',
  paid: true,
  payment_method: 'Cash',
  synced: false,
};

describe('buildOrderWorkbookSheets', () => {
  it('creates a real two-sheet workbook model with numeric money cells', () => {
    const sheets = buildOrderWorkbookSheets([order], settings);

    expect(sheets.map(sheet => sheet.sheet)).toEqual(['Orders', 'Order Items']);
    expect(sheets[0].data).toHaveLength(2);
    expect(sheets[1].data).toHaveLength(2);
    expect(sheets[0].data[1][10]).toMatchObject({value: 20, type: Number, format: '0.00'});
  });

  it('writes merchant-controlled spreadsheet values explicitly as text', () => {
    const sheets = buildOrderWorkbookSheets([order], settings);

    expect(sheets[0].data[1][4]).toMatchObject({value: '@Table 1', type: String});
    expect(sheets[0].data[1][5]).toMatchObject({value: '=SUM(A1:A2)', type: String});
    expect(sheets[1].data[1][3]).toMatchObject({value: '=Unsafe-looking meal', type: String});
    expect(sheets[1].data[1][5]).toMatchObject({value: 'Protein: +Beef', type: String});
  });

  it.each(['=formula', '+formula', '-formula', '@formula', '\tformula', '\rformula'])(
    'keeps formula-like workbook text typed as String: %j',
    (value) => {
      const formulaLookingOrder = {...order, table_no: value};
      const sheets = buildOrderWorkbookSheets([formulaLookingOrder], settings);

      expect(sheets[0].data[1][4]).toMatchObject({value, type: String});
    },
  );
});
