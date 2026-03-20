import React from 'react';
import { useStore } from '../store';
import { formatCurrency } from '../utils';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

export default function AdminActive() {
  const { orders, updateOrderStatus } = useStore();

  const activeOrders = orders.filter(o => o.status === 'Pending');

  if (activeOrders.length === 0) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <Clock className="w-16 h-16 mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Active Orders</h2>
        <p className="text-sm">All caught up! Waiting for new orders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Active Orders</h2>
        <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full text-xs font-bold">
          {activeOrders.length} Pending
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeOrders.map(order => (
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
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{order.timestamp}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-extrabold text-orange-600 dark:text-orange-500">{formatCurrency(order.total_amount)}</p>
                <p className="text-[10px] text-gray-400 uppercase font-medium">{order.total_qty} Items</p>
              </div>
            </div>

            <div className="p-4 flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                {order.items_summary}
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-zinc-950/50 flex gap-2 border-t border-gray-100 dark:border-zinc-800">
              <button
                onClick={() => updateOrderStatus(order.local_order_id, 'Completed')}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors active:scale-[0.98]"
              >
                <CheckCircle className="w-5 h-5" />
                Complete
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to cancel this order?')) {
                    updateOrderStatus(order.local_order_id, 'Cancelled');
                  }
                }}
                className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold px-6 py-3 rounded-xl transition-colors active:scale-[0.98]"
              >
                <XCircle className="w-5 h-5" />
                Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
