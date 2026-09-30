import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { getCartItemDisplay } from '../domain/cart-item-display';
import { tr, orderTypeLabel, orderStatusLabel } from '../i18n';
import LanguageSelector from './LanguageSelector';
import { ArrowLeft, CheckCircle, ChefHat, Clock, CreditCard } from 'lucide-react';

function getElapsedMinutes(timestamp: string): number {
  const orderTime = new Date(timestamp.replace(' ', 'T'));
  const now = new Date();
  return Math.floor((now.getTime() - orderTime.getTime()) / 60000);
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'square';
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Audio not available
  }
}

interface Props {
  embedded?: boolean;
  onGoToPayments?: () => void;
}

export default function KitchenDisplay({embedded = false, onGoToPayments}: Props) {
  const { orders, updateOrderStatus, settings, language, changeLanguage } = useStore();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const completeLock = useRef(false);
  const [, setTick] = useState(0);
  const [completedUnpaidOrder, setCompletedUnpaidOrder] = useState<{orderId: string; id: string} | null>(null);
  const prevCountRef = useRef(0);

  const activeOrders = [...orders]
    .filter(o => o.status === 'Pending' || o.status === 'Preparing')
    .sort((a, b) => {
      const timeA = new Date(a.timestamp.replace(' ', 'T')).getTime();
      const timeB = new Date(b.timestamp.replace(' ', 'T')).getTime();
      return timeA - timeB; // Oldest first
    });

  // Tick every second to update elapsed time
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Play beep when new orders come in
  useEffect(() => {
    if (activeOrders.length > prevCountRef.current && prevCountRef.current > 0) {
      playBeep();
    }
    prevCountRef.current = activeOrders.length;
  }, [activeOrders.length]);

  const handleCompleteOrder = async (order: typeof orders[0]) => {
    if (completeLock.current) return;
    completeLock.current = true;
    setSaving(true); setSaveError('');
    try {
      if (!await updateOrderStatus(order.local_order_id, 'Completed')) throw new Error('save');
      if (!order.paid) setCompletedUnpaidOrder({orderId: order.order_id, id: order.local_order_id});
    } catch { setSaveError(tr(language,'Could not save. Please try again.','未能保存，请重试。','Tidak dapat disimpan. Cuba lagi.')); }
    finally { completeLock.current = false; setSaving(false); }
  };

  const goToPayments = () => {
    window.location.hash = '#/cashier/active' + (completedUnpaidOrder ? '?order=' + encodeURIComponent(completedUnpaidOrder.id) : '');
  };

  const paymentHandoff = completedUnpaidOrder && (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
      <p className="font-semibold">{tr(language,`Order ${completedUnpaidOrder.orderId} is ready and unpaid.`,`订单 ${completedUnpaidOrder.orderId} 已出餐，尚未付款。`,`Pesanan ${completedUnpaidOrder.orderId} siap dan belum dibayar.`)}</p>
      <button type="button" onClick={goToPayments} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 font-bold text-zinc-950 hover:bg-amber-400">
        <CreditCard aria-hidden="true" className="h-5 w-5" />
        {tr(language,'Go to payment','前往收款','Pergi ke bayaran')}
      </button>
    </div>
  );

  if (activeOrders.length === 0) {
    return (
      <section className={`${embedded ? 'min-h-[52dvh] rounded-2xl' : 'min-h-dvh'} relative bg-zinc-950 flex flex-col items-center justify-center p-6 text-center`}>
        {paymentHandoff}
        {!embedded && (
          <a
            href="#/cashier"
            className="pt-safe absolute left-4 top-4 flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-800"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            {tr(language,'Staff','收银台','Pekerja')}
          </a>
        )}
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-zinc-800 bg-zinc-900 sm:h-32 sm:w-32">
          <ChefHat aria-hidden="true" className="h-12 w-12 text-primary sm:h-16 sm:w-16" />
        </div>
        {!embedded && <LanguageSelector language={language} onChange={changeLanguage} />}
        <h1 className="mb-3 text-2xl font-extrabold text-zinc-200 sm:text-4xl">{tr(language,'Waiting for orders','等待新订单','Menunggu pesanan')}</h1>
        <div className="mt-8 flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span className="text-sm font-medium text-zinc-400 sm:text-base">{tr(language,'Local display ready','本机看板已启动','Paparan tempatan sedia')}</span>
        </div>
      </section>
    );
  }

  return (
    <section className={`${embedded ? 'rounded-2xl' : 'min-h-dvh'} bg-zinc-950 p-4 lg:p-6`}>
      {paymentHandoff}
      {/* KDS Header */}
      <div className={`${embedded ? '' : 'pt-safe'} mb-6 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {!embedded ? (
            <a
              href="#/cashier"
              aria-label={tr(language,'Back to staff','返回收银台','Kembali kepada pekerja')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </a>
          ) : (
            <ChefHat aria-hidden="true" className="h-8 w-8 shrink-0 text-primary" />
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight text-white sm:text-2xl">{tr(language,'Kitchen','后厨看板','Dapur')}</h1>
            <p className="text-zinc-400 text-sm font-medium">
              <span aria-live="polite">{activeOrders.length} {tr(language,'active orders','进行中订单','pesanan aktif')}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          {!embedded && <LanguageSelector language={language} onChange={changeLanguage} />}
        </div>
      </div>

      {saveError && <p role="alert" className="mb-4 text-red-400">{saveError}</p>}

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-6">
        {activeOrders.map(order => {
          const elapsed = getElapsedMinutes(order.timestamp);
          const isUrgent = elapsed >= 10;
          const isNew = order.status === 'Pending';

          return (
            <div
              key={order.local_order_id}
              className={`bg-zinc-900 rounded-2xl border-2 overflow-hidden flex flex-col ${
                isUrgent
                  ? 'border-red-500/60 shadow-lg shadow-red-500/10'
                  : isNew
                    ? 'border-primary/60 shadow-lg shadow-black/30'
                    : 'border-zinc-800'
              }`}
            >
              {/* Order Header */}
              <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
                <div>
                  <h2 className="text-4xl font-extrabold text-white tracking-tight">{order.order_id}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                      order.order_type === 'Dine-in'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-zinc-700 text-zinc-100 border border-zinc-600'
                    }`}>
                      {orderTypeLabel(language, order.order_type)} {order.table_no || ''}
                    </span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                      order.paid
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {order.paid ? tr(language,'Paid','已付款','Dibayar') : tr(language,'Unpaid','未付款','Belum dibayar')}
                    </span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {orderStatusLabel(language,order.status)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`flex items-center gap-1 ${isUrgent ? 'text-red-400' : 'text-zinc-400'}`}>
                    <Clock className="w-5 h-5" />
                    <span className="text-2xl font-extrabold">{elapsed}m</span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="p-5 flex-1">
                {order.items && order.items.length > 0 ? (
                  <ul className="space-y-4">
                    {order.items.map((item, idx) => {
                      const menuItem = settings.menuItems.find(m => m.id === item.menuItemId);
                      const display = getCartItemDisplay(item, menuItem, language);
                      return (
                        <li key={idx} className="border-b border-zinc-800/50 pb-3 last:border-0 last:pb-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-2xl font-extrabold text-white">
                                {item.quantity}x {display.itemName}
                              </span>
                              {display.details.length > 0 && (
                                <div className="mt-1 space-y-1 text-lg font-bold text-zinc-400">
                                  {display.details.map((detail, detailIndex) => (
                                    <p key={`${detailIndex}-${detail}`}>{detail}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xl text-zinc-300 font-bold leading-relaxed whitespace-pre-wrap">
                    {order.items_summary}
                  </p>
                )}
              </div>

              {/* Complete Button */}
              <button
                type="button"
                disabled={saving}
                onClick={() => handleCompleteOrder(order)}
                className={`w-full py-6 font-extrabold text-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                  isUrgent
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <CheckCircle aria-hidden="true" className="w-8 h-8" />
                {saving ? tr(language,'Saving…','保存中…','Menyimpan…') : tr(language,'Ready','出餐完成','Siap')}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
