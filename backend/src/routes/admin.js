import { Router } from 'express';

import { requireAdmin, requireManager, requireProductDelete, requireSuperAdmin } from '../auth.js';
import { getOrderPayload, getProductPayload, serializeOrdersWithItems, serializeProductsWithImages } from '../data.js';
import { getOne, query, withTransaction } from '../db.js';
import { AppError, asyncHandler } from '../errors.js';
import { serializeBanner, serializeInventoryLog, serializeUser } from '../serializers.js';
import { deleteStoredFile, saveImage, upload } from '../upload.js';
import {
  BANNER_TYPES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  computeFinalPrice,
  isOutOfStock,
  paginated,
  paginationFromQuery,
  parseIsoDate,
  toBool,
  USER_ROLES,
} from '../utils.js';

const router = Router();
const USER_DELETE_STRATEGIES = new Set(['delete_related', 'set_null']);

const normalizeUserDeleteStrategy = (value) => {
  if (!value) return null;
  const strategy = String(value).trim().toLowerCase();
  if (!USER_DELETE_STRATEGIES.has(strategy)) {
    throw new AppError(400, 'Invalid user delete option');
  }
  return strategy;
};

const reportWindow = (queryParams) => {
  const mode = queryParams.mode || 'day';
  const now = new Date();

  if (mode === 'month') {
    const month = queryParams.month || now.toISOString().slice(0, 7);
    const [year, monthIndex] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthIndex - 1, 1));
    const end = new Date(Date.UTC(year, monthIndex, 1));
    return { mode, label: month, start, end };
  }

  if (mode === 'range') {
    const dateFrom = queryParams.date_from || now.toISOString().slice(0, 10);
    const dateTo = queryParams.date_to || dateFrom;
    const start = new Date(`${dateFrom}T00:00:00.000Z`);
    const end = new Date(`${dateTo}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return { mode, label: `${dateFrom} to ${dateTo}`, start, end };
  }

  const date = queryParams.date || now.toISOString().slice(0, 10);
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { mode: 'day', label: date, start, end };
};

const listOrders = async (req, res) => {
  const { page, pageSize, offset } = paginationFromQuery(req.query);
  const where = [];
  const params = [];

  if (req.query.status_filter) {
    params.push(req.query.status_filter);
    where.push(`status = $${params.length}`);
  }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(order_number ILIKE $${params.length} OR shipping_address ILIKE $${params.length})`);
  }
  if (req.query.date_from) {
    params.push(new Date(req.query.date_from));
    where.push(`created_at >= $${params.length}`);
  }
  if (req.query.date_to) {
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

  res.json(
    paginated(await serializeOrdersWithItems(result.rows), {
      page,
      pageSize,
      total: count.rows[0].total,
    }),
  );
};

router.get(
  '/dashboard/summary',
  ...requireAdmin,
  asyncHandler(async (_req, res) => {
    const [
      totalOrders,
      pendingOrders,
      deliveredOrders,
      revenue,
      recentRevenue,
      lowStock,
      activeBanners,
      topProducts,
      recentActivity,
    ] = await Promise.all([
      query('SELECT COUNT(*)::int AS value FROM orders'),
      query("SELECT COUNT(*)::int AS value FROM orders WHERE status IN ('PENDING', 'PLACED')"),
      query("SELECT COUNT(*)::int AS value FROM orders WHERE status = 'DELIVERED'"),
      query("SELECT COALESCE(SUM(total), 0)::numeric AS value FROM orders WHERE status = 'DELIVERED'"),
      query(
        "SELECT COALESCE(SUM(total), 0)::numeric AS value FROM orders WHERE status = 'DELIVERED' AND created_at >= NOW() - INTERVAL '7 days'",
      ),
      query('SELECT COUNT(*)::int AS value FROM products WHERE stock_qty <= low_stock_threshold'),
      query('SELECT COUNT(*)::int AS value FROM banners WHERE is_active IS TRUE'),
      query(
        `
          SELECT id, name, stock_qty
          FROM products
          ORDER BY stock_qty ASC, created_at DESC
          LIMIT 5
        `,
      ),
      query(
        `
          SELECT id, action, entity_type, entity_id, created_at
          FROM activity_logs
          ORDER BY created_at DESC
          LIMIT 8
        `,
      ),
    ]);

    res.json({
      success: true,
      data: {
        total_orders: totalOrders.rows[0].value,
        pending_orders: pendingOrders.rows[0].value,
        delivered_orders: deliveredOrders.rows[0].value,
        total_revenue: Number(revenue.rows[0].value || 0),
        last_7_days_revenue: Number(recentRevenue.rows[0].value || 0),
        low_stock_alerts: lowStock.rows[0].value,
        active_banners: activeBanners.rows[0].value,
        top_selling_products: topProducts.rows,
        recent_activity: recentActivity.rows,
      },
    });
  }),
);

router.get(
  '/reports',
  ...requireAdmin,
  asyncHandler(async (req, res) => {
    const { mode, label, start, end } = reportWindow(req.query);
    const params = [start, end];

    const [totals, statusBreakdown, dayWise, topProducts, orders] = await Promise.all([
      query(
        `
          SELECT
            COUNT(*)::int AS total_orders,
            COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS delivered_orders,
            COUNT(*) FILTER (WHERE status IN ('PENDING', 'PLACED', 'ACCEPTED'))::int AS pending_orders,
            COUNT(*) FILTER (WHERE status IN ('CANCELLED', 'REJECTED'))::int AS cancelled_orders,
            COALESCE(SUM(total) FILTER (WHERE status = 'DELIVERED'), 0)::numeric AS revenue,
            COALESCE(AVG(total) FILTER (WHERE status = 'DELIVERED'), 0)::numeric AS average_order_value
          FROM orders
          WHERE created_at >= $1 AND created_at < $2
        `,
        params,
      ),
      query(
        `
          SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total), 0)::numeric AS total
          FROM orders
          WHERE created_at >= $1 AND created_at < $2
          GROUP BY status
          ORDER BY count DESC
        `,
        params,
      ),
      query(
        `
          SELECT
            to_char(created_at::date, 'YYYY-MM-DD') AS date,
            COUNT(*)::int AS orders,
            COALESCE(SUM(total) FILTER (WHERE status = 'DELIVERED'), 0)::numeric AS revenue
          FROM orders
          WHERE created_at >= $1 AND created_at < $2
          GROUP BY created_at::date
          ORDER BY created_at::date ASC
        `,
        params,
      ),
      query(
        `
          SELECT
            oi.product_id,
            oi.product_name_snapshot AS name,
            SUM(oi.quantity)::int AS quantity,
            COALESCE(SUM(oi.line_total), 0)::numeric AS revenue
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.created_at >= $1 AND o.created_at < $2
            AND o.status = 'DELIVERED'
          GROUP BY oi.product_id, oi.product_name_snapshot
          ORDER BY quantity DESC, revenue DESC
          LIMIT 10
        `,
        params,
      ),
      query(
        `
          SELECT *
          FROM orders
          WHERE created_at >= $1 AND created_at < $2
          ORDER BY created_at DESC
          LIMIT 50
        `,
        params,
      ),
    ]);

    res.json({
      success: true,
      data: {
        mode,
        label,
        start_date: start.toISOString().slice(0, 10),
        end_date: end.toISOString().slice(0, 10),
        totals: {
          total_orders: totals.rows[0].total_orders,
          delivered_orders: totals.rows[0].delivered_orders,
          pending_orders: totals.rows[0].pending_orders,
          cancelled_orders: totals.rows[0].cancelled_orders,
          revenue: Number(totals.rows[0].revenue || 0),
          average_order_value: Number(totals.rows[0].average_order_value || 0),
        },
        status_breakdown: statusBreakdown.rows.map((row) => ({
          status: row.status,
          count: row.count,
          total: Number(row.total || 0),
        })),
        day_wise: dayWise.rows.map((row) => ({
          date: row.date,
          orders: row.orders,
          revenue: Number(row.revenue || 0),
        })),
        top_products: topProducts.rows.map((row) => ({
          product_id: row.product_id,
          name: row.name,
          quantity: row.quantity,
          revenue: Number(row.revenue || 0),
        })),
        orders: await serializeOrdersWithItems(orders.rows),
      },
    });
  }),
);

router.get(
  '/products',
  ...requireManager,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = paginationFromQuery(req.query);
    const params = [];
    let whereSql = '';
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      whereSql = `WHERE name ILIKE $1 OR sku ILIKE $1`;
    }
    const count = await query(`SELECT COUNT(*)::int AS total FROM products ${whereSql}`, params);
    const result = await query(
      `
        SELECT *
        FROM products
        ${whereSql}
        ORDER BY created_at DESC
        OFFSET $${params.length + 1}
        LIMIT $${params.length + 2}
      `,
      [...params, offset, pageSize],
    );
    res.json(
      paginated(await serializeProductsWithImages(result.rows), {
        page,
        pageSize,
        total: count.rows[0].total,
      }),
    );
  }),
);

router.patch(
  '/products/:productId/stock',
  ...requireManager,
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const deltaQty = Number(req.body?.delta_qty);
    if (Number.isNaN(deltaQty)) throw new AppError(422, 'Delta quantity is required');

    const payload = await withTransaction(async (client) => {
      const productResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
      const product = productResult.rows[0];
      if (!product) throw new AppError(404, 'Product not found');
      const beforeQty = Number(product.stock_qty);
      const afterQty = beforeQty + deltaQty;
      if (afterQty < 0) throw new AppError(400, 'Stock cannot go below zero');

      await client.query(
        `
          UPDATE products
          SET stock_qty = $1, is_out_of_stock = $2, updated_at = NOW()
          WHERE id = $3
        `,
        [afterQty, isOutOfStock(afterQty), productId],
      );
      await client.query(
        `
          INSERT INTO inventory_logs (
            product_id, action_type, change_qty, before_qty, after_qty,
            reason, reference_id, performed_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, NULL, $7)
        `,
        [
          productId,
          deltaQty > 0 ? 'MANUAL_ADD' : 'MANUAL_SUBTRACT',
          deltaQty,
          beforeQty,
          afterQty,
          req.body?.reason ?? null,
          req.user.id,
        ],
      );
      await client.query(
        `
          INSERT INTO activity_logs (actor_user_id, action, entity_type, entity_id, metadata_json)
          VALUES ($1, 'PRODUCT_STOCK_ADJUST', 'product', $2, $3)
        `,
        [req.user.id, String(productId), `delta=${deltaQty}`],
      );
      return getProductPayload(productId, client);
    });

    res.json(payload);
  }),
);

router.patch(
  '/products/:productId/featured',
  ...requireManager,
  upload.none(),
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const updated = await query(
      'UPDATE products SET is_featured = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [toBool(req.body.value), productId],
    );
    if (!updated.rows[0]) throw new AppError(404, 'Product not found');
    res.json(await getProductPayload(productId));
  }),
);

router.patch(
  '/products/:productId/status',
  ...requireManager,
  upload.none(),
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const updated = await query(
      'UPDATE products SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [toBool(req.body.value), productId],
    );
    if (!updated.rows[0]) throw new AppError(404, 'Product not found');
    res.json(await getProductPayload(productId));
  }),
);

router.post(
  '/products/:productId/images/main',
  ...requireManager,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const product = await getOne('SELECT * FROM products WHERE id = $1', [productId]);
    if (!product) throw new AppError(404, 'Product not found');

    const publicUrl = await saveImage(req.file, 'products');
    if (product.image_url) await deleteStoredFile(product.image_url);

    await withTransaction(async (client) => {
      await client.query(
        'UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2',
        [publicUrl, productId],
      );
      await client.query(
        'UPDATE product_images SET is_primary = FALSE WHERE product_id = $1 AND is_primary IS TRUE',
        [productId],
      );
      await client.query(
        `
          INSERT INTO product_images (product_id, image_url, is_primary, sort_order)
          VALUES ($1, $2, TRUE, 0)
        `,
        [productId, publicUrl],
      );
      await client.query(
        `
          INSERT INTO activity_logs (actor_user_id, action, entity_type, entity_id, metadata_json)
          VALUES ($1, 'PRODUCT_MAIN_IMAGE_UPLOAD', 'product', $2, $3)
        `,
        [req.user.id, String(productId), publicUrl],
      );
    });

    res.json(await getProductPayload(productId));
  }),
);

router.post(
  '/products/:productId/images/gallery',
  ...requireManager,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const product = await getOne('SELECT id FROM products WHERE id = $1', [productId]);
    if (!product) throw new AppError(404, 'Product not found');

    const publicUrl = await saveImage(req.file, 'products');
    const created = await query(
      `
        INSERT INTO product_images (product_id, image_url, is_primary, sort_order)
        VALUES ($1, $2, FALSE, $3)
        RETURNING id, image_url
      `,
      [productId, publicUrl, Number(req.body?.sort_order ?? 0)],
    );
    res.status(201).json({ success: true, data: created.rows[0] });
  }),
);

router.delete(
  '/products/:productId/images/:imageId',
  ...requireProductDelete,
  asyncHandler(async (req, res) => {
    const { productId, imageId } = req.params;
    const image = await getOne(
      'SELECT * FROM product_images WHERE id = $1 AND product_id = $2',
      [Number(imageId), Number(productId)],
    );
    if (!image) throw new AppError(404, 'Image not found');
    await deleteStoredFile(image.image_url);
    await withTransaction(async (client) => {
      await client.query('DELETE FROM product_images WHERE id = $1', [image.id]);
      await client.query(
        `
          UPDATE products
          SET image_url = NULL, updated_at = NOW()
          WHERE id = $1 AND image_url = $2
        `,
        [Number(productId), image.image_url],
      );
    });
    res.status(204).send();
  }),
);

router.patch(
  '/products/:productId/price',
  ...requireManager,
  upload.none(),
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const price = Number(req.body.price);
    const discountPercent = Number(req.body.discount_percent ?? 0);
    if (price <= 0) throw new AppError(400, 'Price must be greater than 0');
    if (discountPercent < 0 || discountPercent > 90) {
      throw new AppError(400, 'Discount percent must be between 0 and 90');
    }

    const updated = await query(
      `
        UPDATE products
        SET price = $1, discount_percent = $2, final_price = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING id
      `,
      [price, discountPercent, computeFinalPrice(price, discountPercent), productId],
    );
    if (!updated.rows[0]) throw new AppError(404, 'Product not found');
    res.json(await getProductPayload(productId));
  }),
);

router.patch(
  '/products/:productId/enable',
  ...requireManager,
  upload.none(),
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const updated = await query(
      'UPDATE products SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [toBool(req.body.is_active), productId],
    );
    if (!updated.rows[0]) throw new AppError(404, 'Product not found');
    res.json(await getProductPayload(productId));
  }),
);

router.patch(
  '/products/:productId/out-of-stock',
  ...requireManager,
  upload.none(),
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const outOfStock = toBool(req.body.is_out_of_stock);
    const updated = await query(
      `
        UPDATE products
        SET is_out_of_stock = $1, stock_qty = CASE WHEN $1 THEN 0 ELSE stock_qty END, updated_at = NOW()
        WHERE id = $2
        RETURNING id
      `,
      [outOfStock, productId],
    );
    if (!updated.rows[0]) throw new AppError(404, 'Product not found');
    res.json(await getProductPayload(productId));
  }),
);

router.get(
  '/banners',
  ...requireManager,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = paginationFromQuery(req.query);
    const count = await query('SELECT COUNT(*)::int AS total FROM banners');
    const result = await query(
      `
        SELECT *
        FROM banners
        ORDER BY display_order ASC, created_at DESC
        OFFSET $1
        LIMIT $2
      `,
      [offset, pageSize],
    );
    res.json(
      paginated(result.rows.map(serializeBanner), {
        page,
        pageSize,
        total: count.rows[0].total,
      }),
    );
  }),
);

router.post(
  '/banners',
  ...requireManager,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const type = req.body.type || 'HOME_SLIDER';
    if (!BANNER_TYPES.includes(type)) throw new AppError(400, 'Invalid banner type');
    if (!req.body.title) throw new AppError(422, 'Banner title is required');

    const publicUrl = await saveImage(req.file, 'banners');
    const created = await query(
      `
        INSERT INTO banners (
          type, image_url, title, subtitle, redirect_url, is_active,
          display_order, start_date, end_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        type,
        publicUrl,
        req.body.title,
        req.body.subtitle || null,
        req.body.redirect_url || null,
        req.body.is_active === undefined ? true : toBool(req.body.is_active),
        Number(req.body.display_order ?? 0),
        parseIsoDate(req.body.start_date),
        parseIsoDate(req.body.end_date),
      ],
    );
    res.status(201).json(serializeBanner(created.rows[0]));
  }),
);

router.patch(
  '/banners/:bannerId',
  ...requireManager,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const bannerId = Number(req.params.bannerId);
    const banner = await getOne('SELECT * FROM banners WHERE id = $1', [bannerId]);
    if (!banner) throw new AppError(404, 'Banner not found');

    const updates = {};
    if (req.body.type !== undefined) {
      if (!BANNER_TYPES.includes(req.body.type)) throw new AppError(400, 'Invalid banner type');
      updates.type = req.body.type;
    }
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.subtitle !== undefined) updates.subtitle = req.body.subtitle || null;
    if (req.body.redirect_url !== undefined) updates.redirect_url = req.body.redirect_url || null;
    if (req.body.is_active !== undefined) updates.is_active = toBool(req.body.is_active);
    if (req.body.display_order !== undefined) updates.display_order = Number(req.body.display_order);
    if (req.body.start_date !== undefined) updates.start_date = parseIsoDate(req.body.start_date);
    if (req.body.end_date !== undefined) updates.end_date = parseIsoDate(req.body.end_date);

    if (req.file) {
      updates.image_url = await saveImage(req.file, 'banners');
      await deleteStoredFile(banner.image_url);
    }

    const entries = Object.entries(updates);
    if (!entries.length) return res.json(serializeBanner(banner));
    entries.push(['updated_at', new Date()]);
    const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
    const params = entries.map(([, value]) => value);
    params.push(bannerId);
    const updated = await query(
      `
        UPDATE banners
        SET ${assignments.join(', ')}
        WHERE id = $${params.length}
        RETURNING *
      `,
      params,
    );
    return res.json(serializeBanner(updated.rows[0]));
  }),
);

router.delete(
  '/banners/:bannerId',
  ...requireManager,
  asyncHandler(async (req, res) => {
    const banner = await getOne('SELECT * FROM banners WHERE id = $1', [Number(req.params.bannerId)]);
    if (!banner) throw new AppError(404, 'Banner not found');
    await deleteStoredFile(banner.image_url);
    await query('DELETE FROM banners WHERE id = $1', [banner.id]);
    res.status(204).send();
  }),
);

router.get(
  '/inventory/logs',
  ...requireManager,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = paginationFromQuery(req.query);
    const params = [];
    let whereSql = '';
    if (req.query.product_id) {
      params.push(Number(req.query.product_id));
      whereSql = 'WHERE product_id = $1';
    }
    const count = await query(`SELECT COUNT(*)::int AS total FROM inventory_logs ${whereSql}`, params);
    const result = await query(
      `
        SELECT *
        FROM inventory_logs
        ${whereSql}
        ORDER BY created_at DESC
        OFFSET $${params.length + 1}
        LIMIT $${params.length + 2}
      `,
      [...params, offset, pageSize],
    );
    res.json(
      paginated(result.rows.map(serializeInventoryLog), {
        page,
        pageSize,
        total: count.rows[0].total,
      }),
    );
  }),
);

router.get(
  '/inventory/low-stock',
  ...requireManager,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = paginationFromQuery(req.query);
    const count = await query(
      'SELECT COUNT(*)::int AS total FROM products WHERE stock_qty <= low_stock_threshold',
    );
    const result = await query(
      `
        SELECT id, name, sku, stock_qty, low_stock_threshold
        FROM products
        WHERE stock_qty <= low_stock_threshold
        ORDER BY stock_qty ASC
        OFFSET $1
        LIMIT $2
      `,
      [offset, pageSize],
    );
    res.json(paginated(result.rows, { page, pageSize, total: count.rows[0].total }));
  }),
);

router.post(
  '/inventory/adjust',
  ...requireManager,
  asyncHandler(async (req, res) => {
    const productId = Number(req.body?.product_id);
    const deltaQty = Number(req.body?.delta_qty);
    if (!productId || !deltaQty) throw new AppError(422, 'Product and delta quantity are required');

    const log = await withTransaction(async (client) => {
      const productResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
      const product = productResult.rows[0];
      if (!product) throw new AppError(404, 'Product not found');

      const beforeQty = Number(product.stock_qty);
      const afterQty = beforeQty + deltaQty;
      if (afterQty < 0) throw new AppError(400, 'Stock cannot go below 0');

      await client.query(
        `
          UPDATE products
          SET stock_qty = $1, is_out_of_stock = $2, updated_at = NOW()
          WHERE id = $3
        `,
        [afterQty, isOutOfStock(afterQty), productId],
      );
      const created = await client.query(
        `
          INSERT INTO inventory_logs (
            product_id, action_type, change_qty, before_qty, after_qty,
            reason, reference_id, performed_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, NULL, $7)
          RETURNING *
        `,
        [
          productId,
          deltaQty > 0 ? 'MANUAL_ADD' : 'MANUAL_SUBTRACT',
          deltaQty,
          beforeQty,
          afterQty,
          req.body?.reason ?? null,
          req.user.id,
        ],
      );
      return created.rows[0];
    });

    res.json({ success: true, data: serializeInventoryLog(log) });
  }),
);

router.get(
  '/orders',
  ...requireAdmin,
  asyncHandler(async (req, res) => listOrders(req, res)),
);

router.get(
  '/orders/:orderId',
  ...requireManager,
  asyncHandler(async (req, res) => {
    const order = await getOrderPayload(Number(req.params.orderId));
    if (!order) throw new AppError(404, 'Order not found');
    res.json(order);
  }),
);

router.patch(
  '/orders/:orderId/status',
  ...requireManager,
  asyncHandler(async (req, res) => {
    if (!ORDER_STATUSES.includes(req.body?.status)) throw new AppError(400, 'Invalid order status');
    const updated = await query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [req.body.status, Number(req.params.orderId)],
    );
    if (!updated.rows[0]) throw new AppError(404, 'Order not found');
    res.json(await getOrderPayload(Number(req.params.orderId)));
  }),
);

router.patch(
  '/orders/:orderId/tracking',
  ...requireManager,
  asyncHandler(async (req, res) => {
    const trackingId = req.body?.tracking_id;
    if (!trackingId || String(trackingId).trim().length < 3) {
      throw new AppError(422, 'Tracking ID must be at least 3 characters');
    }
    const updated = await query(
      'UPDATE orders SET tracking_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [trackingId, Number(req.params.orderId)],
    );
    if (!updated.rows[0]) throw new AppError(404, 'Order not found');
    res.json(await getOrderPayload(Number(req.params.orderId)));
  }),
);

router.patch(
  '/orders/:orderId/payment-status',
  ...requireManager,
  asyncHandler(async (req, res) => {
    if (!PAYMENT_STATUSES.includes(req.body?.payment_status)) {
      throw new AppError(400, 'Invalid payment status');
    }
    const updated = await query(
      'UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [req.body.payment_status, Number(req.params.orderId)],
    );
    if (!updated.rows[0]) throw new AppError(404, 'Order not found');
    res.json(await getOrderPayload(Number(req.params.orderId)));
  }),
);

router.get(
  '/users',
  ...requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = paginationFromQuery(req.query);
    const count = await query('SELECT COUNT(*)::int AS total FROM users');
    const result = await query(
      `
        SELECT
          u.*,
          (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) AS order_count,
          (SELECT COUNT(*)::int FROM inventory_logs il WHERE il.performed_by = u.id) AS inventory_log_count,
          (SELECT COUNT(*)::int FROM activity_logs al WHERE al.actor_user_id = u.id) AS activity_log_count,
          (SELECT COUNT(*)::int FROM wishlist_items wi WHERE wi.user_id = u.id) AS wishlist_count
        FROM users u
        ORDER BY created_at DESC
        OFFSET $1
        LIMIT $2
      `,
      [offset, pageSize],
    );
    res.json(
      paginated(result.rows.map(serializeUser), {
        page,
        pageSize,
        total: count.rows[0].total,
      }),
    );
  }),
);

router.patch(
  '/users/:userId/role',
  ...requireSuperAdmin,
  asyncHandler(async (req, res) => {
    if (!USER_ROLES.includes(req.body?.role)) throw new AppError(400, 'Invalid role');
    const updated = await query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [req.body.role, Number(req.params.userId)],
    );
    if (!updated.rows[0]) throw new AppError(404, 'User not found');
    res.json(serializeUser(updated.rows[0]));
  }),
);

router.delete(
  '/users/:userId',
  ...requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const strategy = normalizeUserDeleteStrategy(req.query.related_strategy);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError(400, 'Invalid user id');
    }
    if (req.user.id === userId) {
      throw new AppError(400, 'You cannot delete your own account while logged in');
    }

    const result = await withTransaction(async (client) => {
      const existing = await client.query(
        `
          SELECT
            u.id,
            (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) AS order_count,
            (SELECT COUNT(*)::int FROM inventory_logs il WHERE il.performed_by = u.id) AS inventory_log_count,
            (SELECT COUNT(*)::int FROM activity_logs al WHERE al.actor_user_id = u.id) AS activity_log_count
          FROM users u
          WHERE u.id = $1
          FOR UPDATE
        `,
        [userId],
      );
      const user = existing.rows[0];
      if (!user) throw new AppError(404, 'User not found');

      const relatedCount =
        Number(user.order_count || 0) +
        Number(user.inventory_log_count || 0) +
        Number(user.activity_log_count || 0);

      if (relatedCount > 0 && !strategy) {
        throw new AppError(
          409,
          'User has linked details. Choose whether to delete related details or keep them and set the user to None.',
        );
      }

      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM wishlist_items WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM carts WHERE user_id = $1', [userId]);

      if (strategy === 'delete_related') {
        await client.query('DELETE FROM orders WHERE user_id = $1', [userId]);
        await client.query('DELETE FROM inventory_logs WHERE performed_by = $1', [userId]);
        await client.query('DELETE FROM activity_logs WHERE actor_user_id = $1', [userId]);
      } else {
        await client.query('UPDATE orders SET user_id = NULL WHERE user_id = $1', [userId]);
        await client.query('UPDATE inventory_logs SET performed_by = NULL WHERE performed_by = $1', [userId]);
        await client.query('UPDATE activity_logs SET actor_user_id = NULL WHERE actor_user_id = $1', [userId]);
      }

      return client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    });
    if (!result.rows[0]) throw new AppError(404, 'User not found');
    res.status(204).send();
  }),
);

export default router;
