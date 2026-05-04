import crypto from 'crypto';

export const ORDER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'PACKED',
  'SHIPPED',
  'REJECTED',
  'PLACED',
  'CONFIRMED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED'];
export const USER_ROLES = ['USER', 'STAFF', 'MANAGER', 'SUPER_ADMIN', 'ADMIN'];
export const ADMIN_ROLES = ['STAFF', 'MANAGER', 'SUPER_ADMIN', 'ADMIN'];
export const MANAGER_ROLES = ['MANAGER', 'SUPER_ADMIN', 'ADMIN'];
export const SUPER_ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
export const BANNER_TYPES = ['HOME_SLIDER', 'OFFER', 'CATEGORY'];

export const toNumber = (value) => {
  if (value === null || value === undefined) return value;
  return Number(value);
};

export const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

export const paginationFromQuery = (query) => {
  const page = Math.max(Number.parseInt(query.page ?? '1', 10) || 1, 1);
  const rawPageSize = Number.parseInt(query.page_size ?? '20', 10) || 20;
  const pageSize = Math.min(Math.max(rawPageSize, 1), 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
};

export const paginated = (data, meta) => ({
  success: true,
  data,
  meta: {
    page: meta.page,
    page_size: meta.pageSize,
    total: Number(meta.total || 0),
  },
});

export const slugify = (text) => {
  let clean = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean || 'product';
};

export const generateSku = (prefix = 'PRD') =>
  `${prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;

export const computeFinalPrice = (price, discountPercent = 0) => {
  const base = Number(price);
  const discount = (base * Number(discountPercent || 0)) / 100;
  return Math.max(base - discount, 0.01).toFixed(2);
};

export const isOutOfStock = (stockQty) => Number(stockQty) <= 0;

export const orderNumber = () => {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `ORD-${stamp}-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
};

export const parseIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
