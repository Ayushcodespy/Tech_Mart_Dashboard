import { Router } from 'express';

import adminRouter from './admin.js';
import authRouter from './auth.js';
import bannersRouter from './banners.js';
import cartRouter from './cart.js';
import categoriesRouter from './categories.js';
import ordersRouter from './orders.js';
import productsRouter from './products.js';
import usersRouter from './users.js';
import wishlistRouter from './wishlist.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/banners', bannersRouter);
router.use('/categories', categoriesRouter);
router.use('/products', productsRouter);
router.use('/cart', cartRouter);
router.use('/wishlist', wishlistRouter);
router.use('/orders', ordersRouter);
router.use('/admin', adminRouter);

export default router;
