import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Gamepad2,
  HardDrive,
  Headphones,
  Keyboard,
  Laptop,
  Monitor,
  Mouse,
  Pencil,
  Plus,
  Smartphone,
  Speaker,
  Tablet,
  Trash2,
  Tv,
  Watch,
} from 'lucide-react';

import { resolveAssetUrl } from '../api/client';
import { categoriesApi } from '../api/endpoints';
import { EmptyState } from '../components/ui/EmptyState';
import { Loader } from '../components/ui/Loader';
import { Panel } from '../components/ui/Panel';
import { formatDateTime } from '../components/ui/utils';

const CATEGORY_ICONS = [
  { name: 'Smartphone', label: 'Mobiles', Icon: Smartphone },
  { name: 'Laptop', label: 'Laptops', Icon: Laptop },
  { name: 'Tv', label: 'TV', Icon: Tv },
  { name: 'Watch', label: 'Watches', Icon: Watch },
  { name: 'Headphones', label: 'Audio', Icon: Headphones },
  { name: 'Camera', label: 'Cameras', Icon: Camera },
  { name: 'Gamepad2', label: 'Gaming', Icon: Gamepad2 },
  { name: 'Tablet', label: 'Tablets', Icon: Tablet },
  { name: 'Monitor', label: 'Monitors', Icon: Monitor },
  { name: 'Speaker', label: 'Speakers', Icon: Speaker },
  { name: 'Keyboard', label: 'Keyboards', Icon: Keyboard },
  { name: 'Mouse', label: 'Mouse', Icon: Mouse },
  { name: 'HardDrive', label: 'Storage', Icon: HardDrive },
];

const CATEGORY_ICON_MAP = Object.fromEntries(CATEGORY_ICONS.map((item) => [item.name, item.Icon]));

const LEGACY_ICON_ALIASES = {
  apple: 'Smartphone',
  eco: 'Laptop',
  local_florist: 'Camera',
  spa: 'Watch',
  nutrition: 'Smartphone',
  grain: 'HardDrive',
  bakery_dining: 'Headphones',
  local_grocery_store: 'Laptop',
  'healthicons:vegetables': 'Smartphone',
  'healthicons:vegetables-outline': 'Smartphone',
  'healthicons:fruits': 'Smartphone',
  'ph:bowl-food': 'Laptop',
  'mdi:cart-outline': 'Laptop',
  'mdi:basket-outline': 'Laptop',
  'material-symbols:shopping-basket-outline-rounded': 'Laptop',
  'mdi:leaf': 'Laptop',
  'tabler:leaf': 'Laptop',
  'tabler:plant-2': 'Laptop',
  'material-symbols:eco-outline-rounded': 'Laptop',
  'mdi:sprout-outline': 'Watch',
  'mdi:food-apple-outline': 'Smartphone',
  'mdi:fruit-cherries': 'Smartphone',
  'mdi:fruit-grapes-outline': 'Smartphone',
  'mdi:fruit-watermelon': 'Smartphone',
  'ph:orange-slice': 'Smartphone',
  'mdi:carrot': 'Smartphone',
  'fluent:food-carrot-20-regular': 'Smartphone',
  'mdi:corn': 'Smartphone',
  'material-symbols:nutrition-outline-rounded': 'Smartphone',
  'mdi:rice': 'HardDrive',
  'mdi:seed-outline': 'HardDrive',
  'mdi:baguette': 'Headphones',
  'game-icons:powder-bag': 'Laptop',
};

const normalizeCategoryIconName = (value) => {
  const normalized = String(value || '').trim();
  if (CATEGORY_ICON_MAP[normalized]) return normalized;
  const mapped =
    LEGACY_ICON_ALIASES[normalized] || LEGACY_ICON_ALIASES[normalized.toLowerCase()] || 'Laptop';
  return CATEGORY_ICON_MAP[mapped] ? mapped : 'Laptop';
};

const resolveCategoryImageUrl = (value) => {
  if (!value) return '';
  if (
    value.startsWith('blob:') ||
    value.startsWith('data:') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  ) {
    return value;
  }
  return resolveAssetUrl(value);
};

const initialForm = {
  name: '',
  slug: '',
  icon_name: 'Laptop',
  image: null,
  existing_image_url: '',
  clear_image: false,
};

const buildCategoryPayload = (form) => {
  const payload = new FormData();
  payload.append('name', form.name.trim());
  payload.append('slug', form.slug.trim());
  payload.append('icon_name', form.icon_name);
  if (form.image) payload.append('image', form.image);
  if (form.clear_image) payload.append('clear_image', 'true');
  return payload;
};

function CategoryVisual({ iconName, imageUrl, name, sizeClass = 'h-14 w-14', iconSize = 28 }) {
  const Icon = CATEGORY_ICON_MAP[normalizeCategoryIconName(iconName)] || Laptop;
  const resolvedImageUrl = resolveCategoryImageUrl(imageUrl);

  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-2xl bg-slate-50 text-brand-700 ${sizeClass}`}>
      {resolvedImageUrl ? (
        <img src={resolvedImageUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <Icon size={iconSize} />
      )}
    </div>
  );
}

export const CategoriesPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteStrategy, setDeleteStrategy] = useState('set_null');
  const objectPreviewUrlRef = useRef('');

  const clearObjectPreview = () => {
    if (objectPreviewUrlRef.current) {
      URL.revokeObjectURL(objectPreviewUrlRef.current);
      objectPreviewUrlRef.current = '';
    }
  };

  const syncPreviewWithStoredImage = (value = '') => {
    clearObjectPreview();
    setImagePreviewUrl(resolveCategoryImageUrl(value));
  };

  const syncPreviewWithFile = (file) => {
    clearObjectPreview();
    if (!file) {
      setImagePreviewUrl('');
      return;
    }
    objectPreviewUrlRef.current = URL.createObjectURL(file);
    setImagePreviewUrl(objectPreviewUrlRef.current);
  };

  const resetEditor = () => {
    clearObjectPreview();
    setForm(initialForm);
    setEditingId(null);
    setImagePreviewUrl('');
    setFileInputKey((value) => value + 1);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await categoriesApi.list({ page: 1, pageSize: 100 });
      setRows(data.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => clearObjectPreview();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = buildCategoryPayload(form);
      if (editingId) {
        await categoriesApi.update(editingId, payload);
      } else {
        await categoriesApi.create(payload);
      }
      resetEditor();
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      slug: row.slug,
      icon_name: normalizeCategoryIconName(row.icon_name),
      image: null,
      existing_image_url: row.image_url || '',
      clear_image: false,
    });
    syncPreviewWithStoredImage(row.image_url || '');
    setFileInputKey((value) => value + 1);
  };

  const onImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    setForm((prev) => ({
      ...prev,
      image: file,
      clear_image: false,
    }));

    if (file) {
      syncPreviewWithFile(file);
      return;
    }

    syncPreviewWithStoredImage(form.existing_image_url);
  };

  const clearImageSelection = () => {
    setForm((prev) => ({
      ...prev,
      image: null,
      clear_image: Boolean(prev.existing_image_url),
      existing_image_url: '',
    }));
    syncPreviewWithStoredImage('');
    setFileInputKey((value) => value + 1);
  };

  const openDeleteDialog = (row) => {
    setDeleteTarget(row);
    setDeleteStrategy('set_null');
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteStrategy('set_null');
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      const params = deleteTarget.product_count > 0 ? { product_strategy: deleteStrategy } : undefined;
      await categoriesApi.remove(deleteTarget.id, params);
      setDeleteTarget(null);
      setDeleteStrategy('set_null');
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <Panel title={editingId ? 'Edit Category' : 'Create Category'} className="xl:col-span-2">
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm">
            Category Name
            <input
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </label>

          <label className="block text-sm">
            Slug
            <input
              required
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
            />
          </label>

          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-slate-900">Choose Icon</p>
              <p className="text-xs text-slate-500">These are local icons, so they do not depend on Flutter icon names.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              {CATEGORY_ICONS.map(({ name, label, Icon }) => {
                const selected = form.icon_name === name;
                return (
                  <button
                    type="button"
                    key={name}
                    onClick={() => setForm((prev) => ({ ...prev, icon_name: name }))}
                    className={`min-w-0 rounded-xl border px-3 py-3 text-left transition ${
                      selected ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300'
                    }`}
                    title={`${label} (${name})`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-brand-700">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
                        <p className="truncate text-[11px] text-slate-500">{name}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block text-sm">
            Upload Category Image
            <input
              key={fileInputKey}
              type="file"
              accept="image/*"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              onChange={onImageChange}
            />
            <span className="mt-1 block text-xs text-slate-500">
              If an image is uploaded, the app will show that image instead of the icon.
            </span>
          </label>

          {imagePreviewUrl ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">Image Preview</p>
                <button
                  type="button"
                  className="text-xs font-medium text-rose-600"
                  onClick={clearImageSelection}
                >
                  Remove Image
                </button>
              </div>
              <img src={imagePreviewUrl} alt={form.name || 'Category preview'} className="h-32 w-full rounded-xl object-cover" />
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-800">Selected Preview</p>
            <div className="mt-3 flex items-center gap-3">
              <CategoryVisual
                iconName={form.icon_name}
                imageUrl={imagePreviewUrl}
                name={form.name || 'Category preview'}
                sizeClass="h-16 w-16"
                iconSize={30}
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">{form.name || 'Category preview'}</p>
                <p className="text-xs text-slate-500">
                  {imagePreviewUrl ? 'Custom image selected' : `Fallback icon: ${form.icon_name}`}
                </p>
              </div>
            </div>
          </div>

          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

          <div className="flex gap-2">
            <button
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Plus size={16} />
              {saving ? 'Saving...' : editingId ? 'Update Category' : 'Create Category'}
            </button>
            {editingId ? (
              <button
                type="button"
                className="rounded-xl border px-4 py-2.5 text-sm"
                onClick={resetEditor}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel title={`Categories (${rows.length})`} className="xl:col-span-3">
        {loading ? (
          <Loader label="Loading categories..." />
        ) : rows.length === 0 ? (
          <EmptyState title="No categories" subtitle="Create the first category from the form." />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CategoryVisual
                      iconName={row.icon_name}
                      imageUrl={row.image_url}
                      name={row.name}
                      sizeClass="h-16 w-16 shrink-0"
                      iconSize={28}
                    />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{row.name}</h4>
                      <p className="text-xs text-slate-500">Slug: {row.slug}</p>
                      <p className="text-xs text-slate-500">
                        Display: {row.image_url ? 'Custom image' : normalizeCategoryIconName(row.icon_name)}
                      </p>
                      <p className="text-xs text-slate-500">Products: {row.product_count || 0}</p>
                      <p className="text-xs text-slate-400">Created {formatDateTime(row.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs" onClick={() => startEdit(row)}>
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-xs text-rose-700"
                      onClick={() => openDeleteDialog(row)}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Delete Category</h3>
              <button className="text-sm text-slate-500" onClick={closeDeleteDialog}>Close</button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Delete <span className="font-semibold text-slate-900">{deleteTarget.name}</span>?
              </p>

              {deleteTarget.product_count > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    This category has <span className="font-semibold text-slate-900">{deleteTarget.product_count}</span> product(s). Choose what should happen to them.
                  </p>

                  <label className={`block cursor-pointer rounded-xl border p-3 ${deleteStrategy === 'set_null' ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="category-delete-strategy"
                        checked={deleteStrategy === 'set_null'}
                        onChange={() => setDeleteStrategy('set_null')}
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Keep products and set category to None</p>
                        <p className="text-xs text-slate-500">Products will stay in catalog, but their category will become unassigned.</p>
                      </div>
                    </div>
                  </label>

                  <label className={`block cursor-pointer rounded-xl border p-3 ${deleteStrategy === 'delete_products' ? 'border-rose-400 bg-rose-50' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="category-delete-strategy"
                        checked={deleteStrategy === 'delete_products'}
                        onChange={() => setDeleteStrategy('delete_products')}
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Delete all products in this category</p>
                        <p className="text-xs text-slate-500">Products, cart references, and linked product records under this category will be removed.</p>
                      </div>
                    </div>
                  </label>
                </div>
              ) : (
                <p className="text-sm text-slate-600">This category has no linked products.</p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={closeDeleteDialog}>
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={remove}
              >
                {deleting ? 'Deleting...' : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
