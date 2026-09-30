import { useRef, useState } from 'react';
import { useStore } from '../store';
import { calculateOrderAmounts } from '../domain/order-amounts';
import { tr, orderTypeLabel } from '../i18n';
import type { CartItem, OrderType } from '../types';
import OrderAmounts from './OrderAmounts';
import CartLines from './CartLines';
import CustomizationModal from './CustomizationModal';
import LanguageSelector from './LanguageSelector';
import { ArrowLeft } from 'lucide-react';

export default function CustomerCheckout({ onBack }: { onBack: () => void }) {
  const { language, changeLanguage, cart, submitOrder, settings, updateCartItem, saveStatus } = useStore();
  const [orderType,setOrderType] = useState<OrderType>(settings.defaultOrderType || 'Dine-in');
  const [tableNo,setTableNo] = useState('');
  const [editingItem,setEditingItem] = useState<CartItem>();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const lock = useRef(false);
  const amounts = calculateOrderAmounts(cart,settings,orderType);
  const finish = async () => {
    if(lock.current || !cart.length || saveStatus==='saving') return;
    setError('');
    if(orderType==='Dine-in'&&!tableNo.trim()){setError(tr(language,'Enter your table number.','请输入桌号。','Masukkan nombor meja.'));return;}
    lock.current=true;setBusy(true);
    try {
      const id=await submitOrder(orderType,tableNo.trim());
      if(!id)throw new Error('save');
      window.location.hash='#/order/receipt/'+encodeURIComponent(id);
    } catch {setError(tr(language,'Could not save the order. Please try again. Your cart is kept.','订单未能保存，请重试。购物车已保留。','Pesanan tidak dapat disimpan. Cuba lagi. Troli dikekalkan.'));}
    finally {lock.current=false;setBusy(false);}
  };
  const menu=editingItem&&settings.menuItems.find(m=>m.id===editingItem.menuItemId);
  return <div className="min-h-dvh">
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white p-4 dark:border-zinc-800 dark:bg-black">
      <button onClick={onBack} className="flex min-h-12 items-center gap-2 font-semibold"><ArrowLeft size={20}/>{tr(language,'Menu','菜单','Menu')}</button>
      <LanguageSelector language={language} onChange={changeLanguage}/>
    </header>
    <main className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><h1 className="mb-5 text-2xl font-bold">{tr(language,'Check your order','核对订单','Semak pesanan anda')}</h1><CartLines onEdit={setEditingItem}/></section>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-lg font-bold">{tr(language,'Order type','订单类型','Jenis pesanan')}</h2>
        <div className="mb-4 grid grid-cols-2 gap-2">{(['Dine-in','Takeaway'] as OrderType[]).map(type=><button key={type} aria-pressed={orderType===type} onClick={()=>setOrderType(type)} className={`min-h-12 rounded-xl px-3 py-3 font-semibold ${orderType===type?'bg-primary text-on-primary':'bg-gray-100 dark:bg-zinc-800'}`}>{orderTypeLabel(language,type)}</button>)}</div>
        {orderType==='Dine-in'&&<label className="block font-semibold">{tr(language,'Table number','桌号','Nombor meja')}<input value={tableNo} onChange={e=>setTableNo(e.target.value)} className="my-2 min-h-12 w-full rounded-xl border border-gray-300 bg-transparent px-3 dark:border-zinc-700"/></label>}
        <OrderAmounts language={language} {...amounts}/>
        <p className="mb-4 text-gray-500 dark:text-gray-400">{tr(language,'After confirming, hand this phone back to the staff. Staff will collect payment.','确认后请把电话交还店员，由店员收款。','Selepas pengesahan, pulangkan telefon kepada pekerja untuk bayaran.')}</p>
        <button disabled={!cart.length||busy||saveStatus==='saving'} onClick={finish} className="min-h-12 w-full rounded-xl bg-primary px-4 py-4 text-lg font-bold text-on-primary disabled:opacity-40">{busy?tr(language,'Saving…','保存中…','Menyimpan…'):tr(language,'Confirm order','确认下单','Sahkan pesanan')}</button>
        {error&&<p role="alert" className="mt-3 text-red-600">{error}</p>}
      </section>
    </main>
    {editingItem&&menu&&<CustomizationModal item={menu} initialCartItem={editingItem} language={language} onClose={()=>setEditingItem(undefined)} onAdd={item=>updateCartItem(editingItem.id,item)}/>}
  </div>;
}
