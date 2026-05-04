import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { resolveAssetUrl } from '../api/client';
import { bannersApi } from '../api/endpoints';
import { EmptyState } from '../components/ui/EmptyState';
import { Loader } from '../components/ui/Loader';
import { Panel } from '../components/ui/Panel';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDateTime } from '../components/ui/utils';

const initialBanner = {
  type: 'HOME_SLIDER',
  title: '',
  subtitle: '',
  redirect_url: '',
  is_active: true,
  display_order: 0,
  start_date: '',
  end_date: '',
  image: null,
};

export const BannersPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(initialBanner);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await bannersApi.list({ page: 1, pageSize: 100 });
      setRows(data.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createBanner = async (event) => {
    event.preventDefault();
    if (!form.image) {
      setError('Banner image is required');
      return;
    }

    setSaving(true);
    setError('');
    const fd = new FormData();
    fd.append('type', form.type);
    fd.append('title', form.title);
    if (form.subtitle) fd.append('subtitle', form.subtitle);
    if (form.redirect_url) fd.append('redirect_url', form.redirect_url);
    fd.append('is_active', String(form.is_active));
    fd.append('display_order', String(form.display_order));
    if (form.start_date) fd.append('start_date', form.start_date);
    if (form.end_date) fd.append('end_date', form.end_date);
    fd.append('image', form.image);

    try {
      await bannersApi.create(fd);
      setForm(initialBanner);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create banner');
    } finally {
      setSaving(false);
    }
  };

  const removeBanner = async (id) => {
    if (!window.confirm('Delete this banner?')) return;
    try {
      await bannersApi.remove(id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Delete failed');
    }
  };

  const toggleActive = async (banner) => {
    const fd = new FormData();
    fd.append('is_active', String(!banner.is_active));
    try {
      await bannersApi.update(banner.id, fd);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Update failed');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <Panel title="Create Banner" className="xl:col-span-2">
        <form className="space-y-3" onSubmit={createBanner}>
          <label className="block text-sm">Type
            <select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}>
              <option value="HOME_SLIDER">Home Slider</option>
              <option value="OFFER">Offer</option>
              <option value="CATEGORY">Category</option>
            </select>
          </label>
          <label className="block text-sm">Title
            <input required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
          </label>
          <label className="block text-sm">Subtitle
            <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={form.subtitle} onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))} />
          </label>
          <label className="block text-sm">Redirect URL
            <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={form.redirect_url} onChange={(e) => setForm((prev) => ({ ...prev, redirect_url: e.target.value }))} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">Start Date
              <input type="datetime-local" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={form.start_date} onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))} />
            </label>
            <label className="block text-sm">End Date
              <input type="datetime-local" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={form.end_date} onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">Display Order
              <input type="number" min="0" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={form.display_order} onChange={(e) => setForm((prev) => ({ ...prev, display_order: e.target.value }))} />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} />
              Active banner
            </label>
          </div>
          <label className="block text-sm">Image
            <input type="file" accept="image/*" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.files?.[0] || null }))} />
          </label>

          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

          <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            <Plus size={16} />
            {saving ? 'Saving...' : 'Create Banner'}
          </button>
        </form>
      </Panel>

      <Panel title={`Banner List (${rows.length})`} className="xl:col-span-3">
        {loading ? (
          <Loader label="Loading banners..." />
        ) : rows.length === 0 ? (
          <EmptyState title="No banners" subtitle="Create your first campaign banner." />
        ) : (
          <div className="space-y-3">
            {rows.map((banner) => (
              <article key={banner.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <img src={resolveAssetUrl(banner.image_url)} alt={banner.title} className="h-24 w-full rounded-lg object-cover md:w-48" />
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{banner.title}</h4>
                        <p className="text-xs text-slate-500">{banner.subtitle || 'No subtitle'}</p>
                        <p className="text-xs text-slate-400">Order: {banner.display_order} | {banner.type}</p>
                        <p className="text-xs text-slate-400">Created {formatDateTime(banner.created_at)}</p>
                      </div>
                      <StatusBadge label={banner.is_active ? 'Active' : 'Inactive'} tone={banner.is_active ? 'success' : 'danger'} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => toggleActive(banner)}>
                        {banner.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700"
                        onClick={() => removeBanner(banner.id)}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};
