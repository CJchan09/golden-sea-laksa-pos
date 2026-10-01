import type { OptionGroup, OrderLineOptionSnapshot } from './data/app-schema';

export type Language = 'en' | 'zh' | 'ms';

export interface LocalizedString {
  en: string;
  zh: string;
  ms?: string;
}

export interface ItemVariation {
  id: string;
  name: LocalizedString;
  price: number;
}

export interface MenuItem {
  id: string;
  name: LocalizedString;
  basePrice: number;
  image: string;
  sizes: ItemVariation[];
  noodleBases: ItemVariation[];
  addOns: ItemVariation[];
  /**
   * Generic, merchant-defined choices such as rice type, protein or spice.
   *
   * `undefined` means this item still uses the legacy `noodleBases` field and
   * will be adapted once. An explicit empty array means the merchant chose to
   * have no generic option groups, so it must not be backfilled again.
   */
  optionGroups?: OptionGroup[];
}

// Keeping old string union types for backward compatibility on historical orders
export type SizeOption = 'Small' | 'Big';
export type NoodleOption = 'Yellow Noodle' | 'Bee Hoon' | 'Kuey Teow' | 'Rat Noodle' | 'Hakka Mee' | 'Wanton Mee';
export type AddOnOption = 'Fried Fu Chok' | 'Fish Cake' | 'Extra Fishball' | 'Add Egg';

export interface CartItem {
  id: string;
  menuItemId: string;

  sizeId: string;
  size?: SizeOption; // legacy

  noodleBaseIds: string[];
  noodleBases?: NoodleOption[]; // legacy

  addOnIds: string[];
  addOns?: AddOnOption[]; // legacy

  /** Immutable display snapshots for new carts and orders. */
  itemName?: LocalizedString;
  sizeSelection?: ItemVariation;
  optionSelections?: OrderLineOptionSnapshot[];
  addOnSelections?: ItemVariation[];

  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type OrderType = 'Dine-in' | 'Takeaway';
export type OrderStatus = 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'QR Pay';

export interface CustomerContact {
  name: string;
  phone: string;
  address: string;
  note?: string;
}

/** Photo-free record of a menu actually issued by this shop. */
export interface IssuedMenuRecord {
  menuId: string;
  createdAt: string;
  menuItems: MenuItem[];
  enableTax: boolean;
  taxRate: number;
  takeawayFee: number;
}

export interface Order {
  local_order_id: string;
  order_id: string;
  timestamp: string;
  order_type: OrderType;
  table_no?: string;
  items_summary: string;
  items: CartItem[];
  total_qty: number;

  subtotal?: number;
  tax_amount?: number;
  takeaway_fee?: number;
  total_amount: number;

  status: OrderStatus;
  paid: boolean;
  /** Actual receipt time. Absent on older paid orders. */
  paid_at?: string;
  payment_method?: PaymentMethod;
  synced: boolean;
  customer?: CustomerContact;
  sourceRequestId?: string;
  sourceFingerprint?: string;
  sourceMenuId?: string;
}

export interface DailyStat {
  date: string;
  bowls: number;
  revenue: number;
  orders: number;
}

export interface SalesStats {
  totals: { bowls: number; revenue: number; orders: number };
  daily: DailyStat[];
}

export interface ShopSettings {
  shopId?: string;
  whatsappNumber?: string;
  issuedMenus?: IssuedMenuRecord[];
  shopNameEn: string;
  shopNameZh: string;
  shopNameMs?: string;
  coverPhoto: string;
  qrImage: string | null;
  menuItems: MenuItem[];
  enableTax: boolean;
  taxRate: number;
  takeawayFee: number;
  defaultOrderType?: OrderType;
}
