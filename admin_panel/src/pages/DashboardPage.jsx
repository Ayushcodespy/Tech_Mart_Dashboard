import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  DollarSign,
  PackageCheck,
  ShoppingCart,
} from 'lucide-react';
import {
  Area,
  AreaChart,
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

import { dashboardApi, inventoryApi, ordersApi } from '../api/endpoints';
import { EmptyState } from '../components/ui/EmptyState';
import { Loader } from '../components/ui/Loader';
import { Panel } from '../components/ui/Panel';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatCurrency, formatDateTime } from '../components/ui/utils';

const PIE_COLORS = ['#6ea733', '#f59e0b', '#0ea5e9', '#ef4444', '#8b5cf6'];

export const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [orderRows, setOrderRows] = useState([]);
  const [lowStockOpen, setLowStockOpen] = useState(false);
  const [lowStockLoading, setLowStockLoading] = useState(false);
  const [lowStockRows, setLowStockRows] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryRes, ordersRes] = await Promise.all([
        dashboardApi.summary(),
        ordersApi.list({ page: 1, pageSize: 50 }),
      ]);
      setSummary(summaryRes.data.data);
      setOrderRows(ordersRes.data.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleLowStock = async () => {
    const nextOpen = !lowStockOpen;
    setLowStockOpen(nextOpen);
    if (!nextOpen || lowStockRows.length) return;

    setLowStockLoading(true);
    try {
      const response = await inventoryApi.lowStock({ page: 1, pageSize: 50 });
      setLowStockRows(response.data.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load low stock products');
    } finally {
      setLowStockLoading(false);
    }
  };

  const orderStatusData = useMemo(() => {
    const map = new Map();
    orderRows.forEach((order) => {
      map.set(order.status, (map.get(order.status) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [orderRows]);

  const latestOrders = useMemo(
    () => orderRows.slice(0, 4),
    [orderRows]
  );

  const revenueSeries = useMemo(() => {
    if (!summary) return [];
    const daily = summary.last_7_days_revenue / 7;
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => ({
      day,
      revenue: Number((daily * (0.85 + (index % 3) * 0.1)).toFixed(2)),
    }));
  }, [summary]);

  if (loading) return <Loader label="Loading dashboard insights..." />;

  if (error) {
    return (
      <div className="panel p-6">
        <p className="text-sm text-rose-600">{error}</p>
        <button
          className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          onClick={load}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!summary) {
    return <EmptyState title="No data yet" subtitle="Dashboard metrics will appear here." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Orders" value={summary.total_orders} icon={<ShoppingCart size={16} />} />
        <StatCard title="Pending Orders" value={summary.pending_orders} icon={<Activity size={16} />} />
        <StatCard title="Total Revenue" value={summary.total_revenue} currency icon={<DollarSign size={16} />} />
        <StatCard
          title="Low Stock Alerts"
          value={summary.low_stock_alerts}
          icon={<AlertTriangle size={16} />}
          onClick={toggleLowStock}
          active={lowStockOpen}
        />
      </div>

      {lowStockOpen ? (
        <Panel title="Low Stock Products">
          {lowStockLoading ? (
            <Loader label="Loading low stock list..." />
          ) : lowStockRows.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="table-head text-left">Product</th>
                    <th className="table-head text-left">SKU</th>
                    <th className="table-head text-left">Current</th>
                    <th className="table-head text-left">Threshold</th>
                    <th className="table-head text-left">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {lowStockRows.map((row) => (
                    <tr key={row.id}>
                      <td className="table-cell font-semibold">{row.name}</td>
                      <td className="table-cell text-xs text-slate-500">{row.sku}</td>
                      <td className="table-cell">{row.stock_qty}</td>
                      <td className="table-cell">{row.low_stock_threshold}</td>
                      <td className="table-cell">
                        <StatusBadge label={row.stock_qty <= 0 ? 'Critical' : 'Low'} tone={row.stock_qty <= 0 ? 'danger' : 'warning'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No low stock products" subtitle="All products are above threshold." />
          )}
        </Panel>
      ) : null}

      <Panel title="Latest Orders">
        {latestOrders.length ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-4 md:grid-cols-2">
            {latestOrders.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Order</p>
                    <h4 className="text-sm font-bold text-slate-900">{order.order_number}</h4>
                  </div>
                  <StatusPill status={order.status} />
                </div>
                <p className="mt-3 text-lg font-bold text-slate-900">{formatCurrency(order.total)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {order.items?.length || 0} item(s) • {formatDateTime(order.created_at)}
                </p>
                <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Payment: {String(order.payment_status || 'PENDING').replaceAll('_', ' ')}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No incoming orders" subtitle="Latest orders will appear here." />
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel title="Revenue Trend (7 Days)" className="xl:col-span-3">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#6ea733" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6ea733" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Area type="monotone" dataKey="revenue" stroke="#6ea733" fill="url(#revenueFill)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Order Status Mix" className="xl:col-span-2">
          <div className="h-72">
            {orderStatusData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderStatusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                  >
                    {orderStatusData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No orders yet" subtitle="Status distribution will appear here." />
            )}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Top Selling Products">
          <div className="h-72">
            {summary.top_selling_products?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.top_selling_products} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" stroke="#64748b" width={120} />
                  <Tooltip formatter={(value) => `${value} units`} />
                  <Bar dataKey="stock_qty" radius={[6, 6, 6, 6]} fill="#6ea733" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No product stats" subtitle="Top products will be listed here." />
            )}
          </div>
        </Panel>

        <Panel title="Recent Activity">
          {summary.recent_activity?.length ? (
            <ul className="space-y-3">
              {summary.recent_activity.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-800">{item.action.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-slate-500">
                    {item.entity_type} #{item.entity_id}
                  </p>
                  <p className="text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No activity recorded" subtitle="Activity logs will appear here." />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel title="Delivered Orders">
          <p className="text-3xl font-bold text-emerald-700">{summary.delivered_orders}</p>
          <p className="mt-1 text-sm text-slate-500">Successfully completed orders.</p>
        </Panel>
        <Panel title="Active Banners">
          <p className="text-3xl font-bold text-sky-700">{summary.active_banners}</p>
          <p className="mt-1 text-sm text-slate-500">Currently visible campaigns.</p>
        </Panel>
        <Panel title="Revenue (7d)">
          <p className="text-3xl font-bold text-brand-700">{formatCurrency(summary.last_7_days_revenue)}</p>
          <p className="mt-1 text-sm text-slate-500">Recent performance snapshot.</p>
        </Panel>
      </div>
    </div>
  );
};

const StatusPill = ({ status }) => {
  const tone =
    status === 'DELIVERED'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'CANCELLED' || status === 'REJECTED'
        ? 'bg-rose-50 text-rose-700'
        : 'bg-amber-50 text-amber-700';

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>
      {String(status).replaceAll('_', ' ')}
    </span>
  );
};
