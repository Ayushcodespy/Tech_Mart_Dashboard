import { Router } from 'express';

import { requireManager } from '../auth.js';
import { getOne, query, withTransaction } from '../db.js';
import { AppError, asyncHandler } from '../errors.js';
import { deleteProductFiles, deleteProductsByIds } from '../productDeletion.js';
import { serializeCategory } from '../serializers.js';
import { pickProvided, updateById } from '../sql.js';
import { deleteStoredFile, saveImage, upload } from '../upload.js';
import { paginated, paginationFromQuery } from '../utils.js';

const router = Router();
const categoryFields = ['name', 'slug', 'icon_name', 'parent_id'];
const CATEGORY_DELETE_STRATEGIES = new Set(['delete_products', 'set_null']);

const normalizedCategoryId = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new AppError(400, 'Invalid category id');
  return parsed;
};

const normalizedDeleteStrategy = (value) => {
  if (!value) return null;
  const strategy = String(value).trim().toLowerCase();
  if (!CATEGORY_DELETE_STRATEGIES.has(strategy)) {
    throw new AppError(400, 'Invalid category delete option');
  }
  return strategy;
};

const normalizeOptionalText = (value) => {
  if (value === undefined) return undefined;
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
};

const normalizeBoolean = (value) => {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

router.get(
  '',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = paginationFromQuery(req.query);
    const count = await query('SELECT COUNT(*)::int AS total FROM categories');
    const result = await query(
      `
        SELECT c.*, COUNT(p.id)::int AS product_count
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.id
        ORDER BY c.id ASC
        OFFSET $1 LIMIT $2
      `,
      [offset, pageSize],
    );
    res.json(
      paginated(result.rows.map(serializeCategory), {
        page,
        pageSize,
        total: count.rows[0].total,
      }),
    );
  }),
);

router.post(
  '',
  ...requireManager,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const {
      name: rawName,
      slug: rawSlug,
      icon_name: rawIconName = null,
      parent_id: rawParentId = null,
    } = req.body || {};
    const name = String(rawName || '').trim();
    const slug = String(rawSlug || '').trim();
    const iconName = normalizeOptionalText(rawIconName);
    const parentId = normalizedCategoryId(rawParentId);
    if (!name || !slug) throw new AppError(422, 'Category name and slug are required');
    if (await getOne('SELECT id FROM categories WHERE slug = $1', [slug])) {
      throw new AppError(400, 'Category slug already exists');
    }
    if (parentId !== null && !(await getOne('SELECT id FROM categories WHERE id = $1', [parentId]))) {
      throw new AppError(404, 'Parent category not found');
    }

    let imageUrl = null;
    try {
      if (req.file) {
        imageUrl = await saveImage(req.file, 'categories');
      }
      const created = await query(
        `
          INSERT INTO categories (name, slug, icon_name, image_url, parent_id)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `,
        [name, slug, iconName, imageUrl, parentId],
      );
      res.status(201).json(serializeCategory(created.rows[0]));
    } catch (error) {
      if (imageUrl) await deleteStoredFile(imageUrl);
      throw error;
    }
  }),
);

router.patch(
  '/:categoryId',
  ...requireManager,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const categoryId = Number(req.params.categoryId);
    const category = await getOne('SELECT * FROM categories WHERE id = $1', [categoryId]);
    if (!category) throw new AppError(404, 'Category not found');

    const data = pickProvided(req.body || {}, categoryFields);
    if (data.name !== undefined) data.name = String(data.name || '').trim();
    if (data.slug !== undefined) data.slug = String(data.slug || '').trim();
    if (data.icon_name !== undefined) data.icon_name = normalizeOptionalText(data.icon_name);
    if (data.name !== undefined && !data.name) {
      throw new AppError(422, 'Category name is required');
    }
    if (data.slug !== undefined && !data.slug) {
      throw new AppError(422, 'Category slug is required');
    }
    if (data.parent_id !== undefined) {
      data.parent_id = normalizedCategoryId(data.parent_id);
      if (data.parent_id === categoryId) {
        throw new AppError(400, 'Category cannot be its own parent');
      }
      if (
        data.parent_id !== null &&
        !(await getOne('SELECT id FROM categories WHERE id = $1', [data.parent_id]))
      ) {
        throw new AppError(404, 'Parent category not found');
      }
    }
    if (data.slug && data.slug !== category.slug) {
      const duplicate = await getOne('SELECT id FROM categories WHERE slug = $1 AND id <> $2', [
        data.slug,
        categoryId,
      ]);
      if (duplicate) throw new AppError(400, 'Category slug already exists');
    }

    const clearImage = normalizeBoolean(req.body?.clear_image);
    let nextImageUrl;
    if (req.file) {
      nextImageUrl = await saveImage(req.file, 'categories');
      data.image_url = nextImageUrl;
    } else if (clearImage) {
      data.image_url = null;
    }

    try {
      const updated = await updateById(
        { query },
        'categories',
        categoryId,
        data,
        { touchUpdatedAt: false },
      );
      if ((req.file || clearImage) && category.image_url && category.image_url !== updated?.image_url) {
        await deleteStoredFile(category.image_url);
      }
      res.json(serializeCategory(updated));
    } catch (error) {
      if (nextImageUrl) await deleteStoredFile(nextImageUrl);
      throw error;
    }
  }),
);

router.delete(
  '/:categoryId',
  ...requireManager,
  asyncHandler(async (req, res) => {
    const categoryId = Number(req.params.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new AppError(400, 'Invalid category id');
    }

    const strategy = normalizedDeleteStrategy(req.query.product_strategy);
    const payload = await withTransaction(async (client) => {
      const categoryResult = await client.query('SELECT * FROM categories WHERE id = $1 FOR UPDATE', [
        categoryId,
      ]);
      const category = categoryResult.rows[0];
      if (!category) throw new AppError(404, 'Category not found');

      const productResult = await client.query(
        'SELECT id FROM products WHERE category_id = $1 ORDER BY id ASC FOR UPDATE',
        [categoryId],
      );
      const productIds = productResult.rows.map((row) => row.id);

      if (productIds.length && !strategy) {
        throw new AppError(
          409,
          `Category has ${productIds.length} linked product(s). Choose whether to delete them or move them to None.`,
        );
      }

      await client.query('UPDATE categories SET parent_id = NULL WHERE parent_id = $1', [categoryId]);

      let deletedProducts = { deletedCount: 0, filePaths: [] };
      if (strategy === 'delete_products') {
        deletedProducts = await deleteProductsByIds(client, productIds);
      } else if (strategy === 'set_null') {
        await client.query(
          'UPDATE products SET category_id = NULL, updated_at = NOW() WHERE category_id = $1',
          [categoryId],
        );
      }

      const deleted = await client.query('DELETE FROM categories WHERE id = $1 RETURNING id', [categoryId]);
      return { deleted, deletedProducts, categoryImageUrl: category.image_url };
    });

    await deleteProductFiles(payload.deletedProducts.filePaths);
    await deleteStoredFile(payload.categoryImageUrl);
    if (!payload.deleted.rows[0]) throw new AppError(404, 'Category not found');
    res.status(204).send();
  }),
);

export default router;
