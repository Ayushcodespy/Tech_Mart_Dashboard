import { Router } from 'express';

import { requireUser } from '../auth.js';
import { getCartPayload, getOrCreateCart } from '../data.js';
import { getOne, query } from '../db.js';
import { AppError, asyncHandler } from '../errors.js';

const router = Router();

router.get(
  '',
  requireUser,
  asyncHandler(async (req, res) => {
    res.json(await getCartPayload(req.user.id));
  }),
);

router.post(
  '/items',
  requireUser,
  asyncHandler(async (req, res) => {
    const { product_id: productId, quantity = 1 } = req.body || {};
    const qty = Number(quantity);
    if (!productId || qty < 1 || qty > 100) {
      throw new AppError(422, 'Valid product and quantity are required');
    }

    const product = await getOne('SELECT * FROM products WHERE id = $1', [Number(productId)]);
    if (!product || !product.is_active) throw new AppError(404, 'Product not found');
    if (qty > product.stock_qty) throw new AppError(400, 'Insufficient stock');

    const cart = await getOrCreateCart(req.user.id);
    const existing = await getOne(
      'SELECT * FROM cart_items WHERE cart_id = $1 AND product_id = $2',
      [cart.id, Number(productId)],
    );

    if (existing) {
      const newQty = existing.quantity + qty;
      if (newQty > product.stock_qty) throw new AppError(400, 'Insufficient stock');
      await query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [newQty, existing.id]);
    } else {
      await query(
        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)',
        [cart.id, Number(productId), qty],
      );
    }

    res.status(201).json(await getCartPayload(req.user.id));
  }),
);

router.patch(
  '/items/:itemId',
  requireUser,
  asyncHandler(async (req, res) => {
    const qty = Number(req.body?.quantity);
    if (qty < 1 || qty > 100) throw new AppError(422, 'Valid quantity is required');

    const cart = await getOrCreateCart(req.user.id);
    const item = await getOne('SELECT * FROM cart_items WHERE id = $1 AND cart_id = $2', [
      Number(req.params.itemId),
      cart.id,
    ]);
    if (!item) throw new AppError(404, 'Cart item not found');

    const product = await getOne('SELECT * FROM products WHERE id = $1', [item.product_id]);
    if (!product) throw new AppError(404, 'Product not found');
    if (qty > product.stock_qty) throw new AppError(400, 'Insufficient stock');

    await query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [qty, item.id]);
    res.json(await getCartPayload(req.user.id));
  }),
);

router.delete(
  '/items/:itemId',
  requireUser,
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req.user.id);
    const result = await query('DELETE FROM cart_items WHERE id = $1 AND cart_id = $2 RETURNING id', [
      Number(req.params.itemId),
      cart.id,
    ]);
    if (!result.rows[0]) throw new AppError(404, 'Cart item not found');
    res.json(await getCartPayload(req.user.id));
  }),
);

router.delete(
  '/clear',
  requireUser,
  asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req.user.id);
    await query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
    res.status(204).send();
  }),
);

export default router;
