import { toNumber } from './utils.js';

export const serializeUser = (row) => ({
  id: row.id,
  email: row.email,
  phone: row.phone,
  full_name: row.full_name,
  address_line1: row.address_line1,
  address_line2: row.address_line2,
  landmark: row.landmark,
  city: row.city,
  state: row.state,
  postal_code: row.postal_code,
  country: row.country,
  role: row.role,
  is_active: row.is_active,
  order_count: Number(row.order_count || 0),
  inventory_log_count: Number(row.inventory_log_count || 0),
  activity_log_count: Number(row.activity_log_count || 0),
  wishlist_count: Number(row.wishlist_count || 0),
  created_at: row.created_at,
});

export const serializeProductImage = (row) => ({
  id: row.id,
  image_url: row.image_url,
  is_primary: row.is_primary,
  sort_order: row.sort_order,
});

export const serializeProduct = (row, images = []) => ({
  id: row.id,
  category_id: row.category_id,
  name: row.name,
  slug: row.slug,
  sku: row.sku,
  description: row.description,
  price: toNumber(row.price),
  discount_percent: toNumber(row.discount_percent),
  final_price: toNumber(row.final_price),
  stock_qty: row.stock_qty,
  low_stock_threshold: row.low_stock_threshold,
  image_url: row.image_url,
  is_featured: row.is_featured,
  is_out_of_stock: row.is_out_of_stock,
  is_active: row.is_active,
  created_at: row.created_at,
  images: images.map(serializeProductImage),
});

export const serializeCategory = (row) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  icon_name: row.icon_name,
  image_url: row.image_url,
  parent_id: row.parent_id,
  product_count: Number(row.product_count || 0),
  created_at: row.created_at,
});

export const serializeBanner = (row) => ({
  id: row.id,
  type: row.type,
  image_url: row.image_url,
  title: row.title,
  subtitle: row.subtitle,
  redirect_url: row.redirect_url,
  is_active: row.is_active,
  display_order: row.display_order,
  start_date: row.start_date,
  end_date: row.end_date,
  created_at: row.created_at,
});

export const serializeInventoryLog = (row) => ({
  id: row.id,
  product_id: row.product_id,
  action_type: row.action_type,
  change_qty: row.change_qty,
  before_qty: row.before_qty,
  after_qty: row.after_qty,
  reason: row.reason,
  reference_id: row.reference_id,
  performed_by: row.performed_by,
  created_at: row.created_at,
});

export const serializeOrderItem = (row) => ({
  id: row.id,
  product_id: row.product_id,
  product_name_snapshot: row.product_name_snapshot,
  unit_price: toNumber(row.unit_price),
  quantity: row.quantity,
  line_total: toNumber(row.line_total),
});

export const serializeOrder = (row, items = []) => ({
  id: row.id,
  order_number: row.order_number,
  status: row.status,
  payment_method: row.payment_method,
  payment_status: row.payment_status,
  tracking_id: row.tracking_id,
  shipping_address: row.shipping_address,
  subtotal: toNumber(row.subtotal),
  delivery_fee: toNumber(row.delivery_fee),
  total: toNumber(row.total),
  created_at: row.created_at,
  items: items.map(serializeOrderItem),
});

export const serializeCart = (cart, items = []) => {
  const data = items
    .filter((item) => item.product_id)
    .map((item) => {
      const unitPrice = toNumber(item.final_price);
      const quantity = Number(item.quantity);
      return {
        id: item.id,
        product_id: item.product_id,
        product_name: item.name,
        unit_price: unitPrice,
        quantity,
        line_total: Number((unitPrice * quantity).toFixed(2)),
      };
    });

  const subtotal = data.reduce((sum, item) => sum + item.line_total, 0);
  return {
    id: cart.id,
    user_id: cart.user_id,
    items: data,
    subtotal: Number(subtotal.toFixed(2)),
  };
};
