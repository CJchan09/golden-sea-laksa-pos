import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { formatCurrency } from '../utils';
import { getCartItemDisplay } from '../domain/cart-item-display';
import { tr, orderTypeLabel, orderStatusLabel, paymentLabel } from '../i18n';
import { CreditCard, X, XCircle } from 'lucide-react';
import type { PaymentMethod } from '../types';

export default function CashierActive() {
  const { orders, updateOrderStatus, markAsPaid, settings, language } = useStore();
  const [payingId,setPayingId]=useState<string>();
  const [method,setMethod]=useState<PaymentMethod>();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const lock=useRef(false);
  const target=new URLSearchParams(window.location.hash.split('?')[1]).get('order');
  const unpaid=orders.filter(o=>!o.paid&&o.status!=='Cancelled').sort((a,b)=>a.local_order_id===target?-1:b.local_order_id===target?1:a.timestamp.localeCompare(b.timestamp));
  const targetOrder=orders.find(o=>o.local_order_id===target);
  const paying=orders.find(o=>o.local_order_id===payingId);
  useEffect(()=>{if(target)document.getElementById('order-'+target)?.scrollIntoView({block:'center'});},[target]);
  const collect=async()=>{
    if(!payingId||!method||lock.current)return;
    lock.current=true;setBusy(true);setError('');
    try{if(!await markAsPaid(payingId,method))throw new Error('save');setPayingId(undefined);setMethod(undefined);}
    catch{setError(tr(language,'Payment could not be saved. Please try again.','收款未能保存，请重试。','Bayaran tidak dapat disimpan. Cuba lagi.'));}
    finally{lock.current=false;setBusy(false);}
  };
  return <div className="space-y-4">
    <h1 className="text-xl font-bold">{tr(language,'Payments','待收款','Bayaran')} ({unpaid.length})</h1>
    <p className="text-gray-500 dark:text-gray-400">{tr(language,'Orders stay here until payment is confirmed.','确认收款前，订单会留在这里。','Pesanan kekal di sini sehingga bayaran disahkan.')}</p>
    {targetOrder&&(targetOrder.paid||targetOrder.status==='Cancelled')&&<p className="rounded-xl border border-gray-300 p-4 dark:border-zinc-700">{tr(language,'Order','订单','Pesanan')} {targetOrder.order_id} · {targetOrder.status==='Cancelled'?orderStatusLabel(language,targetOrder.status):tr(language,'Payment already received','已收款','Bayaran telah diterima')}</p>}
    {error&&<p role="alert" className="text-red-600">{error}</p>}
    {!unpaid.length&&<p className="py-12 text-center text-gray-500">{tr(language,'No payment due','暂无待收款订单','Tiada bayaran tertunggak')}</p>}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{unpaid.map(order=><article id={'order-'+order.local_order_id} key={order.local_order_id} className={'min-w-0 rounded-2xl border bg-white p-4 dark:bg-zinc-900 '+(order.local_order_id===target?'border-primary ring-2 ring-primary':'border-gray-200 dark:border-zinc-800')}>
      <div className="flex flex-wrap justify-between gap-2"><h2 className="text-xl font-bold">{order.order_id}</h2><strong className="text-xl text-emphasis dark:text-primary">{formatCurrency(order.total_amount)}</strong></div>
      <p className="my-2 text-sm text-gray-500 dark:text-gray-400">{orderTypeLabel(language,order.order_type)}{order.table_no?' · '+tr(language,'Table','桌号','Meja')+' '+order.table_no:''} · {orderStatusLabel(language,order.status)}</p>
      <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">{order.timestamp}</p>
      {order.customer&&<div className="mb-3 space-y-1 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
        <p className="break-words font-semibold">{tr(language,'Customer','顾客','Pelanggan')}: {order.customer.name} · {order.customer.phone}</p>
        <p className="break-words">{tr(language,'Address','地址','Alamat')}: {order.customer.address}</p>
        {order.customer.note&&<p className="break-words">{tr(language,'Note','备注','Nota')}: {order.customer.note}</p>}
      </div>}
      <ul className="mb-4 space-y-2">{order.items.length?order.items.map(item=>{const display=getCartItemDisplay(item,settings.menuItems.find(m=>m.id===item.menuItemId),language);return <li key={item.id}><strong>{item.quantity} × {display.itemName}</strong><p className="text-sm text-gray-500 dark:text-gray-400">{display.details.join(' • ')}</p></li>;}):<li>{order.items_summary}</li>}</ul>
      <div className="flex gap-2"><button onClick={()=>{setPayingId(order.local_order_id);setMethod(undefined);setError('');}} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-3 font-bold text-white"><CreditCard size={18}/>{tr(language,'Collect payment','收款','Terima bayaran')}</button><button aria-label={tr(language,'Cancel order','取消订单','Batalkan pesanan')} onClick={async()=>{if(window.confirm(tr(language,'Cancel this order?','取消此订单？','Batalkan pesanan ini?'))&&!await updateOrderStatus(order.local_order_id,'Cancelled'))setError(tr(language,'Could not save cancellation.','取消未能保存。','Pembatalan tidak dapat disimpan.'));}} className="flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-red-50 px-3 text-red-600 dark:bg-red-950/40"><XCircle size={20}/></button></div>
    </article>)}</div>
    {paying&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div role="dialog" aria-modal="true" aria-labelledby="collect-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 dark:bg-zinc-900">
      <div className="flex items-center justify-between"><h2 id="collect-title" className="text-xl font-bold">{tr(language,'Payment','收款','Bayaran')} {paying.order_id}</h2><button disabled={busy} aria-label={tr(language,'Close','关闭','Tutup')} onClick={()=>setPayingId(undefined)} className="flex min-h-12 min-w-12 items-center justify-center"><X/></button></div>
      <p className="my-4 text-center text-3xl font-bold text-emphasis dark:text-primary">{formatCurrency(paying.total_amount)}</p>
      <div className="grid grid-cols-2 gap-3">{(['Cash','QR Pay'] as PaymentMethod[]).map(m=><button key={m} aria-pressed={method===m} onClick={()=>setMethod(m)} className={'min-h-12 rounded-xl border-2 px-3 py-4 font-bold '+(method===m?'border-primary bg-primary/20':'border-gray-300 dark:border-zinc-700')}>{paymentLabel(language,m)}</button>)}</div>
      {method==='QR Pay'&&settings.qrImage&&<img src={settings.qrImage} alt={paymentLabel(language,method)} className="mx-auto mt-4 max-h-64 max-w-full object-contain"/>}
      {method&&<><p className="my-4">{tr(language,'Confirm this payment has arrived.','请确认款项已收到或已到账。','Sahkan bayaran ini telah diterima.')}</p><button disabled={busy} onClick={collect} className="min-h-12 w-full rounded-xl bg-emerald-700 px-4 py-4 font-bold text-white disabled:opacity-40">{busy?tr(language,'Saving…','保存中…','Menyimpan…'):tr(language,'Confirm received','确认已收款','Sahkan diterima')}</button></>}
      {error&&<p role="alert" className="mt-3 text-red-600">{error}</p>}
    </div></div>}
  </div>;
}
