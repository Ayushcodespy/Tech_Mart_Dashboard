import { Router } from 'express';

import { hashPassword, requireSuperAdmin, requireUser } from '../auth.js';
import { findUserByEmail } from '../data.js';
import { getOne, query, withTransaction } from '../db.js';
import { AppError, asyncHandler } from '../errors.js';
import { serializeUser } from '../serializers.js';
import { pickProvided, updateById } from '../sql.js';
import { paginationFromQuery, USER_ROLES } from '../utils.js';

const router = Router();
const USER_DELETE_STRATEGIES = new Set(['delete_related', 'set_null']);

const profileFields = [
  'phone',
  'full_name',
  'address_line1',
  'address_line2',
  'landmark',
  'city',
  'state',
  'postal_code',
  'country',
];

const normalizeDeleteStrategy = (value) => {
  if (!value) return null;
  const strategy = String(value).trim().toLowerCase();
  if (!USER_DELETE_STRATEGIES.has(strategy)) {
    throw new AppError(400, 'Invalid user delete option');
  }
  return strategy;
};

router.get(
  '',
  ...requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { pageSize, offset } = paginationFromQuery(req.query);
    const result = await query(
      `
        SELECT
          u.*,
          (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) AS order_count,
          (SELECT COUNT(*)::int FROM inventory_logs il WHERE il.performed_by = u.id) AS inventory_log_count,
          (SELECT COUNT(*)::int FROM activity_logs al WHERE al.actor_user_id = u.id) AS activity_log_count,
          (SELECT COUNT(*)::int FROM wishlist_items wi WHERE wi.user_id = u.id) AS wishlist_count
        FROM users u
        ORDER BY u.created_at DESC
        OFFSET $1 LIMIT $2
      `,
      [offset, pageSize],
    );
    res.json(result.rows.map(serializeUser));
  }),
);

router.post(
  '',
  ...requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { email, phone = null, full_name: fullName, password } = req.body || {};
    if (!email || !fullName || !password) {
      throw new AppError(422, 'Email, full name and password are required');
    }
    if (await findUserByEmail(email)) throw new AppError(400, 'Email already exists');

    const created = await query(
      `
        INSERT INTO users (email, phone, full_name, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [String(email).toLowerCase(), phone || null, fullName, await hashPassword(password)],
    );
    res.status(201).json(serializeUser(created.rows[0]));
  }),
);

router.get('/me', requireUser, (req, res) => {
  res.json(serializeUser(req.user));
});

router.patch(
  '/me',
  requireUser,
  asyncHandler(async (req, res) => {
    const data = pickProvided(req.body || {}, profileFields);
    const updated = await updateById({ query }, 'users', req.user.id, data);
    res.json(serializeUser(updated));
  }),
);

router.get(
  '/:userId',
  ...requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const user = await getOne('SELECT * FROM users WHERE id = $1', [Number(req.params.userId)]);
    if (!user) throw new AppError(404, 'User not found');
    res.json(serializeUser(user));
  }),
);

router.patch(
  '/:userId',
  ...requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const data = pickProvided(req.body || {}, [...profileFields, 'is_active']);
    const updated = await updateById({ query }, 'users', Number(req.params.userId), data);
    if (!updated) throw new AppError(404, 'User not found');
    res.json(serializeUser(updated));
  }),
);

router.delete(
  '/:userId',
  ...requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.userId);
    const strategy = normalizeDeleteStrategy(req.query.related_strategy);
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
          `User has linked details. Choose whether to delete related details or keep them and set the user to None.`,
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

router.patch(
  '/:userId/role',
  ...requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { role } = req.body || {};
    if (!USER_ROLES.includes(role)) throw new AppError(400, 'Invalid role');
    const updated = await updateById(
      { query },
      'users',
      Number(req.params.userId),
      { role },
    );
    if (!updated) throw new AppError(404, 'User not found');
    res.json(serializeUser(updated));
  }),
);

export default router;
