import type {CellObject, SheetData} from 'write-excel-file/browser';
import type {Order, ShopSettings} from '../types';

const HEADER_BACKGROUND = '#7A1020';
const HEADER_TEXT = '#FFD43B';
const MONEY_FORMAT = '0.00';

function textCell(value: unknown): CellObject {
  return {
    value: value === null || value === undefined ? '' : String(value),
    type: String,
    wrap: true,
    alignVertical: 'top',
  };
}

function numberCell(value: unknown): CellObject {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return {
    value: number,
    type: Number,
    format: MONEY_FORMAT,
    align: 'right',
  };
}

function integerCell(value: unknown): CellObject {
  return {
    value: typeof value === 'number' && Number.isFinite(value) ? value : 0,
    type: Number,
    align: 'right',
  };
}

function headerCell(value: string): CellObject {
  return {
    value,
    type: String,
    fontWeight: 'bold',
    backgroundColor: HEADER_BACKGROUND,
    textColor: HEADER_TEXT,
    alignVertical: 'center',
    wrap: true,
  };
}

function optionText(order: Order, itemIndex: number): string {
  const item = order.items[itemIndex];
  if (!item) return '';

  const generic = (item.optionSelections ?? []).map((selection) => (
    `${selection.groupNames.en}: ${selection.choiceNames.en}`
  ));
  const legacy = (item.noodleBases ?? []).map(String);
  return [...generic, ...legacy].join('; ');
}

function addOnText(order: Order, itemIndex: number): string {
  const item = order.items[itemIndex];
  if (!item) return '';
  if (item.addOnSelections?.length) {
    return item.addOnSelections.map((addOn) => addOn.name.en).join('; ');
  }
  return (item.addOns ?? []).map(String).join('; ');
}

function itemName(order: Order, itemIndex: number, settings: ShopSettings): string {
  const item = order.items[itemIndex];
  if (!item) return '';
  return item.itemName?.en
    || settings.menuItems.find((menuItem) => menuItem.id === item.menuItemId)?.name.en
    || item.menuItemId;
}

function sizeText(order: Order, itemIndex: number): string {
  const item = order.items[itemIndex];
  if (!item) return '';
  return item.sizeSelection?.name.en || item.size || item.sizeId || '';
}

export interface OrderWorkbookSheet {
  data: SheetData;
  sheet: string;
  columns: {width?: number}[];
  stickyRowsCount: number;
  orientation?: 'landscape';
}

export function buildOrderWorkbookSheets(orders: Order[], settings: ShopSettings): OrderWorkbookSheet[] {
  const orderRows: SheetData = [
    [
      'Order No.', 'Order UID', 'Timestamp', 'Order Type', 'Table', 'Items Summary',
      'Quantity', 'Subtotal (RM)', 'Takeaway Fee (RM)', 'Tax (RM)', 'Total (RM)',
      'Status', 'Paid', 'Payment Method', 'Cloud Synced',
    ].map(headerCell),
    ...orders.map((order) => [
      textCell(order.order_id),
      textCell(order.local_order_id),
      textCell(order.timestamp),
      textCell(order.order_type),
      textCell(order.table_no),
      textCell(order.items_summary),
      integerCell(order.total_qty),
      numberCell(order.subtotal ?? order.total_amount - (order.tax_amount ?? 0) - (order.takeaway_fee ?? 0)),
      numberCell(order.takeaway_fee),
      numberCell(order.tax_amount),
      numberCell(order.total_amount),
      textCell(order.status),
      textCell(order.paid ? 'Yes' : 'No'),
      textCell(order.payment_method),
      textCell(order.synced ? 'Yes' : 'No'),
    ]),
  ];

  const itemRows: SheetData = [
    [
      'Order No.', 'Order UID', 'Timestamp', 'Item', 'Size', 'Options', 'Add-ons',
      'Quantity', 'Unit Price (RM)', 'Line Total (RM)',
    ].map(headerCell),
  ];

  for (const order of orders) {
    order.items.forEach((item, itemIndex) => {
      itemRows.push([
        textCell(order.order_id),
        textCell(order.local_order_id),
        textCell(order.timestamp),
        textCell(itemName(order, itemIndex, settings)),
        textCell(sizeText(order, itemIndex)),
        textCell(optionText(order, itemIndex)),
        textCell(addOnText(order, itemIndex)),
        integerCell(item.quantity),
        numberCell(item.unitPrice),
        numberCell(item.totalPrice),
      ]);
    });
  }

  return [
    {
      data: orderRows,
      sheet: 'Orders',
      stickyRowsCount: 1,
      orientation: 'landscape',
      columns: [12, 38, 20, 14, 12, 42, 10, 15, 18, 12, 14, 14, 10, 18, 14].map(width => ({width})),
    },
    {
      data: itemRows,
      sheet: 'Order Items',
      stickyRowsCount: 1,
      orientation: 'landscape',
      columns: [12, 38, 20, 26, 18, 34, 28, 10, 16, 16].map(width => ({width})),
    },
  ];
}

export async function exportOrdersXlsx(
  orders: Order[],
  settings: ShopSettings,
  filename: string,
): Promise<void> {
  const {default: writeExcelFile} = await import('write-excel-file/browser');
  const sheets = buildOrderWorkbookSheets(orders, settings);
  await writeExcelFile(sheets, {fontFamily: 'Arial', fontSize: 10}).toFile(filename);
}
