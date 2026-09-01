import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { getCartItemDisplay } from '../domain/cart-item-display';
import { CheckCircle, ChefHat, Clock } from 'lucide-react';

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

export default function KitchenDisplay() {
  const { orders, updateOrderStatus, settings } = useStore();
  const [, setTick] = useState(0);
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

  if (activeOrders.length === 0) {
    return (
      <div className="min-h-dvh bg-zinc-950 flex flex-col items-center justify-center p-8">
        <div className="w-32 h-32 bg-zinc-900 rounded-full flex items-center justify-center mb-8 border-2 border-zinc-800">
          <ChefHat className="w-16 h-16 text-primary" />
        </div>
        <h1 className="text-4xl font-extrabold text-zinc-400 mb-4">Waiting for Orders</h1>
        <p className="text-xl text-zinc-400">等待新订单...</p>
        <div className="mt-8 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-zinc-400 font-medium">Kitchen Display Active / 后厨看板已连线</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-950 p-4 lg:p-6">
      {/* KDS Header */}
      <div className="pt-safe flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <ChefHat className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-extrabold text-white">Kitchen Display / 后厨看板</h1>
            <p className="text-zinc-400 text-sm font-medium">
              <span aria-live="polite">{activeOrders.length} order{activeOrders.length > 1 ? 's' : ''} active / 进行中</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-zinc-400 text-sm font-medium">LIVE</span>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-6">
        {activeOrders.map(order => {
          const elapsed = getElapsedMinutes(order.timestamp);
          const isUrgent = elapsed >= 10;
          const isPending = order.status === 'Pending';

          return (
            <div
              key={order.local_order_id}
              className={`bg-zinc-900 rounded-2xl border-2 overflow-hidden flex flex-col ${
                isUrgent
                  ? 'border-red-500/60 shadow-lg shadow-red-500/10'
                  : isPending
                    ? 'border-primary/60 shadow-lg shadow-black/30'
                    : 'border-zinc-800'
              }`}
            >
              {/* Order Header */}
              <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
                <div>
                  <h2 className="text-4xl font-extrabold text-white tracking-tight">{order.order_id}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                      order.order_type === 'Dine-in'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-zinc-700 text-zinc-100 border border-zinc-600'
                    }`}>
                      {order.order_type === 'Dine-in' ? `Table ${order.table_no}` : 'Takeaway'}
                    </span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                      isPending
                        ? 'bg-primary text-on-primary border border-primary'
                        : 'bg-green-500/20 text-green-400 border border-green-500/30'
                    }`}>
                      {isPending ? '未付款 Unpaid' : '已付款 Paid'}
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
                      const display = getCartItemDisplay(item, menuItem, 'zh');
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
                onClick={() => updateOrderStatus(order.local_order_id, 'Completed')}
                className={`w-full py-6 font-extrabold text-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                  isUrgent
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <CheckCircle aria-hidden="true" className="w-8 h-8" />
                出餐完成 / Done
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
