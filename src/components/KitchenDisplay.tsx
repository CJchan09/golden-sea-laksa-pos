import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { formatCurrency } from '../utils';
import { MENU_ITEMS, SIZES, NOODLE_BASES, ADD_ONS } from '../constants';
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
  const { orders, updateOrderStatus } = useStore();
  const [, setTick] = useState(0);
  const prevCountRef = useRef(0);

  // Show both Pending and Preparing orders — kitchen needs to see all active orders
  const activeOrders = orders.filter(o => o.status === 'Pending' || o.status === 'Preparing');

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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8">
        <div className="w-32 h-32 bg-zinc-900 rounded-full flex items-center justify-center mb-8 border-2 border-zinc-800">
          <ChefHat className="w-16 h-16 text-zinc-600" />
        </div>
        <h1 className="text-4xl font-extrabold text-zinc-400 mb-4">Waiting for Orders</h1>
        <p className="text-xl text-zinc-600">等待新订单...</p>
        <div className="mt-8 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-zinc-500 font-medium">Kitchen Display Active / 后厨看板已连线</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 lg:p-6">
      {/* KDS Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <ChefHat className="w-8 h-8 text-orange-500" />
          <div>
            <h1 className="text-2xl font-extrabold text-white">Kitchen Display / 后厨看板</h1>
            <p className="text-zinc-500 text-sm font-medium">
              {activeOrders.length} order{activeOrders.length > 1 ? 's' : ''} active / 进行中
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="text-zinc-500 text-sm font-medium">LIVE</span>
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
                    ? 'border-orange-500/50 shadow-lg shadow-orange-500/10'
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
                        : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    }`}>
                      {order.order_type === 'Dine-in' ? `🪑 Table ${order.table_no}` : '🛍️ Takeaway'}
                    </span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                      isPending
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'bg-green-500/20 text-green-400 border border-green-500/30'
                    }`}>
                      {isPending ? '⏳ 未付款 Unpaid' : '✅ 已付款 Paid'}
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
                      const menuItem = MENU_ITEMS.find(m => m.id === item.menuItemId);
                      const sizeName = SIZES.find(s => s.id === item.size)?.name.zh;
                      const noodles = item.noodleBases.map(n => NOODLE_BASES.find(nb => nb.id === n)?.name.zh).join('+');
                      const addons = item.addOns.map(a => ADD_ONS.find(ao => ao.id === a)?.name.zh);
                      return (
                        <li key={idx} className="border-b border-zinc-800/50 pb-3 last:border-0 last:pb-0">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-2xl font-extrabold text-white">
                                {item.quantity}x {menuItem?.name.zh}
                              </span>
                              <p className="text-lg text-zinc-400 font-bold mt-1">
                                {sizeName} · {noodles}
                              </p>
                              {addons.length > 0 && (
                                <p className="text-lg text-orange-400 font-bold mt-1">
                                  + {addons.join(', ')}
                                </p>
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
                onClick={() => updateOrderStatus(order.local_order_id, 'Completed')}
                className={`w-full py-6 font-extrabold text-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                  isUrgent
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <CheckCircle className="w-8 h-8" />
                出餐完成 / Done
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
