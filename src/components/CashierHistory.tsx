import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { formatCurrency } from '../utils';
import { format, subDays, subMonths, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth } from 'date-fns';
import { TrendingUp, DollarSign, History, Banknote, Calendar, ChefHat, ExternalLink, FileSpreadsheet, LoaderCircle } from 'lucide-react';
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
  const { orders, fetchStats, settings } = useStore();
  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [stats, setStats] = useState<{ totals: { bowls: number; revenue: number; orders: number }; daily: DailyStat[] } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportError, setExportError] = useState('');

  // Local fallback stats from orders in localStorage
  const currentRange = getDateRange(dateRange);
  const ordersInRange = orders.filter(o => {
    const oDate = o.timestamp.split(' ')[0];
    return oDate >= currentRange.from && oDate <= currentRange.to;
  });
  const localOrdersRange = orders.filter(o => {
    const oDate = o.timestamp.split(' ')[0];
    return o.status === 'Completed' && oDate >= currentRange.from && oDate <= currentRange.to;
  });
  const localTotalBowls = localOrdersRange.reduce((sum, o) => sum + o.total_qty, 0);
  const localTotalRevenue = localOrdersRange.reduce((sum, o) => sum + o.total_amount, 0);

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
    orders: localOrdersRange.length,
  };
  const dailyBreakdown = stats?.daily || [];
  const avgPerOrder = displayTotals.orders > 0 ? displayTotals.revenue / displayTotals.orders : 0;
  const avgBowlsPerDay = dailyBreakdown.length > 0 ? displayTotals.bowls / dailyBreakdown.length : displayTotals.bowls;

  const completedOrders = orders.filter(o => o.status === 'Completed');

  const handleExport = async () => {
    if (ordersInRange.length === 0 || isExporting) return;
    setIsExporting(true);
    setExportMessage('');
    setExportError('');
    try {
      const {exportOrdersXlsx} = await import('../domain/export-orders-xlsx');
      const filename = `CJ-POS-orders-${currentRange.from}-to-${currentRange.to}.xlsx`;
      await exportOrdersXlsx(ordersInRange, settings, filename);
      setExportMessage(`Downloaded ${ordersInRange.length} order${ordersInRange.length === 1 ? '' : 's'} / 已下载 ${ordersInRange.length} 张订单`);
    } catch (error) {
      console.error('[Excel export] Failed:', error);
      setExportError('Could not create the Excel file. Please try again. / 无法建立 Excel，请重试。');
    } finally {
      setIsExporting(false);
    }
  };

  const paymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'Cash': return 'Cash';
      case 'QR Pay': return 'QR Pay';
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
    <div className="min-w-0 space-y-6">
      {/* Date Range Tabs */}
      <div className="flex bg-gray-200 dark:bg-zinc-800 p-1 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setDateRange(tab.id)}
            aria-pressed={dateRange === tab.id}
            className={`min-h-11 min-w-0 flex-1 rounded-lg px-1 py-2.5 text-xs font-bold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 ${
              dateRange === tab.id
                ? 'bg-primary text-on-primary shadow-sm hover:bg-primary-hover'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Range Label + Export Actions */}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-gray-500 dark:text-gray-400">
          <Calendar aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">{getDateRange(dateRange).label}: {getDateRange(dateRange).from} → {getDateRange(dateRange).to}</span>
          {isLoadingStats && <span className="animate-pulse text-xs font-bold text-emphasis dark:text-primary">Syncing...</span>}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={handleExport}
            disabled={ordersInRange.length === 0 || isExporting}
            className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-extrabold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
          >
            {isExporting
              ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
              : <FileSpreadsheet aria-hidden="true" className="h-4 w-4" />}
            {isExporting ? 'Creating… / 建立中…' : `Excel (${ordersInRange.length})`}
          </button>
          {SHEET_URL && (
            <a
              href={SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700 transition-colors hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 dark:border-green-800/30 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30 dark:focus-visible:ring-green-400 dark:focus-visible:ring-offset-zinc-950 sm:w-auto"
            >
              <ExternalLink aria-hidden="true" className="w-4 h-4" />
              Open Google Sheet
            </a>
          )}
        </div>
      </div>

      <div aria-live="polite" className="min-h-5">
        {exportMessage && <p className="text-sm font-semibold text-green-700 dark:text-green-400">{exportMessage}</p>}
        {exportError && <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">{exportError}</p>}
      </div>

      {/* Dashboard KPI Cards */}
      <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Bowls / 碗数</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
              <ChefHat aria-hidden="true" className="h-4 w-4 text-emphasis dark:text-primary" />
            </div>
          </div>
          <div className="text-3xl font-extrabold tabular-nums text-gray-900 dark:text-white">{displayTotals.bowls}</div>
          {dateRange !== 'today' && dailyBreakdown.length > 1 && (
            <p className="text-xs text-gray-400 mt-1">≈ {avgBowlsPerDay.toFixed(0)} /day</p>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Revenue / 营收</span>
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <DollarSign aria-hidden="true" className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold tabular-nums text-emphasis dark:text-primary">{formatCurrency(displayTotals.revenue)}</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Orders / 订单</span>
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <TrendingUp aria-hidden="true" className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold tabular-nums text-gray-900 dark:text-white">{displayTotals.orders}</div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Avg / 均值</span>
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Banknote aria-hidden="true" className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="text-3xl font-extrabold tabular-nums text-emphasis dark:text-primary">
            {avgPerOrder > 0 ? formatCurrency(avgPerOrder) : 'RM 0.00'}
          </div>
          <p className="text-xs text-gray-400 mt-1">per order</p>
        </div>
      </div>

      {/* Daily Breakdown (for week/month/year views) */}
      {dateRange !== 'today' && dailyBreakdown.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Calendar aria-hidden="true" className="w-5 h-5" />
            Daily Breakdown / 每日明细
          </h3>
          <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full min-w-[36rem]">
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
                    <td className="px-4 py-3 text-sm text-right font-bold tabular-nums text-emphasis dark:text-primary">{formatCurrency(day.revenue)}</td>
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
          <History aria-hidden="true" className="w-5 h-5" />
          Recent Orders / 近期订单
        </h2>

        {completedOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <p>No completed orders yet. / 暂无已完成订单。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedOrders.slice(0, 20).map(order => (
              <div key={order.local_order_id} className="flex min-w-0 flex-col justify-between gap-4 rounded-xl border-y border-r border-l-4 border-gray-100 border-l-green-500 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{order.order_id}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {order.order_type === 'Dine-in' ? `Table ${order.table_no}` : 'Takeaway'}
                    </span>
                    {order.payment_method && (
                      <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {paymentMethodLabel(order.payment_method)}
                      </span>
                    )}
                    {order.synced && (
                      <span className="whitespace-nowrap rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Synced</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{order.items_summary}</p>
                </div>
                <div className="flex items-center justify-between sm:flex-col sm:items-end gap-1 border-t sm:border-t-0 border-gray-100 dark:border-zinc-800 pt-3 sm:pt-0">
                  <span className="text-xs text-gray-400">{order.timestamp}</span>
                  <span className="font-bold tabular-nums text-emphasis dark:text-primary">{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
