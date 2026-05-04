import { Router } from 'express';

import { requireAdmin, requireProductDelete } from '../auth.js';
import { getProductPayload, serializeProductsWithImages } from '../data.js';
import { getOne, query, withTransaction } from '../db.js';
import { AppError, asyncHandler } from '../errors.js';
import { deleteProductFiles, deleteProductsByIds } from '../productDeletion.js';
import { pickProvided, updateById } from '../sql.js';
import {
  computeFinalPrice,
  generateSku,
  isOutOfStock,
  paginated,
  paginationFromQuery,
  slugify,
} from '../utils.js';

const router = Router();
const normalizedCategoryId = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new AppError(400, 'Invalid category id');
  return parsed;
};

const productFields = [
  'category_id',
  'name',
  'slug',
  'sku',
  'description',
  'price',
  'discount_percent',
  'stock_qty',
  'low_stock_threshold',
  'image_url',
  'is_featured',
  'is_active',
];

router.get(
  '',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = paginationFromQuery(req.query);
    const where = ['is_active IS TRUE'];
    const params = [];

    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`name ILIKE $${params.length}`);
    }
    if (req.query.category_id) {
      params.push(Number(req.query.category_id));
      where.push(`category_id = $${params.length}`);
    }
    if (req.query.min_price !== undefined) {
      params.push(Number(req.query.min_price));
      where.push(`final_price >= $${params.length}`);
    }
    if (req.query.max_price !== undefined) {
      params.push(Number(req.query.max_price));
      where.push(`final_price <= $${params.length}`);
    }

    const whereSql = where.join(' AND ');
    const count = await query(`SELECT COUNT(*)::int AS total FROM products WHERE ${whereSql}`, params);
    const result = await query(
      `
        SELECT *
        FROM products
        WHERE ${whereSql}
        ORDER BY created_at DESC
        OFFSET $${params.length + 1}
        LIMIT $${params.length + 2}
      `,
      [...params, offset, pageSize],
    );
    const data = await serializeProductsWithImages(result.rows);
    res.json(paginated(data, { page, pageSize, total: count.rows[0].total }));
  }),
);

router.get(
  '/:productId',
  asyncHandler(async (req, res) => {
    const product = await getProductPayload(Number(req.params.productId));
    if (!product) throw new AppError(404, 'Product not found');
    res.json(product);
  }),
);

router.post(
  '',
  ...requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const categoryId = normalizedCategoryId(payload.category_id);
    const price = Number(payload.price);
    const discountPercent = Number(payload.discount_percent ?? 0);
    const stockQty = Number(payload.stock_qty);
    const slug = payload.slug || slugify(payload.name);
    const sku = payload.sku || generateSku();

    if (!payload.name || Number.isNaN(price) || Number.isNaN(stockQty)) {
      throw new AppError(422, 'Name, price and stock quantity are required');
    }
    if (price <= 0) throw new AppError(422, 'Price must be greater than 0');
    if (discountPercent < 0 || discountPercent > 90) {
      throw new AppError(422, 'Discount percent must be between 0 and 90');
    }
    if (categoryId !== null && !(await getOne('SELECT id FROM categories WHERE id = $1', [categoryId]))) {
      throw new AppError(404, 'Category not found');
    }
    if (await getOne('SELECT id FROM products WHERE slug = $1', [slug])) {
      throw new AppError(400, 'Product slug already exists');
    }
    if (await getOne('SELECT id FROM products WHERE sku = $1', [sku])) {
      throw new AppError(400, 'Product SKU already exists');
    }

    const created = await query(
      `
        INSERT INTO products (
          category_id, name, slug, sku, description, price, discount_percent,
          final_price, stock_qty, low_stock_threshold, image_url, is_featured,
          is_out_of_stock, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `,
      [
        categoryId,
        payload.name,
        slug,
        sku,
        payload.description ?? null,
        price,
        discountPercent,
        computeFinalPrice(price, discountPercent),
        stockQty,
        Number(payload.low_stock_threshold ?? 10),
        payload.image_url ?? null,
        Boolean(payload.is_featured ?? false),
        isOutOfStock(stockQty),
        payload.is_active ?? true,
      ],
    );
    res.status(201).json(await getProductPayload(created.rows[0].id));
  }),
);

router.patch(
  '/:productId',
  ...requireAdmin,
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const product = await getOne('SELECT * FROM products WHERE id = $1', [productId]);
    if (!product) throw new AppError(404, 'Product not found');

    const data = pickProvided(req.body || {}, productFields);
    if (data.category_id !== undefined) {
      data.category_id = normalizedCategoryId(data.category_id);
      if (data.category_id !== null) {
        const category = await getOne('SELECT id FROM categories WHERE id = $1', [data.category_id]);
        if (!category) throw new AppError(404, 'Category not found');
      }
    }
    if (data.slug && data.slug !== product.slug) {
      const duplicate = await getOne('SELECT id FROM products WHERE slug = $1 AND id <> $2', [
        data.slug,
        productId,
      ]);
      if (duplicate) throw new AppError(400, 'Product slug already exists');
    }
    if (data.sku && data.sku !== product.sku) {
      const duplicate = await getOne('SELECT id FROM products WHERE sku = $1 AND id <> $2', [
        data.sku,
        productId,
      ]);
      if (duplicate) throw new AppError(400, 'Product SKU already exists');
    }

    const price = Number(data.price ?? product.price);
    const discountPercent = Number(data.discount_percent ?? product.discount_percent);
    const stockQty = Number(data.stock_qty ?? product.stock_qty);
    data.final_price = computeFinalPrice(price, discountPercent);
    data.is_out_of_stock = isOutOfStock(stockQty);

    const updated = await updateById({ query }, 'products', productId, data);
    res.json(await getProductPayload(updated.id));
  }),
);

router.delete(
  '/:productId',
  ...requireProductDelete,
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new AppError(400, 'Invalid product id');
    }

    const payload = await withTransaction(async (client) => {
      const existing = await client.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [productId]);
      if (!existing.rows[0]) throw new AppError(404, 'Product not found');
      return deleteProductsByIds(client, [productId]);
    });

    await deleteProductFiles(payload.filePaths);
    if (!payload.deletedCount) throw new AppError(404, 'Product not found');
    res.status(204).send();
  }),
);

export default router;
