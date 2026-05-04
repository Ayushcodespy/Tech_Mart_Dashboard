import { getOne, query } from './db.js';
import { serializeCart, serializeOrder, serializeProduct } from './serializers.js';

const groupBy = (rows, key) =>
  rows.reduce((map, row) => {
    const groupKey = row[key];
    if (!map.has(groupKey)) map.set(groupKey, []);
    map.get(groupKey).push(row);
    return map;
  }, new Map());

export const productImagesByProductId = async (productIds, client = { query }) => {
  if (!productIds.length) return new Map();
  const result = await client.query(
    `
      SELECT id, product_id, image_url, is_primary, sort_order
      FROM product_images
      WHERE product_id = ANY($1::int[])
      ORDER BY is_primary DESC, sort_order ASC, id ASC
    `,
    [productIds],
  );
  return groupBy(result.rows, 'product_id');
};

export const serializeProductsWithImages = async (products, client = { query }) => {
  const images = await productImagesByProductId(products.map((item) => item.id), client);
  return products.map((item) => serializeProduct(item, images.get(item.id) || []));
};

export const getProductPayload = async (productId, client = { query }) => {
  const result = await client.query('SELECT * FROM products WHERE id = $1', [productId]);
  const product = result.rows[0] || null;
  if (!product) return null;
  const images = await productImagesByProductId([product.id], client);
  return serializeProduct(product, images.get(product.id) || []);
};

export const orderItemsByOrderId = async (orderIds, client = { query }) => {
  if (!orderIds.length) return new Map();
  const result = await client.query(
    `
      SELECT *
      FROM order_items
      WHERE order_id = ANY($1::int[])
      ORDER BY id ASC
    `,
    [orderIds],
  );
  return groupBy(result.rows, 'order_id');
};

export const serializeOrdersWithItems = async (orders, client = { query }) => {
  const items = await orderItemsByOrderId(orders.map((order) => order.id), client);
  return orders.map((order) => serializeOrder(order, items.get(order.id) || []));
};

export const getOrderPayload = async (orderId, client = { query }) => {
  const result = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = result.rows[0] || null;
  if (!order) return null;
  const items = await orderItemsByOrderId([order.id], client);
  return serializeOrder(order, items.get(order.id) || []);
};

export const getOrCreateCart = async (userId, client = { query }) => {
  const existing = await client.query('SELECT * FROM carts WHERE user_id = $1', [userId]);
  if (existing.rows[0]) return existing.rows[0];

  const created = await client.query(
    'INSERT INTO carts (user_id) VALUES ($1) RETURNING *',
    [userId],
  );
  return created.rows[0];
};

export const getCartPayload = async (userId, client = { query }) => {
  const cart = await getOrCreateCart(userId, client);
  const result = await client.query(
    `
      SELECT ci.id, ci.product_id, ci.quantity, p.name, p.final_price
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = $1
      ORDER BY ci.id ASC
    `,
    [cart.id],
  );
  return serializeCart(cart, result.rows);
};

export const findUserByEmail = (email) =>
  getOne('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
