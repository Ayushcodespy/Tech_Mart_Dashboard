import { Router } from 'express';

import { requireAdmin, requireManager, requireUser } from '../auth.js';
import { getOrCreateCart, getOrderPayload, serializeOrdersWithItems } from '../data.js';
import { getOne, query, withTransaction } from '../db.js';
import { AppError, asyncHandler } from '../errors.js';
import {
  ADMIN_ROLES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  orderNumber,
  paginated,
  paginationFromQuery,
} from '../utils.js';

const router = Router();
const DELIVERY_FEE = 0;

const composeUserAddress = (user) => {
  const required = [user.address_line1, user.city, user.state, user.postal_code, user.country];
  if (required.some((part) => !part || !String(part).trim())) return null;

  return [
    user.address_line1,
    user.address_line2,
    user.landmark,
    [user.city, user.state].filter(Boolean).join(', '),
    user.postal_code,
    user.country,
  ]
    .filter((part) => part && String(part).trim())
    .map((part) => String(part).trim())
    .join(', ');
};

const listOrders = async ({ req, res, admin = false }) => {
  const { page, pageSize, offset } = paginationFromQuery(req.query);
  const where = [];
  const params = [];

  if (!admin) {
    params.push(req.user.id);
    where.push(`user_id = $${params.length}`);
  }
  if (req.query.status_filter) {
    params.push(req.query.status_filter);
    where.push(`status = $${params.length}`);
  }
  if (admin && req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(order_number ILIKE $${params.length} OR shipping_address ILIKE $${params.length})`);
  }
  if (admin && req.query.date_from) {
    params.push(new Date(req.query.date_from));
    where.push(`created_at >= $${params.length}`);
  }
  if (admin && req.query.date_to) {
    params.push(new Date(req.query.date_to));
    where.push(`created_at <= $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await query(`SELECT COUNT(*)::int AS total FROM orders ${whereSql}`, params);
  const result = await query(
    `
      SELECT *
      FROM orders
      ${whereSql}
      ORDER BY created_at DESC
      OFFSET $${params.length + 1}
      LIMIT $${params.length + 2}
    `,
    [...params, offset, pageSize],
  );
  const data = await serializeOrdersWithItems(result.rows);
  res.json(paginated(data, { page, pageSize, total: count.rows[0].total }));
};

const setOrderStatus = async (orderId, status) => {
  if (!ORDER_STATUSES.includes(status)) throw new AppError(400, 'Invalid order status');
  const updated = await query(
    'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, orderId],
  );
  if (!updated.rows[0]) throw new AppError(404, 'Order not found');
  return getOrderPayload(orderId);
};

const setTrackingId = async (orderId, trackingId) => {
  if (!trackingId || String(trackingId).trim().length < 3) {
    throw new AppError(422, 'Tracking ID must be at least 3 characters');
  }
  const updated = await query(
    'UPDATE orders SET tracking_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [trackingId, orderId],
  );
  if (!updated.rows[0]) throw new AppError(404, 'Order not found');
  return getOrderPayload(orderId);
};

const setPaymentStatus = async (orderId, paymentStatus) => {
  if (!PAYMENT_STATUSES.includes(paymentStatus)) throw new AppError(400, 'Invalid payment status');
  const updated = await query(
    'UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [paymentStatus, orderId],
  );
  if (!updated.rows[0]) throw new AppError(404, 'Order not found');
  return getOrderPayload(orderId);
};

router.post(
  '',
  requireUser,
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const createdOrder = await withTransaction(async (client) => {
      const cart = await getOrCreateCart(req.user.id, client);
      const cartItems = await client.query(
        `
          SELECT ci.id, ci.product_id, ci.quantity, p.name, p.final_price, p.stock_qty, p.is_active
          FROM cart_items ci
          JOIN products p ON p.id = ci.product_id
          WHERE ci.cart_id = $1
          ORDER BY ci.id ASC
          FOR UPDATE OF p
        `,
        [cart.id],
      );
      if (!cartItems.rows.length) throw new AppError(400, 'Cart is empty');

      let shippingAddress = String(payload.shipping_address || '').trim();
      if (!shippingAddress) shippingAddress = composeUserAddress(req.user) || '';
      if (!shippingAddress) {
        throw new AppError(400, 'Complete your profile address before placing order');
      }

      let subtotal = 0;
      const preparedItems = [];
      for (const item of cartItems.rows) {
        if (!item.is_active) throw new AppError(400, 'Cart contains unavailable product');
        if (item.quantity > item.stock_qty) {
          throw new AppError(400, `Insufficient stock for ${item.name}`);
        }

        const lineTotal = Number((Number(item.final_price) * Number(item.quantity)).toFixed(2));
        subtotal += lineTotal;
        const afterQty = Number(item.stock_qty) - Number(item.quantity);

        await client.query(
          `
            UPDATE products
            SET stock_qty = $1, is_out_of_stock = $2, updated_at = NOW()
            WHERE id = $3
          `,
          [afterQty, afterQty <= 0, item.product_id],
        );
        await client.query(
          `
            INSERT INTO inventory_logs (
              product_id, action_type, change_qty, before_qty, after_qty,
              reason, reference_id, performed_by
            )
            VALUES ($1, 'ORDER_DEDUCT', $2, $3, $4, $5, NULL, $6)
          `,
          [
            item.product_id,
            -Number(item.quantity),
            Number(item.stock_qty),
            afterQty,
            `Order deduction for ${req.user.email}`,
            req.user.id,
          ],
        );

        preparedItems.push({
          product_id: item.product_id,
          product_name_snapshot: item.name,
          unit_price: item.final_price,
          quantity: item.quantity,
          line_total: lineTotal,
        });
      }

      const total = Number((subtotal + DELIVERY_FEE).toFixed(2));
      const order = await client.query(
        `
          INSERT INTO orders (
            user_id, order_number, status, payment_method, payment_status,
            shipping_address, subtotal, delivery_fee, total
          )
          VALUES ($1, $2, 'PENDING', 'COD', 'PENDING', $3, $4, $5, $6)
          RETURNING *
        `,
        [req.user.id, orderNumber(), shippingAddress, subtotal.toFixed(2), DELIVERY_FEE, total],
      );

      for (const item of preparedItems) {
        await client.query(
          `
            INSERT INTO order_items (
              order_id, product_id, product_name_snapshot, unit_price, quantity, line_total
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            order.rows[0].id,
            item.product_id,
            item.product_name_snapshot,
            item.unit_price,
            item.quantity,
            item.line_total,
          ],
        );
      }

      await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
      return getOrderPayload(order.rows[0].id, client);
    });

    res.status(201).json(createdOrder);
  }),
);

router.get(
  '/admin/all',
  ...requireAdmin,
  asyncHandler(async (req, res) => listOrders({ req, res, admin: true })),
);

router.get(
  '',
  requireUser,
  asyncHandler(async (req, res) => listOrders({ req, res })),
);

router.get(
  '/:orderId',
  requireUser,
  asyncHandler(async (req, res) => {
    const order = await getOne('SELECT * FROM orders WHERE id = $1', [Number(req.params.orderId)]);
    if (!order) throw new AppError(404, 'Order not found');
    if (order.user_id !== req.user.id && !ADMIN_ROLES.includes(req.user.role)) {
      throw new AppError(403, 'Not allowed');
    }
    res.json(await getOrderPayload(order.id));
  }),
);

router.post(
  '/:orderId/cancel',
  requireUser,
  asyncHandler(async (req, res) => {
    const orderId = Number(req.params.orderId);
    const payload = await withTransaction(async (client) => {
      const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
      const order = orderResult.rows[0];
      if (!order) throw new AppError(404, 'Order not found');
      if (order.user_id !== req.user.id) throw new AppError(403, 'Not allowed');

      const cancellable = ['PENDING', 'ACCEPTED', 'PLACED', 'CONFIRMED'];
      if (!cancellable.includes(order.status)) throw new AppError(400, 'Order cannot be cancelled');

      await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [
        'CANCELLED',
        orderId,
      ]);
      const items = await client.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
      for (const item of items.rows) {
        if (!item.product_id) continue;
        const productResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [
          item.product_id,
        ]);
        const product = productResult.rows[0];
        if (!product) continue;
        const afterQty = Number(product.stock_qty) + Number(item.quantity);
        await client.query(
          `
            UPDATE products
            SET stock_qty = $1, is_out_of_stock = $2, updated_at = NOW()
            WHERE id = $3
          `,
          [afterQty, afterQty <= 0, product.id],
        );
        await client.query(
          `
            INSERT INTO inventory_logs (
              product_id, action_type, change_qty, before_qty, after_qty,
              reason, reference_id, performed_by
            )
            VALUES ($1, 'ORDER_RESTORE', $2, $3, $4, $5, $6, $7)
          `,
          [
            product.id,
            Number(item.quantity),
            Number(product.stock_qty),
            afterQty,
            `Order cancellation ${order.order_number}`,
            order.order_number,
            req.user.id,
          ],
        );
      }
      return getOrderPayload(orderId, client);
    });
    res.json(payload);
  }),
);

router.patch(
  '/:orderId/status',
  ...requireManager,
  asyncHandler(async (req, res) => {
    res.json(await setOrderStatus(Number(req.params.orderId), req.body?.status));
  }),
);

router.patch(
  '/:orderId/tracking',
  ...requireManager,
  asyncHandler(async (req, res) => {
    res.json(await setTrackingId(Number(req.params.orderId), req.body?.tracking_id));
  }),
);

router.patch(
  '/:orderId/payment-status',
  ...requireManager,
  asyncHandler(async (req, res) => {
    res.json(await setPaymentStatus(Number(req.params.orderId), req.body?.payment_status));
  }),
);

router.delete(
  '/:orderId',
  ...requireManager,
  asyncHandler(async (req, res) => {
    const result = await query('DELETE FROM orders WHERE id = $1 RETURNING id', [
      Number(req.params.orderId),
    ]);
    if (!result.rows[0]) throw new AppError(404, 'Order not found');
    res.status(204).send();
  }),
);

export default router;
