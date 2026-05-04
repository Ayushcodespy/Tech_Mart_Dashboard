import { useEffect, useState } from 'react';

import { inventoryApi } from '../api/endpoints';
import { EmptyState } from '../components/ui/EmptyState';
import { Loader } from '../components/ui/Loader';
import { Panel } from '../components/ui/Panel';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDateTime } from '../components/ui/utils';

const initialAdjustment = { product_id: '', delta_qty: '', reason: '' };

export const InventoryPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lowStock, setLowStock] = useState([]);
  const [logs, setLogs] = useState([]);
  const [adjustment, setAdjustment] = useState(initialAdjustment);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [lowRes, logsRes] = await Promise.all([
        inventoryApi.lowStock({ page: 1, pageSize: 50 }),
        inventoryApi.logs({ page: 1, pageSize: 50 }),
      ]);
      setLowStock(lowRes.data.data || []);
      setLogs(logsRes.data.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitAdjustment = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await inventoryApi.adjust({
        product_id: Number(adjustment.product_id),
        delta_qty: Number(adjustment.delta_qty),
        reason: adjustment.reason,
      });
      setAdjustment(initialAdjustment);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Stock adjustment failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Manual Stock Adjustment">
          <form className="space-y-3" onSubmit={submitAdjustment}>
            <label className="block text-sm">Product ID
              <input required type="number" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={adjustment.product_id} onChange={(e) => setAdjustment((prev) => ({ ...prev, product_id: e.target.value }))} />
            </label>
            <label className="block text-sm">Delta Quantity (+/-)
              <input required type="number" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={adjustment.delta_qty} onChange={(e) => setAdjustment((prev) => ({ ...prev, delta_qty: e.target.value }))} />
            </label>
            <label className="block text-sm">Reason
              <textarea rows={2} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={adjustment.reason} onChange={(e) => setAdjustment((prev) => ({ ...prev, reason: e.target.value }))} />
            </label>
            <button disabled={saving} className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'Saving...' : 'Apply Adjustment'}
            </button>
          </form>
        </Panel>

        <Panel title="Low Stock Alerts" className="xl:col-span-2">
          {loading ? (
            <Loader label="Checking stock levels..." />
          ) : lowStock.length === 0 ? (
            <EmptyState title="No low stock products" subtitle="All products are above threshold." />
          ) : (
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
                  {lowStock.map((row) => (
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
          )}
        </Panel>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <Panel title="Inventory Logs">
        {loading ? (
          <Loader label="Loading logs..." />
        ) : logs.length === 0 ? (
          <EmptyState title="No logs" subtitle="Stock movement logs will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-head text-left">Time</th>
                  <th className="table-head text-left">Product ID</th>
                  <th className="table-head text-left">Action</th>
                  <th className="table-head text-left">Before</th>
                  <th className="table-head text-left">Delta</th>
                  <th className="table-head text-left">After</th>
                  <th className="table-head text-left">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="table-cell text-xs">{formatDateTime(log.created_at)}</td>
                    <td className="table-cell">{log.product_id}</td>
                    <td className="table-cell"><StatusBadge label={log.action_type} tone="info" /></td>
                    <td className="table-cell">{log.before_qty}</td>
                    <td className="table-cell">{log.change_qty}</td>
                    <td className="table-cell">{log.after_qty}</td>
                    <td className="table-cell text-xs text-slate-500">{log.reason || '-'}</td>
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
