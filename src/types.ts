export type Language = 'en' | 'zh';

export interface LocalizedString {
  en: string;
  zh: string;
}

export interface MenuItem {
  id: string;
  name: LocalizedString;
  basePrice: number;
  image: string;
}

export type SizeOption = 'Small' | 'Big';

export type NoodleOption = 
  | 'Yellow Noodle' 
  | 'Bee Hoon' 
  | 'Kuey Teow' 
  | 'Rat Noodle' 
  | 'Hakka Mee' 
  | 'Wanton Mee';

export type AddOnOption = 
  | 'Fried Fu Chok' 
  | 'Fish Cake' 
  | 'Extra Fishball' 
  | 'Add Egg';

export interface CartItem {
  id: string; // unique cart item id
  menuItemId: string;
  size: SizeOption;
  noodleBases: NoodleOption[];
  addOns: AddOnOption[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type OrderType = 'Dine-in' | 'Takeaway';
export type OrderStatus = 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'QR Pay';

export interface Order {
  local_order_id: string;
  order_id: string; // e.g. JH-2046
  timestamp: string; // YYYY-MM-DD HH:mm:ss
  order_type: OrderType;
  table_no?: string;
  items_summary: string;
  items: CartItem[];
  total_qty: number;
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
