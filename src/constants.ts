import { MenuItem, ItemVariation } from './types';

export const SIZES: ItemVariation[] = [
  { id: 'Small', name: { en: 'Small', zh: '小碗', ms: 'Kecil' }, price: 0.00 },
  { id: 'Big', name: { en: 'Big', zh: '大碗', ms: 'Besar' }, price: 1.00 }
];

export const NOODLE_BASES: ItemVariation[] = [
  { id: 'Yellow Noodle', name: { en: 'Yellow Noodle', zh: '黄面', ms: 'Mi kuning' }, price: 0 },
  { id: 'Bee Hoon', name: { en: 'Bee Hoon', zh: '米粉', ms: 'Bihun' }, price: 0 },
  { id: 'Kuey Teow', name: { en: 'Kuey Teow', zh: '粿条', ms: 'Kuetiau' }, price: 0 },
  { id: 'Rat Noodle', name: { en: 'Rat Noodle', zh: '老鼠粉', ms: 'Mi tikus' }, price: 0 },
  { id: 'Hakka Mee', name: { en: 'Hakka Mee', zh: '客家面', ms: 'Mi Hakka' }, price: 0 },
  { id: 'Wanton Mee', name: { en: 'Wanton Mee', zh: '云吞面', ms: 'Mi wantan' }, price: 0 }
];

export const ADD_ONS: ItemVariation[] = [
  { id: 'Fried Fu Chok', name: { en: 'Fried Fu Chok', zh: '炸腐竹', ms: 'Fucuk goreng' }, price: 1.00 },
  { id: 'Fish Cake', name: { en: 'Fish Cake', zh: '鱼饼', ms: 'Kek ikan' }, price: 1.00 },
  { id: 'Extra Fishball', name: { en: 'Extra Fishball', zh: '多加鱼圆', ms: 'Bebola ikan tambahan' }, price: 1.00 },
  { id: 'Add Egg', name: { en: 'Add Egg', zh: '加蛋', ms: 'Tambah telur' }, price: 1.00 }
];

export const MENU_ITEMS: MenuItem[] = [
  {
    id: "m1",
    name: {en: "Laksa Without Kerang", zh: "叻沙(没血蛤)", ms: "Laksa tanpa kerang"},
    basePrice: 8.00,
    image: `${import.meta.env.BASE_URL}assets/demo-dish-1.jpg`,
    sizes: [...SIZES],
    noodleBases: [...NOODLE_BASES],
    addOns: [...ADD_ONS]
  },
  {
    id: "m2",
    name: {en: "Laksa With Kerang", zh: "叻沙(有血蛤)", ms: "Laksa dengan kerang"},
    basePrice: 10.00,
    image: `${import.meta.env.BASE_URL}assets/demo-dish-2.jpg`,
    sizes: [...SIZES],
    noodleBases: [...NOODLE_BASES],
    addOns: [...ADD_ONS]
  },
  {
    id: "m3",
    name: {en: "Special Fishball Noodle", zh: "西刀鱼丸粉", ms: "Mi bebola ikan istimewa"},
    basePrice: 8.00,
    image: `${import.meta.env.BASE_URL}assets/demo-dish-3.jpg`,
    sizes: [...SIZES],
    noodleBases: [...NOODLE_BASES],
    addOns: [...ADD_ONS]
  },
  {
    id: "m4",
    name: {en: "Mince Meat Noodle", zh: "肉碎老鼠粉", ms: "Mi daging cincang"},
    basePrice: 7.50,
    image: `${import.meta.env.BASE_URL}assets/demo-dish-4.jpg`,
    sizes: [...SIZES],
    noodleBases: [...NOODLE_BASES],
    addOns: [...ADD_ONS]
  }
];

// Google Apps Script URL — set in .env.local
export const GAS_URL = (import.meta as any).env?.VITE_GAS_URL || '';

// Google Sheet direct URL — set in .env.local
export const SHEET_URL = (import.meta as any).env?.VITE_SHEET_URL || '';
