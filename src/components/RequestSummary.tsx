import type { CartItem, CustomerContact, Language, ShopSettings } from '../types';
import { getCartItemDisplay } from '../domain/cart-item-display';
import { calculateOrderAmounts } from '../domain/order-amounts';
import { formatCurrency } from '../utils';
import { tr } from '../i18n';
export default function RequestSummary({ cart, settings, language, customer }: {
  cart: CartItem[]; settings: ShopSettings; language: Language; customer?: CustomerContact;
}) {
  const t = (en: string, zh: string, ms: string) => tr(language, en, zh, ms);
  const amounts = calculateOrderAmounts(cart, settings, 'Takeaway');
  return <div className="space-y-4">
    {cart.map(item => {
      const display = getCartItemDisplay(item, settings.menuItems.find(m => m.id === item.menuItemId), language);
      return <div key={item.id} className="border-b border-zinc-200 pb-3 dark:border-zinc-700">
        <div className="flex flex-wrap justify-between gap-2 font-bold"><span>{item.quantity} × {display.itemName}</span><span>{formatCurrency(item.totalPrice)}</span></div>
        {display.details.length > 0 && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{display.details.join(' · ')}</p>}
      </div>;
    })}
    <dl className="space-y-2">
      {[[t('Subtotal', '商品小计', 'Subjumlah'), amounts.subtotal], [t('Packing fee', '打包费', 'Caj bungkus'), amounts.takeawayFee], [t('Tax', '税费', 'Cukai'), amounts.taxAmount]].map(([name, amount]) => <div key={name as string} className="flex flex-wrap justify-between gap-2"><dt>{name}</dt><dd>{formatCurrency(amount as number)}</dd></div>)}
      <div className="flex flex-wrap justify-between gap-2 text-xl font-bold"><dt>{t('Total due', '应收总额', 'Jumlah perlu dibayar')}</dt><dd>{formatCurrency(amounts.totalAmount)}</dd></div>
    </dl>
    {customer && <div className="space-y-2 rounded-xl bg-zinc-100 p-4 dark:bg-zinc-800">
      <p><strong>{t('Name', '姓名', 'Nama')}: </strong>{customer.name}</p>
      <p><strong>{t('Phone', '电话', 'Telefon')}: </strong>{customer.phone}</p>
      <p className="whitespace-pre-wrap break-words"><strong>{t('Address', '地址', 'Alamat')}: </strong>{customer.address}</p>
      {customer.note && <p className="whitespace-pre-wrap break-words"><strong>{t('Note', '备注', 'Nota')}: </strong>{customer.note}</p>}
    </div>}
  </div>;
}
