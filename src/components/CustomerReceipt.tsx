import { useStore } from '../store';
import { tr, orderTypeLabel, paymentLabel, orderStatusLabel } from '../i18n';
import { formatCurrency } from '../utils';
import { getCartItemDisplay } from '../domain/cart-item-display';
import OrderAmounts from './OrderAmounts';
import LanguageSelector from './LanguageSelector';

export default function CustomerReceipt() {
  const { orders, settings, language, changeLanguage } = useStore();
  const id=decodeURIComponent(window.location.hash.split('/receipt/')[1]?.split('?')[0]||'');
  const order=orders.find(o=>o.local_order_id===id);
  if(!order)return <div className="p-6 text-center"><p>{tr(language,'Order not found.','找不到订单。','Pesanan tidak dijumpai.')}</p><a className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-primary px-4 font-bold text-on-primary" href="#/cashier/active">{tr(language,'Staff view','店员操作','Paparan pekerja')}</a></div>;
  return <div className="mx-auto max-w-3xl p-4 sm:p-6">
    <div className="mb-5 flex flex-wrap justify-end gap-3"><LanguageSelector language={language} onChange={changeLanguage}/></div>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-2 font-bold text-green-700 dark:text-green-400">{tr(language,'Order saved','订单已保存','Pesanan disimpan')}</p>
      <h1 className="text-3xl font-bold">{tr(language,'Order','订单','Pesanan')} {order.order_id}</h1>
      <p className="my-3 text-xl font-bold text-emphasis dark:text-primary">{order.paid?paymentLabel(language,order.payment_method):tr(language,'Unpaid · Hand this phone back to staff','未付款 · 请交还电话给店员','Belum dibayar · Pulangkan telefon kepada pekerja')}</p>
      <p className="mb-5 text-gray-500 dark:text-gray-400">{orderTypeLabel(language,order.order_type)}{order.table_no?' · '+tr(language,'Table','桌号','Meja')+' '+order.table_no:''} · {orderStatusLabel(language,order.status)}</p>
      <ul className="space-y-4">{order.items.map(item=>{const display=getCartItemDisplay(item,settings.menuItems.find(m=>m.id===item.menuItemId),language);return <li key={item.id} className="border-b border-gray-200 pb-4 dark:border-zinc-700"><div className="flex flex-wrap justify-between gap-3"><strong>{item.quantity} × {display.itemName}</strong><strong>{formatCurrency(item.totalPrice)}</strong></div><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{display.details.join(' • ')}</p></li>;})}</ul>
      <OrderAmounts language={language} subtotal={order.subtotal??order.total_amount} takeawayFee={order.takeaway_fee||0} taxAmount={order.tax_amount||0} totalAmount={order.total_amount}/>
      <a className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 py-4 font-bold text-on-primary" href={'#/cashier/active?order='+encodeURIComponent(order.local_order_id)}>{tr(language,'Staff: view this order & collect payment','店员：查看此单并收款','Pekerja: lihat pesanan & terima bayaran')}</a>
      <a className="mt-3 flex min-h-12 items-center justify-center rounded-xl border border-gray-300 px-4 py-3 font-semibold dark:border-zinc-700" href="#/order">{tr(language,'Start next customer order','下一位顾客点单','Pesanan pelanggan seterusnya')}</a>
    </section>
  </div>;
}
