export type Language = 'en' | 'zh';

export interface LocalizedString {
  en: string;
  zh: string;
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

  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type OrderType = 'Dine-in' | 'Takeaway';
export type OrderStatus = 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'QR Pay';

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
  payment_method?: PaymentMethod;
  synced: boolean;
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
  shopNameEn: string;
  shopNameZh: string;
  coverPhoto: string;
  qrImage: string | null;
  menuItems: MenuItem[];
  enableTax: boolean;
  taxRate: number;
  takeawayFee: number;
}
