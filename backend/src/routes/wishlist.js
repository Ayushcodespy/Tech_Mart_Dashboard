import { Router } from 'express';

import { requireUser } from '../auth.js';
import { serializeProductsWithImages } from '../data.js';
import { getOne, query } from '../db.js';
import { AppError, asyncHandler } from '../errors.js';
import { paginated, paginationFromQuery } from '../utils.js';

const router = Router();

router.get(
  '',
  requireUser,
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = paginationFromQuery(req.query);
    const count = await query(
      'SELECT COUNT(*)::int AS total FROM wishlist_items WHERE user_id = $1',
      [req.user.id],
    );
    const result = await query(
      `
        SELECT p.*
        FROM wishlist_items wi
        JOIN products p ON p.id = wi.product_id
        WHERE wi.user_id = $1
        ORDER BY wi.created_at DESC
        OFFSET $2
        LIMIT $3
      `,
      [req.user.id, offset, pageSize],
    );
    const data = await serializeProductsWithImages(result.rows);
    res.json(paginated(data, { page, pageSize, total: count.rows[0].total }));
  }),
);

router.post(
  '/:productId',
  requireUser,
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.productId);
    const product = await getOne('SELECT * FROM products WHERE id = $1', [productId]);
    if (!product || !product.is_active) throw new AppError(404, 'Product not found');

    const existing = await getOne(
      'SELECT id FROM wishlist_items WHERE user_id = $1 AND product_id = $2',
      [req.user.id, productId],
    );
    if (existing) return res.status(201).json({ success: true, message: 'Already in wishlist' });

    await query('INSERT INTO wishlist_items (user_id, product_id) VALUES ($1, $2)', [
      req.user.id,
      productId,
    ]);
    return res.status(201).json({ success: true, message: 'Added to wishlist' });
  }),
);

router.delete(
  '/:productId',
  requireUser,
  asyncHandler(async (req, res) => {
    const result = await query(
      'DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2 RETURNING id',
      [req.user.id, Number(req.params.productId)],
    );
    if (!result.rows[0]) throw new AppError(404, 'Wishlist item not found');
    res.json({ success: true, message: 'Removed from wishlist' });
  }),
);

export default router;
