import { useEffect, useState } from 'react';
import { ImagePlus, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';

import { categoriesApi, productsApi } from '../api/endpoints';
import { resolveAssetUrl } from '../api/client';
import { EmptyState } from '../components/ui/EmptyState';
import { Loader } from '../components/ui/Loader';
import { Panel } from '../components/ui/Panel';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatCurrency, formatDateTime } from '../components/ui/utils';

const initialProduct = {
  category_id: '',
  name: '',
  description: '',
  price: 0,
  discount_percent: 0,
  stock_qty: 0,
  low_stock_threshold: 10,
  is_featured: false,
  is_active: true,
};

export const ProductsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [updatingCategoryId, setUpdatingCategoryId] = useState(null);
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page_size: 20 });
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialProduct);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        productsApi.list({ page, pageSize: 20, q: query }),
        categoriesApi.list({ page: 1, pageSize: 100 }),
      ]);
      setRows(productsRes.data.data || []);
      setMeta(productsRes.data.meta || { total: 0, page_size: 20 });
      setCategories(categoriesRes.data.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  const onSearch = (event) => {
    event.preventDefault();
    setPage(1);
    load();
  };

  const createProduct = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await productsApi.create({
        ...form,
        category_id: form.category_id === '' ? null : Number(form.category_id),
        price: Number(form.price),
        discount_percent: Number(form.discount_percent),
        stock_qty: Number(form.stock_qty),
        low_stock_threshold: Number(form.low_stock_threshold),
      });
      setShowCreate(false);
      setForm(initialProduct);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = async (product, nextCategoryId) => {
    setUpdatingCategoryId(product.id);
    setError('');
    try {
      await productsApi.update(product.id, {
        category_id: nextCategoryId === '' ? null : Number(nextCategoryId),
      });
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Category update failed');
    } finally {
      setUpdatingCategoryId(null);
    }
  };

  const patchBooleanField = async (handler, product, nextValue) => {
    try {
      await handler(product.id, nextValue);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Update failed');
    }
  };

  const adjustStock = async (product) => {
    const raw = window.prompt(`Adjust stock for ${product.name} (use + or - number):`, '10');
    if (!raw) return;
    const delta = Number(raw);
    if (Number.isNaN(delta) || delta === 0) return;
    try {
      await productsApi.adjustStock(product.id, { delta_qty: delta, reason: 'Admin dashboard adjustment' });
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Stock update failed');
    }
  };

  const updatePrice = async (product) => {
    const priceRaw = window.prompt(`New price for ${product.name}`, String(product.price));
    if (!priceRaw) return;
    const discountRaw = window.prompt('Discount percent', String(product.discount_percent));
    if (discountRaw === null) return;
    try {
      await productsApi.updatePrice(product.id, {
        price: Number(priceRaw),
        discountPercent: Number(discountRaw),
      });
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Price update failed');
    }
  };

  const removeProduct = async (product) => {
    const confirmed = window.confirm(`Delete ${product.name}?`);
    if (!confirmed) return;
    try {
      await productsApi.remove(product.id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Delete failed');
    }
  };

  const uploadMainImage = async (product, file) => {
    if (!file) return;
    setUploadingId(product.id);
    try {
      await productsApi.uploadMainImage(product.id, file);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Image upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Filters"
        actions={
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={16} />
            Add Product
          </button>
        }
      >
        <form className="flex flex-col gap-3 md:flex-row" onSubmit={onSearch}>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or SKU"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
            Apply
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
            onClick={load}
          >
            <RefreshCcw size={15} />
            Refresh
          </button>
        </form>
      </Panel>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <Panel title={`Products (${meta.total || 0})`}>
        {loading ? (
          <Loader label="Loading products..." />
        ) : rows.length === 0 ? (
          <EmptyState title="No products found" subtitle="Create your first product from Add Product button." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="table-head text-left">Product</th>
                  <th className="table-head text-left">Category</th>
                  <th className="table-head text-left">Price</th>
                  <th className="table-head text-left">Stock</th>
                  <th className="table-head text-left">Status</th>
                  <th className="table-head text-left">Created</th>
                  <th className="table-head text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((product) => (
                  <tr key={product.id}>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-100">
                          {product.image_url ? (
                            <img src={resolveAssetUrl(product.image_url)} alt={product.name} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">SKU: {product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <select
                        value={product.category_id ?? ''}
                        disabled={updatingCategoryId === product.id}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        onChange={(e) => updateCategory(product, e.target.value)}
                      >
                        <option value="">None</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900">{formatCurrency(product.final_price)}</p>
                      <p className="text-xs text-slate-500">Base {formatCurrency(product.price)} | {product.discount_percent}% off</p>
                    </td>
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900">{product.stock_qty}</p>
                      <p className="text-xs text-slate-500">Threshold {product.low_stock_threshold}</p>
                    </td>
                    <td className="table-cell space-y-1">
                      <StatusBadge label={product.is_active ? 'Active' : 'Disabled'} tone={product.is_active ? 'success' : 'danger'} />
                      {product.is_featured ? <StatusBadge label="Featured" tone="info" /> : null}
                    </td>
                    <td className="table-cell">{formatDateTime(product.created_at)}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => updatePrice(product)}>
                          Price
                        </button>
                        <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => adjustStock(product)}>
                          Stock
                        </button>
                        <button
                          className="rounded-lg border px-2 py-1 text-xs"
                          onClick={() => patchBooleanField(productsApi.setStatus, product, !product.is_active)}
                        >
                          {product.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          className="rounded-lg border px-2 py-1 text-xs"
                          onClick={() => patchBooleanField(productsApi.setFeatured, product, !product.is_featured)}
                        >
                          {product.is_featured ? 'Unfeature' : 'Feature'}
                        </button>
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-xs">
                          <ImagePlus size={13} />
                          {uploadingId === product.id ? 'Uploading...' : 'Image'}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => uploadMainImage(product, e.target.files?.[0])}
                          />
                        </label>
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700"
                          onClick={() => removeProduct(product)}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-sm">
          <span className="text-slate-500">Page {page} of {Math.max(1, Math.ceil((meta.total || 0) / (meta.page_size || 20)))}</span>
          <div className="flex gap-2">
            <button
              className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((prev) => prev - 1)}
            >
              Prev
            </button>
            <button
              className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
              disabled={page >= Math.ceil((meta.total || 0) / (meta.page_size || 20))}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </Panel>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Add Product</h3>
              <button className="text-sm text-slate-500" onClick={() => setShowCreate(false)}>Close</button>
            </div>

            <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={createProduct}>
              <label className="text-sm">Category
                <select
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={form.category_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, category_id: e.target.value }))}
                >
                  <option value="">None</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">Name
                <input
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label className="text-sm md:col-span-2">Description
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
              <label className="text-sm">Price
                <input type="number" min="1" step="0.01" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={form.price}
                  onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                />
              </label>
              <label className="text-sm">Discount %
                <input type="number" min="0" max="90" step="0.1" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={form.discount_percent}
                  onChange={(e) => setForm((prev) => ({ ...prev, discount_percent: e.target.value }))}
                />
              </label>
              <label className="text-sm">Stock Qty
                <input type="number" min="0" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={form.stock_qty}
                  onChange={(e) => setForm((prev) => ({ ...prev, stock_qty: e.target.value }))}
                />
              </label>
              <label className="text-sm">Low Stock Threshold
                <input type="number" min="0" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={form.low_stock_threshold}
                  onChange={(e) => setForm((prev) => ({ ...prev, low_stock_threshold: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_featured: e.target.checked }))}
                />
                Featured product
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                Active
              </label>

              <div className="md:col-span-2 mt-2 flex justify-end gap-2">
                <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setShowCreate(false)}>Cancel</button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};
