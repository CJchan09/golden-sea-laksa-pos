import { useRef, useState } from 'react';
import { useStore } from '../store';
import type { CartItem, MenuItem, OrderType, PaymentMethod } from '../types';
import { formatCurrency } from '../utils';
import { tr, localized, orderTypeLabel, paymentLabel } from '../i18n';
import { calculateOrderAmounts } from '../domain/order-amounts';
import CustomizationModal from './CustomizationModal';
import OrderAmounts from './OrderAmounts';
import CartLines from './CartLines';
import { ShoppingCart, CreditCard, X } from 'lucide-react';

export default function CashierRegister() {
  const { language, cart, addToCart, updateCartItem, clearCart, submitOrder, settings, saveStatus } = useStore();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [editingItem, setEditingItem] = useState<CartItem | undefined>();
  const [orderType, setOrderType] = useState<OrderType>(settings.defaultOrderType || 'Dine-in');
  const [tableNo, setTableNo] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const amounts = calculateOrderAmounts(cart, settings, orderType);
  const valid = () => {
    setMessage(''); setError('');
    if (!cart.length || busy || saveStatus === 'saving') return false;
    if (orderType === 'Dine-in' && !tableNo.trim()) { setError(tr(language,'Enter a table number.','请输入桌号。','Masukkan nombor meja.')); return false; }
    return true;
  };
  const place = async (paidMethod?: PaymentMethod) => {
    if (lock.current || !valid()) return;
    lock.current = true; setBusy(true);
    try {
      const id = await submitOrder(orderType, tableNo.trim(), paidMethod);
      if (!id) throw new Error('save');
      setShowPayment(false); setMethod(null); setTableNo('');
      setMessage(paidMethod ? tr(language,'Order saved. Payment received.','订单已保存，收款已确认。','Pesanan disimpan. Bayaran diterima.') : tr(language,'Sent to kitchen. Payment is still due.','订单已送厨房，尚未付款。','Dihantar ke dapur. Bayaran belum diterima.'));
    } catch { setError(tr(language,'Could not save the order. Your cart is kept.','订单未能保存，购物车已保留。','Pesanan tidak dapat disimpan. Troli dikekalkan.')); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="register-layout">
    <section className="register-menu-area min-w-0 flex-1">
      <h2 className="mb-4 text-xl font-bold">{tr(language,'Register','收银台','Daftar pesanan')}</h2>
      <div className="register-menu-grid">
        {settings.menuItems.map(item => <button type="button" key={item.id} onClick={() => { setEditingItem(undefined); setSelectedItem(item); }} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm hover:border-primary dark:border-zinc-800 dark:bg-zinc-900">
          <img src={item.image} alt={localized(item.name,language)} className="aspect-[4/3] max-h-52 w-full object-cover"/>
          <div className="flex flex-1 flex-col justify-between gap-2 p-3 sm:p-4"><span className="font-bold leading-snug break-words">{localized(item.name,language)}</span><strong className="text-emphasis dark:text-primary">{formatCurrency(item.basePrice)}</strong></div>
        </button>)}
      </div>
    </section>
    <aside className="register-cart min-w-0 rounded-2xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 p-4 dark:border-zinc-800"><h3 className="flex items-center gap-2 font-bold"><ShoppingCart size={20}/>{tr(language,'Current order','当前订单','Pesanan semasa')}</h3>{cart.length > 0 && <button disabled={busy || saveStatus==='saving'} className="min-h-12 px-2 text-sm text-red-600" onClick={async () => { if (window.confirm(tr(language,'Clear this cart?','清空购物车？','Kosongkan troli?')) && !await clearCart()) setError(tr(language,'Could not save cart changes.','购物车修改未能保存。','Perubahan troli tidak dapat disimpan.')); }}>{tr(language,'Clear','清空','Kosongkan')}</button>}</div>
      <div className="p-4"><CartLines onEdit={item => { const menu = settings.menuItems.find(m=>m.id===item.menuItemId); if(menu){setEditingItem(item);setSelectedItem(menu);} }}/></div>
      <div className="border-t border-gray-200 p-4 dark:border-zinc-800">
        <div className="mb-3 grid grid-cols-2 gap-2">{(['Dine-in','Takeaway'] as OrderType[]).map(type => <button key={type} aria-pressed={orderType===type} onClick={()=>setOrderType(type)} className={`min-h-12 rounded-xl px-2 py-2 font-semibold ${orderType===type?'bg-primary text-on-primary':'bg-gray-100 dark:bg-zinc-800'}`}>{orderTypeLabel(language,type)}</button>)}</div>
        {orderType==='Dine-in' && <input aria-label={tr(language,'Table number','桌号','Nombor meja')} placeholder={tr(language,'Table number','桌号','Nombor meja')} value={tableNo} onChange={e=>setTableNo(e.target.value)} className="mb-2 min-h-12 w-full rounded-xl border border-gray-300 bg-transparent px-3 dark:border-zinc-700"/>}
        <OrderAmounts language={language} {...amounts}/>
        <button disabled={!cart.length||busy||saveStatus==='saving'} onClick={()=>{if(valid()){setMethod(null);setShowPayment(true);}}} className="mb-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 font-bold text-on-primary disabled:opacity-40"><CreditCard size={20}/>{tr(language,'Pay now','现在收款','Bayar sekarang')}</button>
        <button disabled={!cart.length||busy||saveStatus==='saving'} onClick={()=>place()} className="min-h-12 w-full rounded-xl border border-gray-300 px-3 py-3 font-semibold disabled:opacity-40 dark:border-zinc-700">{busy?tr(language,'Saving…','保存中…','Menyimpan…'):tr(language,'Send to kitchen · Pay later','送厨房 · 稍后付款','Hantar ke dapur · Bayar kemudian')}</button>
        <div aria-live="polite" className="mt-3">{message&&<p className="text-green-700 dark:text-green-400">{message}</p>}{error&&<p role="alert" className="text-red-600">{error}</p>}</div>
      </div>
    </aside>
    {selectedItem&&<CustomizationModal item={selectedItem} initialCartItem={editingItem} language={language} onClose={()=>{setSelectedItem(null);setEditingItem(undefined);}} onAdd={item=>editingItem?updateCartItem(editingItem.id,item):addToCart(item)}/>}
    {showPayment&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div role="dialog" aria-modal="true" aria-labelledby="register-pay-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3"><h3 id="register-pay-title" className="text-xl font-bold">{tr(language,'Payment','收款','Bayaran')}</h3><button disabled={busy} aria-label={tr(language,'Close','关闭','Tutup')} onClick={()=>setShowPayment(false)} className="flex min-h-12 min-w-12 items-center justify-center"><X/></button></div>
      <OrderAmounts language={language} {...amounts}/>
      <div className="grid grid-cols-2 gap-3">{(['Cash','QR Pay'] as PaymentMethod[]).map(m=><button key={m} aria-pressed={method===m} onClick={()=>setMethod(m)} className={`min-h-12 rounded-xl border-2 px-3 py-4 font-bold ${method===m?'border-primary bg-primary/20':'border-gray-300 dark:border-zinc-700'}`}>{paymentLabel(language,m)}</button>)}</div>
      {method==='QR Pay'&&settings.qrImage&&<img src={settings.qrImage} alt={paymentLabel(language,method)} className="mx-auto mt-4 max-h-64 max-w-full object-contain"/>}
      {method&&<><p className="my-4 text-center">{tr(language,'Confirm that this payment has arrived.','请确认款项已收到或已到账。','Sahkan bayaran ini telah diterima.')}</p><button disabled={busy} onClick={()=>place(method)} className="min-h-12 w-full rounded-xl bg-emerald-700 px-4 py-4 font-bold text-white disabled:opacity-40">{busy?tr(language,'Saving…','保存中…','Menyimpan…'):tr(language,'Confirm received & send to kitchen','确认收款并送厨房','Sahkan diterima & hantar ke dapur')}</button></>}
      {error&&<p role="alert" className="mt-3 text-red-600">{error}</p>}
    </div></div>}
  </div>;
}
