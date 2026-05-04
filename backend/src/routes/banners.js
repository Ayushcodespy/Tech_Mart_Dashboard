import { Router } from 'express';

import { query } from '../db.js';
import { asyncHandler } from '../errors.js';
import { serializeBanner } from '../serializers.js';
import { BANNER_TYPES, paginated, paginationFromQuery } from '../utils.js';

const router = Router();

router.get(
  '',
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = paginationFromQuery(req.query);
    const where = [
      'is_active IS TRUE',
      '(start_date IS NULL OR start_date <= NOW())',
      '(end_date IS NULL OR end_date >= NOW())',
    ];
    const params = [];

    if (req.query.type) {
      if (!BANNER_TYPES.includes(req.query.type)) {
        return res.json(paginated([], { page, pageSize, total: 0 }));
      }
      params.push(req.query.type);
      where.push(`type = $${params.length}`);
    }

    const whereSql = where.join(' AND ');
    const count = await query(`SELECT COUNT(*)::int AS total FROM banners WHERE ${whereSql}`, params);
    const result = await query(
      `
        SELECT *
        FROM banners
        WHERE ${whereSql}
        ORDER BY display_order ASC, created_at DESC
        OFFSET $${params.length + 1}
        LIMIT $${params.length + 2}
      `,
      [...params, offset, pageSize],
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

export default router;
