import { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Search } from 'lucide-react';

import { ordersApi } from '../api/endpoints';
import { EmptyState } from '../components/ui/EmptyState';
import { Loader } from '../components/ui/Loader';
import { Panel } from '../components/ui/Panel';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatCurrency, formatDateTime } from '../components/ui/utils';

const statusTone = (status) => {
  if (['DELIVERED', 'ACCEPTED', 'PACKED', 'SHIPPED'].includes(status)) return 'success';
  if (['PENDING', 'PLACED'].includes(status)) return 'warning';
  if (['CANCELLED', 'REJECTED'].includes(status)) return 'danger';
  return 'neutral';
};

const ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REJECTED'];
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED'];

export const OrdersPage = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', status: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await ordersApi.list({
        page: 1,
        pageSize: 100,
        q: filters.q,
        status: filters.status,
      });
      setRows(data.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onFilter = (event) => {
    event.preventDefault();
    load();
  };

  const updateStatus = async (orderId, status) => {
    try {
      await ordersApi.updateStatus(orderId, status);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Status update failed');
    }
  };

  const updatePayment = async (orderId, paymentStatus) => {
    try {
      await ordersApi.updatePayment(orderId, paymentStatus);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Payment status update failed');
    }
  };

  const setTracking = async (order) => {
    const tracking = window.prompt('Enter tracking ID', order.tracking_id || '');
    if (!tracking) return;
    try {
      await ordersApi.updateTracking(order.id, tracking);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Tracking update failed');
    }
  };

  const summary = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((o) => ['PENDING', 'PLACED'].includes(o.status)).length;
    const delivered = rows.filter((o) => o.status === 'DELIVERED').length;
    return { total, pending, delivered };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel title="Total Orders"><p className="text-3xl font-bold">{summary.total}</p></Panel>
        <Panel title="Pending"><p className="text-3xl font-bold text-amber-600">{summary.pending}</p></Panel>
        <Panel title="Delivered"><p className="text-3xl font-bold text-emerald-700">{summary.delivered}</p></Panel>
      </div>

      <Panel title="Filter Orders">
        <form className="flex flex-col gap-3 md:flex-row" onSubmit={onFilter}>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={filters.q}
              onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
              placeholder="Search order id or address"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Apply</button>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm" onClick={load}>
            <RefreshCcw size={15} />
            Refresh
          </button>
        </form>
      </Panel>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <Panel title="Order Management">
        {loading ? (
          <Loader label="Loading orders..." />
        ) : rows.length === 0 ? (
          <EmptyState title="No orders found" subtitle="Try adjusting filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-head text-left">Order</th>
                  <th className="table-head text-left">Amount</th>
                  <th className="table-head text-left">Status</th>
                  <th className="table-head text-left">Payment</th>
                  <th className="table-head text-left">Tracking</th>
                  <th className="table-head text-left">Placed</th>
                  <th className="table-head text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((order) => (
                  <tr key={order.id}>
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900">{order.order_number}</p>
                      <p className="max-w-[280px] truncate text-xs text-slate-500">{order.shipping_address}</p>
                    </td>
                    <td className="table-cell font-semibold">{formatCurrency(order.total)}</td>
                    <td className="table-cell">
                      <StatusBadge label={order.status} tone={statusTone(order.status)} />
                    </td>
                    <td className="table-cell">
                      <StatusBadge label={order.payment_status} tone={order.payment_status === 'PAID' ? 'success' : 'warning'} />
                    </td>
                    <td className="table-cell text-xs text-slate-600">{order.tracking_id || '-'}</td>
                    <td className="table-cell">{formatDateTime(order.created_at)}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={order.status}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          onChange={(e) => updateStatus(order.id, e.target.value)}
                        >
                          {ORDER_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <select
                          value={order.payment_status}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          onChange={(e) => updatePayment(order.id, e.target.value)}
                        >
                          {PAYMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => setTracking(order)}>
                          Tracking
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
};
