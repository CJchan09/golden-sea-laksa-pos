import type { Language, OrderStatus, OrderType, PaymentMethod } from './types';

/** One selected language, with existing merchant text as fallback. */
export function localized(value: Partial<Record<Language, string>> | undefined, language: Language): string {
  for (const key of [language, 'en', 'zh', 'ms'] as Language[]) {
    const candidate = value?.[key]?.trim();
    if (candidate) return candidate;
  }
  return '';
}

export function tr(language: Language, en: string, zh: string, ms: string): string {
  return { en, zh, ms }[language] || en;
}

export const orderTypeLabel = (lang: Language, type: OrderType) => type === 'Takeaway'
  ? tr(lang, 'Takeaway', '打包', 'Bungkus') : tr(lang, 'Dine-in', '堂食', 'Makan di sini');
export const paymentLabel = (lang: Language, method?: PaymentMethod) => method === 'QR Pay'
  ? tr(lang, 'QR Pay', '扫码支付', 'Bayaran QR') : method === 'Cash'
    ? tr(lang, 'Cash', '现金', 'Tunai') : tr(lang, 'Unpaid', '未付款', 'Belum dibayar');
export const orderStatusLabel = (lang: Language, status: OrderStatus) => ({
  Pending: tr(lang, 'Waiting', '待制作', 'Menunggu'),
  Preparing: tr(lang, 'Preparing', '制作中', 'Sedang disediakan'),
  Completed: tr(lang, 'Ready', '已出餐', 'Siap'),
  Cancelled: tr(lang, 'Cancelled', '已取消', 'Dibatalkan'),
})[status];
