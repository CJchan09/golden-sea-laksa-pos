import React, { useState } from 'react';
import { useStore } from '../store';
import { formatCurrency } from '../utils';
import { MENU_ITEMS, SIZES, NOODLE_BASES, ADD_ONS } from '../constants';
import { CheckCircle, XCircle, Clock, CreditCard, Banknote, X, QrCode } from 'lucide-react';
import { PaymentMethod } from '../types';

export default function CashierActive() {
  const { orders, updateOrderStatus, markAsPaid } = useStore();
  const [activeSection, setActiveSection] = useState<'pending' | 'preparing'>('pending');
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

  const pendingOrders = orders.filter(o => o.status === 'Pending');
  const preparingOrders = orders.filter(o => o.status === 'Preparing');

  const handlePayment = (localOrderId: string, method: PaymentMethod) => {
    markAsPaid(localOrderId, method);
    setPayingOrderId(null);
  };

  const renderOrderCard = (order: typeof orders[0], showPayButton: boolean) => (
    <div key={order.local_order_id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-50 dark:border-zinc-800/50 flex justify-between items-start bg-gray-50/50 dark:bg-zinc-950/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
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
        <div className="text-right">
          <p className="text-lg font-extrabold text-orange-600 dark:text-orange-500">{formatCurrency(order.total_amount)}</p>
          <p className="text-[10px] text-gray-400 uppercase font-medium">{order.total_qty} Items</p>
        </div>
      </div>

      <div className="p-4 flex-1">
        {order.items && order.items.length > 0 ? (
          <ul className="space-y-2">
            {order.items.map((item, idx) => {
              const menuItem = MENU_ITEMS.find(m => m.id === item.menuItemId);
              const sizeName = SIZES.find(s => s.id === item.size)?.name.en;
              const noodles = item.noodleBases.map(n => NOODLE_BASES.find(nb => nb.id === n)?.name.en).join('+');
              const addons = item.addOns.map(a => ADD_ONS.find(ao => ao.id === a)?.name.en).join(', ');
              return (
                <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                  <span className="font-bold">{item.quantity}x</span> {menuItem?.name.en} ({menuItem?.name.zh})
                  <span className="text-gray-500 dark:text-gray-400"> · {sizeName} · {noodles}</span>
                  {addons && <span className="text-orange-600 dark:text-orange-400"> +{addons}</span>}
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
              onClick={() => setPayingOrderId(order.local_order_id)}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors active:scale-[0.98]"
            >
              <CreditCard className="w-5 h-5" />
              Mark Paid / 标记已付
            </button>
            <button
              onClick={() => {
                if (window.confirm('Cancel this order? / 取消此订单？')) {
                  updateOrderStatus(order.local_order_id, 'Cancelled');
                }
              }}
              className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold px-6 py-3 rounded-xl transition-colors active:scale-[0.98]"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => updateOrderStatus(order.local_order_id, 'Completed')}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors active:scale-[0.98]"
            >
              <CheckCircle className="w-5 h-5" />
              Complete / 完成
            </button>
            <button
              onClick={() => {
                if (window.confirm('Cancel this order? / 取消此订单？')) {
                  updateOrderStatus(order.local_order_id, 'Cancelled');
                }
              }}
              className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold px-6 py-3 rounded-xl transition-colors active:scale-[0.98]"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setActiveSection('pending')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            activeSection === 'pending'
              ? 'bg-orange-600 text-white shadow-md'
              : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-zinc-700'
          }`}
        >
          Pending / 待付款
          {pendingOrders.length > 0 && (
            <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-xs min-w-[1.5rem] text-center">
              {pendingOrders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSection('preparing')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            activeSection === 'preparing'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-zinc-700'
          }`}
        >
          Preparing / 制作中
          {preparingOrders.length > 0 && (
            <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-xs min-w-[1.5rem] text-center">
              {preparingOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* Orders Grid */}
      {activeSection === 'pending' && (
        pendingOrders.length === 0 ? (
          <div className="h-[40vh] flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <Clock className="w-16 h-16 mb-4 opacity-50" />
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
            <Clock className="w-16 h-16 mb-4 opacity-50" />
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
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Payment / 支付方式</h3>
              <button onClick={() => setPayingOrderId(null)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <button
                onClick={() => handlePayment(payingOrderId, 'Cash')}
                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-3 transition-colors text-lg"
              >
                <Banknote className="w-6 h-6" />
                Cash / 现金
              </button>
              <button
                onClick={() => handlePayment(payingOrderId, 'QR Pay')}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-3 transition-colors text-lg"
              >
                <QrCode className="w-6 h-6" />
                QR Pay / 扫码支付
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
