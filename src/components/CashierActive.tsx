import React, { useState } from 'react';
import { useStore } from '../store';
import { formatCurrency } from '../utils';
import { SIZES, NOODLE_BASES, ADD_ONS } from '../constants';
import { CheckCircle, XCircle, Clock, CreditCard, Banknote, X, QrCode } from 'lucide-react';
import { PaymentMethod } from '../types';

export default function CashierActive() {
  const { orders, updateOrderStatus, markAsPaid, settings } = useStore();
  const [activeSection, setActiveSection] = useState<'pending' | 'preparing'>('pending');
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  const pendingOrders = orders.filter(o => !o.paid && o.status !== 'Cancelled');
  const preparingOrders = orders.filter(o => o.paid && (o.status === 'Preparing' || o.status === 'Pending'));

  const handlePayment = (localOrderId: string, method: PaymentMethod) => {
    markAsPaid(localOrderId, method);
    setPayingOrderId(null);
  };

  const renderOrderCard = (order: typeof orders[0], showPayButton: boolean) => (
    <div key={order.local_order_id} className="min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-gray-50 bg-gray-50/50 p-4 dark:border-zinc-800/50 dark:bg-zinc-950/30">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{order.order_id}</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
              order.order_type === 'Dine-in' 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' 
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
            }`}>
              {order.order_type === 'Dine-in' ? `Table ${order.table_no}` : 'Takeaway'}
            </span>
            {order.paid && order.payment_method && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 uppercase">
                {order.payment_method}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{order.timestamp}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-extrabold tabular-nums text-emphasis dark:text-primary">{formatCurrency(order.total_amount)}</p>
          <p className="text-[10px] text-gray-400 uppercase font-medium">{order.total_qty} Items</p>
        </div>
      </div>

      <div className="p-4 flex-1">
        {order.items && order.items.length > 0 ? (
          <ul className="space-y-2">
            {order.items.map((item, idx) => {
              const menuItem = settings.menuItems.find(m => m.id === item.menuItemId);
              const sizeName = item.sizeId
                ? menuItem?.sizes.find(s => s.id === item.sizeId)?.name.en || ''
                : SIZES.find(s => s.id === (item.size as any))?.name.en;
              const noodlesArr = item.noodleBaseIds
                ? item.noodleBaseIds.map(n => menuItem?.noodleBases.find(nb => nb.id === n)?.name.en)
                : (item.noodleBases || []).map(n => NOODLE_BASES.find(nb => nb.id === (n as any))?.name.en);
              const noodles = noodlesArr.filter(Boolean).join('+');
              const addonsArr = item.addOnIds
                ? item.addOnIds.map(a => menuItem?.addOns.find(ao => ao.id === a)?.name.en)
                : (item.addOns || []).map(a => ADD_ONS.find(ao => ao.id === (a as any))?.name.en);
              const addons = addonsArr.filter(Boolean).join(', ');
              return (
                <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                  <span className="font-bold">{item.quantity}x</span> {menuItem?.name.en} ({menuItem?.name.zh})
                  <span className="text-gray-500 dark:text-gray-400"> · {sizeName} · {noodles}</span>
                  {addons && <span className="text-emphasis dark:text-primary"> +{addons}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
            {order.items_summary}
          </p>
        )}
      </div>

      <div className="p-3 bg-gray-50 dark:bg-zinc-950/50 flex gap-2 border-t border-gray-100 dark:border-zinc-800">
        {showPayButton && !order.paid ? (
          <>
            <button
              type="button"
              onClick={() => setPayingOrderId(order.local_order_id)}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors active:scale-[0.98]"
            >
              <CreditCard aria-hidden="true" className="w-5 h-5" />
              Mark Paid / 标记已付
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Cancel this order? / 取消此订单？')) {
                  updateOrderStatus(order.local_order_id, 'Cancelled');
                }
              }}
              aria-label={`Cancel order ${order.order_id} / 取消订单 ${order.order_id}`}
              className="flex min-h-12 min-w-12 items-center justify-center gap-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold px-4 py-3 rounded-xl transition-colors active:scale-[0.98]"
            >
              <XCircle aria-hidden="true" className="w-5 h-5" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => updateOrderStatus(order.local_order_id, 'Completed')}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors active:scale-[0.98]"
            >
              <CheckCircle aria-hidden="true" className="w-5 h-5" />
              Complete / 完成
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Cancel this order? / 取消此订单？')) {
                  updateOrderStatus(order.local_order_id, 'Cancelled');
                }
              }}
              aria-label={`Cancel order ${order.order_id} / 取消订单 ${order.order_id}`}
              className="flex min-h-12 min-w-12 items-center justify-center gap-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold px-4 py-3 rounded-xl transition-colors active:scale-[0.98]"
            >
              <XCircle aria-hidden="true" className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-w-0 space-y-4">
      {/* Tab Switcher */}
      <div className="mb-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveSection('pending')}
          aria-pressed={activeSection === 'pending'}
          className={`flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 sm:gap-2 sm:px-4 sm:text-sm ${
            activeSection === 'pending'
              ? 'bg-primary text-on-primary shadow-sm hover:bg-primary-hover'
              : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-zinc-700'
          }`}
        >
          <span className="min-w-0 leading-tight">
            <span className="block sm:inline">Pending</span>
            <span className="block sm:inline"> / 待付款</span>
          </span>
          {pendingOrders.length > 0 && (
            <span className={`min-w-6 shrink-0 rounded-full px-1.5 py-0.5 text-center text-xs ${
              activeSection === 'pending'
                ? 'bg-black/10 text-on-primary'
                : 'bg-black/5 text-gray-700 dark:bg-white/10 dark:text-gray-300'
            }`}>
              {pendingOrders.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('preparing')}
          aria-pressed={activeSection === 'preparing'}
          className={`flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 sm:gap-2 sm:px-4 sm:text-sm ${
            activeSection === 'preparing'
              ? 'bg-primary text-on-primary shadow-sm hover:bg-primary-hover'
              : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-zinc-700'
          }`}
        >
          <span className="min-w-0 leading-tight">
            <span className="block sm:inline">Preparing</span>
            <span className="block sm:inline"> / 制作中</span>
          </span>
          {preparingOrders.length > 0 && (
            <span className={`min-w-6 shrink-0 rounded-full px-1.5 py-0.5 text-center text-xs ${
              activeSection === 'preparing'
                ? 'bg-black/10 text-on-primary'
                : 'bg-black/5 text-gray-700 dark:bg-white/10 dark:text-gray-300'
            }`}>
              {preparingOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* Orders Grid */}
      {activeSection === 'pending' && (
        pendingOrders.length === 0 ? (
          <div className="h-[40vh] flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <Clock aria-hidden="true" className="w-16 h-16 mb-4 opacity-50" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Pending Orders</h2>
            <p className="text-sm">All orders are paid! / 所有订单已付款！</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pendingOrders.map(order => renderOrderCard(order, true))}
          </div>
        )
      )}

      {activeSection === 'preparing' && (
        preparingOrders.length === 0 ? (
          <div className="h-[40vh] flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <Clock aria-hidden="true" className="w-16 h-16 mb-4 opacity-50" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Orders Preparing</h2>
            <p className="text-sm">Kitchen is clear! / 厨房空闲中！</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {preparingOrders.map(order => renderOrderCard(order, false))}
          </div>
        )
      )}

      {/* Payment Method Modal */}
      {payingOrderId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-dialog-title"
          >
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 id="payment-dialog-title" className="text-lg font-bold text-gray-900 dark:text-white">Payment / 支付方式</h3>
              <button
                type="button"
                onClick={() => setPayingOrderId(null)}
                aria-label="Close payment options / 关闭付款选项"
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800"
              >
                <X aria-hidden="true" className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <button
                type="button"
                onClick={() => handlePayment(payingOrderId, 'Cash')}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-3 transition-colors text-lg"
              >
                <Banknote aria-hidden="true" className="w-6 h-6" />
                Cash / 现金
              </button>
              <button
                type="button"
                onClick={() => handlePayment(payingOrderId, 'QR Pay')}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-3 transition-colors text-lg"
              >
                <QrCode aria-hidden="true" className="w-6 h-6" />
                QR Pay / 扫码支付
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
