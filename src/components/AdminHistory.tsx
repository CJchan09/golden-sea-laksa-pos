import React from 'react';
import { useStore } from '../store';
import { formatCurrency } from '../utils';
import { format } from 'date-fns';
import { TrendingUp, DollarSign, ExternalLink, History } from 'lucide-react';
import { GAS_URL } from '../constants';

export default function AdminHistory() {
  const { orders } = useStore();

  const today = format(new Date(), 'yyyy-MM-dd');
  const todaysOrders = orders.filter(o => o.timestamp.startsWith(today) && o.status === 'Completed');
  
  const totalBowls = todaysOrders.reduce((sum, o) => sum + o.total_qty, 0);
  const totalRevenue = todaysOrders.reduce((sum, o) => sum + o.total_amount, 0);

  const completedOrders = orders.filter(o => o.status === 'Completed');

  return (
    <div className="space-y-6">
      {/* Dashboard KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Today's Total</span>
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{totalBowls} <span className="text-lg text-gray-400 font-medium">Bowls</span></div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</span>
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{formatCurrency(totalRevenue)}</div>
        </div>
      </div>

      {/* History List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5" />
            Order History
          </h2>
          <a 
            href={GAS_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-lg"
          >
            <ExternalLink className="w-4 h-4" />
            View in Sheets
          </a>
        </div>

        {completedOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <p>No completed orders yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedOrders.map(order => (
              <div key={order.local_order_id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border-l-4 border-l-green-500 border-y border-r border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{order.order_id}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {order.order_type === 'Dine-in' ? `Table ${order.table_no}` : 'Takeaway'}
                    </span>
                    {order.synced && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase font-bold">Synced</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{order.items_summary}</p>
                </div>
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1 border-t sm:border-t-0 border-gray-100 dark:border-zinc-800 pt-3 sm:pt-0">
                  <span className="text-xs text-gray-400">{order.timestamp}</span>
                  <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
