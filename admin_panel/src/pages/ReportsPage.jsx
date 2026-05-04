import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarDays, CircleDollarSign, ClipboardList, PackageCheck } from 'lucide-react';

import { reportsApi } from '../api/endpoints';
import { EmptyState } from '../components/ui/EmptyState';
import { Loader } from '../components/ui/Loader';
import { Panel } from '../components/ui/Panel';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatCurrency, formatDateTime } from '../components/ui/utils';

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const PIE_COLORS = ['#6ea733', '#f59e0b', '#0ea5e9', '#ef4444', '#8b5cf6', '#14b8a6'];

const initialFilters = {
  mode: 'day',
  date: today,
  month: currentMonth,
  date_from: today,
  date_to: today,
};

export const ReportsPage = () => {
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => {
    if (appliedFilters.mode === 'month') {
      return { mode: 'month', month: appliedFilters.month };
    }
    if (appliedFilters.mode === 'range') {
      return {
        mode: 'range',
        date_from: appliedFilters.date_from,
        date_to: appliedFilters.date_to,
      };
    }
    return { mode: 'day', date: appliedFilters.date };
  }, [appliedFilters]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await reportsApi.summary(params);
      setReport(response.data.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params]);

  const submit = (event) => {
    event.preventDefault();
    setAppliedFilters(filters);
  };

  if (loading && !report) return <Loader label="Loading report..." />;

  return (
    <div className="space-y-5">
      <Panel title="Report Filters">
        <form className="grid grid-cols-1 gap-3 md:grid-cols-5" onSubmit={submit}>
          <label className="block text-sm">
            View
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              value={filters.mode}
              onChange={(e) => setFilters((prev) => ({ ...prev, mode: e.target.value }))}
            >
              <option value="day">Day wise</option>
              <option value="month">Specific month</option>
              <option value="range">Specific date range</option>
            </select>
          </label>

          {filters.mode === 'day' ? (
            <label className="block text-sm">
              Date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                value={filters.date}
                onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
              />
            </label>
          ) : null}

          {filters.mode === 'month' ? (
            <label className="block text-sm">
              Month
              <input
                type="month"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                value={filters.month}
                onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))}
              />
            </label>
          ) : null}

          {filters.mode === 'range' ? (
            <>
              <label className="block text-sm">
                From
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={filters.date_from}
                  onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                To
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={filters.date_to}
                  onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                />
              </label>
            </>
          ) : null}

          <div className="flex items-end">
            <button
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'View Report'}
            </button>
          </div>
        </form>
      </Panel>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      {report ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Orders" value={report.totals.total_orders} icon={<ClipboardList size={16} />} />
            <StatCard title="Delivered" value={report.totals.delivered_orders} icon={<PackageCheck size={16} />} />
            <StatCard title="Revenue" value={report.totals.revenue} currency icon={<CircleDollarSign size={16} />} />
            <StatCard title="Avg Order" value={report.totals.average_order_value} currency icon={<CalendarDays size={16} />} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <Panel title={`Day Wise Revenue (${report.label})`} className="xl:col-span-3">
              <div className="h-72">
                {report.day_wise.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.day_wise}>
                      <XAxis dataKey="date" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="revenue" fill="#6ea733" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No revenue found" subtitle="No delivered orders in this period." />
                )}
              </div>
            </Panel>

            <Panel title="Status Breakdown" className="xl:col-span-2">
              <div className="h-72">
                {report.status_breakdown.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={report.status_breakdown}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={58}
                        outerRadius={96}
                        paddingAngle={3}
                      >
                        {report.status_breakdown.map((entry, index) => (
                          <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState title="No orders found" subtitle="No status data for this period." />
                )}
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Top Products">
              {report.top_products.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="table-head text-left">Product</th>
                        <th className="table-head text-left">Qty</th>
                        <th className="table-head text-left">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {report.top_products.map((row) => (
                        <tr key={`${row.product_id}-${row.name}`}>
                          <td className="table-cell font-semibold">{row.name}</td>
                          <td className="table-cell">{row.quantity}</td>
                          <td className="table-cell">{formatCurrency(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No product sales" subtitle="Delivered order items will appear here." />
              )}
            </Panel>

            <Panel title="Orders In Report">
              {report.orders.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="table-head text-left">Order</th>
                        <th className="table-head text-left">Status</th>
                        <th className="table-head text-left">Total</th>
                        <th className="table-head text-left">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {report.orders.map((order) => (
                        <tr key={order.id}>
                          <td className="table-cell font-semibold">{order.order_number}</td>
                          <td className="table-cell"><StatusBadge label={order.status} tone="info" /></td>
                          <td className="table-cell">{formatCurrency(order.total)}</td>
                          <td className="table-cell text-xs">{formatDateTime(order.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No orders" subtitle="Orders for this period will appear here." />
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
};
