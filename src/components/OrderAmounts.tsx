import { formatCurrency } from '../utils';
import { tr } from '../i18n';
import type { Language } from '../types';
export default function OrderAmounts({ language, subtotal, takeawayFee, taxAmount, totalAmount }: {
  language: Language; subtotal: number; takeawayFee: number; taxAmount: number; totalAmount: number;
}) {
  return <div className="space-y-2 py-3">
    <div className="flex justify-between gap-3 text-sm text-gray-500 dark:text-gray-400"><span>{tr(language,'Subtotal','小计','Jumlah kecil')}</span><span>{formatCurrency(subtotal)}</span></div>
    {takeawayFee > 0 && <div className="flex justify-between gap-3 text-sm text-gray-500 dark:text-gray-400"><span>{tr(language,'Packing fee','打包费','Caj bungkus')}</span><span>{formatCurrency(takeawayFee)}</span></div>}
    {taxAmount > 0 && <div className="flex justify-between gap-3 text-sm text-gray-500 dark:text-gray-400"><span>{tr(language,'Tax','税费','Cukai')}</span><span>{formatCurrency(taxAmount)}</span></div>}
    <div className="flex flex-wrap justify-between gap-3 border-t border-gray-200 pt-3 text-xl font-bold dark:border-zinc-700"><span>{tr(language,'Total','总计','Jumlah')}</span><span className="text-emphasis dark:text-primary">{formatCurrency(totalAmount)}</span></div>
  </div>;
}
