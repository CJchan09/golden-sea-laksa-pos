import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { formatCurrency } from '../utils';
import { format, subDays, subMonths, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth } from 'date-fns';
import { TrendingUp, DollarSign, History, Banknote, Calendar, ChefHat, ExternalLink } from 'lucide-react';
import { DailyStat } from '../types';
import { SHEET_URL } from '../constants';

type DateRange = 'today' | 'week' | 'month' | 'year';

function getDateRange(range: DateRange): { from: string; to: string; label: string } {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');

  switch (range) {
    case 'today':
      return { from: today, to: today, label: 'Today / 今日' };
    case 'week': {
      const start = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      return { from: start, to: end, label: 'This Week / 本周' };
    }
    case 'month': {
      const start = format(startOfMonth(now), 'yyyy-MM-dd');
      const end = format(endOfMonth(now), 'yyyy-MM-dd');
      return { from: start, to: end, label: 'This Month / 本月' };
    }
    case 'year': {
      const start = format(startOfYear(now), 'yyyy-MM-dd');
      return { from: start, to: today, label: 'This Year / 今年' };
    }
  }
}

export default function CashierHistory() {
  const { orders, fetchStats } = useStore();
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [stats, setStats] = useState<{ totals: { bowls: number; revenue: number; orders: number }; daily: DailyStat[] } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Local fallback stats from orders in localStorage
  const today = format(new Date(), 'yyyy-MM-dd');
  const localTodaysOrders = orders.filter(o => o.timestamp.startsWith(today) && o.status === 'Completed');
  const localTotalBowls = localTodaysOrders.reduce((sum, o) => sum + o.total_qty, 0);
  const localTotalRevenue = localTodaysOrders.reduce((sum, o) => sum + o.total_amount, 0);

  // Fetch stats from GAS when date range changes
  useEffect(() => {
    const loadStats = async () => {
      setIsLoadingStats(true);
      const { from, to } = getDateRange(dateRange);
      const result = await fetchStats(from, to);
      setStats(result);
      setIsLoadingStats(false);
    };
    loadStats();
  }, [dateRange]);

  // Use GAS stats if available, otherwise fallback to local
  const displayTotals = stats?.totals || {
    bowls: localTotalBowls,
    revenue: localTotalRevenue,
    orders: localTodaysOrders.length,
  };
  const dailyBreakdown = stats?.daily || [];
  const avgPerOrder = displayTotals.orders > 0 ? displayTotals.revenue / displayTotals.orders : 0;
  const avgBowlsPerDay = dailyBreakdown.length > 0 ? displayTotals.bowls / dailyBreakdown.length : displayTotals.bowls;

  const completedOrders = orders.filter(o => o.status === 'Completed');

  const paymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'Cash': return '💵 Cash';
      case 'QR Pay': return '📱 QR Pay';
      default: return '—';
    }
  };

  const tabs: { id: DateRange; label: string }[] = [
    { id: 'today', label: '日 Day' },
    { id: 'week', label: '周 Week' },
    { id: 'month', label: '月 Month' },
    { id: 'year', label: '年 Year' },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range Tabs */}
      <div className="flex bg-gray-200 dark:bg-zinc-800 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setDateRange(tab.id)}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
              dateRange === tab.id
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Range Label + Google Sheet Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Calendar className="w-4 h-4" />
          <span className="text-sm font-medium">{getDateRange(dateRange).label}: {getDateRange(dateRange).from} → {getDateRange(dateRange).to}</span>
          {isLoadingStats && <span className="text-xs text-orange-500 animate-pulse font-bold">Syncing...</span>}
        </div>
        {SHEET_URL && (
          <a
            href={SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-bold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg border border-green-200 dark:border-green-800/30"
          >
            <ExternalLink className="w-4 h-4" />
            Open Google Sheet
          </a>
        )}
      </div>

      {/* Dashboard KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Bowls / 碗数</span>
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{displayTotals.bowls}</div>
          {dateRange !== 'today' && dailyBreakdown.length > 1 && (
            <p className="text-xs text-gray-400 mt-1">≈ {avgBowlsPerDay.toFixed(0)} /day</p>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Revenue / 营收</span>
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{formatCurrency(displayTotals.revenue)}</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Orders / 订单</span>
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{displayTotals.orders}</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Avg / 均值</span>
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">
            {avgPerOrder > 0 ? formatCurrency(avgPerOrder) : 'RM 0.00'}
          </div>
          <p className="text-xs text-gray-400 mt-1">per order</p>
        </div>
      </div>

      {/* Daily Breakdown (for week/month/year views) */}
      {dateRange !== 'today' && dailyBreakdown.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Daily Breakdown / 每日明细
          </h3>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950/50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Bowls</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Orders</th>
                </tr>
              </thead>
              <tbody>
                {dailyBreakdown.map(day => (
                  <tr key={day.date} className="border-b border-gray-50 dark:border-zinc-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{day.date}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300 font-medium">{day.bowls}</td>
                    <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400 font-bold">{formatCurrency(day.revenue)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{day.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Completed Orders (local) */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
          <History className="w-5 h-5" />
          Recent Orders / 近期订单
        </h2>

        {completedOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <p>No completed orders yet. / 暂无已完成订单。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedOrders.slice(0, 20).map(order => (
              <div key={order.local_order_id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border-l-4 border-l-green-500 border-y border-r border-gray-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{order.order_id}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {order.order_type === 'Dine-in' ? `Table ${order.table_no}` : 'Takeaway'}
                    </span>
                    {order.payment_method && (
                      <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full uppercase font-bold">
                        {paymentMethodLabel(order.payment_method)}
                      </span>
                    )}
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
