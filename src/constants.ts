import { MenuItem, LocalizedString, SizeOption, NoodleOption, AddOnOption } from './types';

export const MENU_ITEMS: MenuItem[] = [
  { 
    id: "m1", 
    name: {en: "Laksa Without Kerang", zh: "叻沙(没血蛤)"}, 
    basePrice: 8.00,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuALw4raTmUulkKCk8_oo1mJ_VMT9Wc2ESVmT2VL0N55rPh6t4qerjFNjVt7naWbbaq_DgAWzbEbYVbxTM26gnsjyE0P7P6BfMmTRDlpNXvGU6ZZ15pPzKmPtKbcc98OfaqwJXoHYQREWrX9jhN7rmSOmxpenWmR_c_ZKaGB1OF75oM8-EO642PiTi_1Yg2VID-36P4CD3209wT6oBiGzVK-jZTDBOT0y6BwSbjKZsd7im5B7akDpA0dErqdTMvKmuKYQxDtmVooIs4Z"
  },
  { 
    id: "m2", 
    name: {en: "Laksa With Kerang", zh: "叻沙(有血蛤)"}, 
    basePrice: 10.00,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBqtIqdTTG8oYsZ7cqNewXdonwJ1Gv2PgPF67KZ6OBMirxT0RIra4XZ2gLgWVohkNnzFWSFaBfD48jhH5Ho7W85_V9nD800iOAqsPaC5oeAvVz5kd9WDEv_29NMME5cGLiGN6rs6tqxSiYmkFWWWvcgsIvZHjptAvoPwisAa0TAt-yTE4ncv299b46Zwbiup0hw21NQIKlQrAbqfld5spWJryCChkwEFxTEC7ftTDl2ecY19iKewAw9iFbi6mPnMrUh-D4SVIaCIAtf"
  },
  { 
    id: "m3", 
    name: {en: "Special Fishball Noodle", zh: "西刀鱼丸粉"}, 
    basePrice: 8.00,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAggIE14U8-HPavvP8e4pCFZxp_pKcfHU9fiSGwKivyaOB833ZxyZrotDNTOqv32cDsZyaH8Ron8HWEQR8aMArOmXVCvrG8tf6wZ6DLartsp3mhmaAdOOODJDLR62ZOVYP_Gr0RK8haJslHwh1eZn6g-0_87wn7HOAGM8CEZIECUjpTR0s_WaatTkY7leBnY_7FrMh1N9YF0sk4ZbhHcy50gfCHgMLqs6BQmlGJoGPa3wJ0MQuXkAcoxpYbEFQA3XkmKuVyJnVzhN0t"
  },
  { 
    id: "m4", 
    name: {en: "Mince Meat Noodle", zh: "肉碎老鼠粉"}, 
    basePrice: 7.50,
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuB0bTcChN56uUPBGEoznqJjfFR8khkmW5Xv0svcLI5yV8KDttqzdqW_nKXoLq73cZVBpjBok41AvaarM3XzV6aHYNTwX7vdI6IYtcVXoMFVbCTurKPZi8ijfwJ1UAubXMOmwb3TWWimFaInWLOqnphhhPZi0xPXetOOJuKA2ujcLigR2P0Wi7S1KpSv7RLn07MuDJXbbBVok8ZSZWA5U47z6x6XuMFqOAb91cr25tQLEMndWVeTPMlITt-Ec-hcKHxgHX9Qrfpuq8N5"
  }
];

export const SIZES: { id: SizeOption; name: LocalizedString; price: number }[] = [
  { id: 'Small', name: { en: 'Small', zh: '小碗' }, price: 0.00 },
  { id: 'Big', name: { en: 'Big', zh: '大碗' }, price: 1.00 }
];

export const NOODLE_BASES: { id: NoodleOption; name: LocalizedString }[] = [
  { id: 'Yellow Noodle', name: { en: 'Yellow Noodle', zh: '黄面' } },
  { id: 'Bee Hoon', name: { en: 'Bee Hoon', zh: '米粉' } },
  { id: 'Kuey Teow', name: { en: 'Kuey Teow', zh: '粿条' } },
  { id: 'Rat Noodle', name: { en: 'Rat Noodle', zh: '老鼠粉' } },
  { id: 'Hakka Mee', name: { en: 'Hakka Mee', zh: '客家面' } },
  { id: 'Wanton Mee', name: { en: 'Wanton Mee', zh: '云吞面' } }
];

export const ADD_ONS: { id: AddOnOption; name: LocalizedString; price: number }[] = [
  { id: 'Fried Fu Chok', name: { en: 'Fried Fu Chok', zh: '炸腐竹' }, price: 1.00 },
  { id: 'Fish Cake', name: { en: 'Fish Cake', zh: '鱼饼' }, price: 1.00 },
  { id: 'Extra Fishball', name: { en: 'Extra Fishball', zh: '多加鱼圆' }, price: 1.00 },
  { id: 'Add Egg', name: { en: 'Add Egg', zh: '加蛋' }, price: 1.00 }
];

// Google Apps Script URL — set in .env.local
export const GAS_URL = (import.meta as any).env?.VITE_GAS_URL || '';

// Google Sheet direct URL — set in .env.local
export const SHEET_URL = (import.meta as any).env?.VITE_SHEET_URL || '';
