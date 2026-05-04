import { Router } from 'express';
import crypto from 'crypto';

import {
  createAccessToken,
  createRefreshToken,
  hashPassword,
  requireUser,
  validateRefreshToken,
  verifyPassword,
} from '../auth.js';
import { findUserByEmail } from '../data.js';
import { query, withTransaction } from '../db.js';
import { AppError, asyncHandler } from '../errors.js';
import { serializeUser } from '../serializers.js';
import { settings } from '../config.js';
import { sendPasswordResetEmail } from '../mailer.js';

const router = Router();

const tokenExpiry = () =>
  new Date(Date.now() + settings.refreshTokenExpireDays * 24 * 60 * 60 * 1000);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const resetCodeExpiry = () =>
  new Date(Date.now() + settings.passwordResetCodeExpireMinutes * 60 * 1000);

const createResetCode = () => String(crypto.randomInt(100000, 1000000));

const hashResetCode = (code) =>
  crypto
    .createHash('sha256')
    .update(`${String(code || '').trim()}:${settings.jwtSecretKey}`)
    .digest('hex');

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, phone = null, full_name: fullName, password } = req.body || {};
    if (!email || !fullName || !password) {
      throw new AppError(422, 'Email, full name and password are required');
    }
    if (String(password).length < 8) {
      throw new AppError(422, 'Password must be at least 8 characters');
    }

    const existing = await findUserByEmail(email);
    if (existing) throw new AppError(400, 'Email already registered');

    const user = await withTransaction(async (client) => {
      const created = await client.query(
        `
          INSERT INTO users (email, phone, full_name, password_hash)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [String(email).toLowerCase(), phone || null, fullName, await hashPassword(password)],
      );
      await client.query('INSERT INTO carts (user_id) VALUES ($1)', [created.rows[0].id]);
      return created.rows[0];
    });

    res.status(201).json(serializeUser(user));
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const user = email ? await findUserByEmail(email) : null;
    if (!user || !(await verifyPassword(password || '', user.password_hash))) {
      throw new AppError(401, 'Invalid credentials');
    }

    const accessToken = createAccessToken(user.id);
    const refreshToken = createRefreshToken(user.id);
    await query(
      `
        INSERT INTO refresh_tokens (user_id, token, expires_at)
        VALUES ($1, $2, $3)
      `,
      [user.id, refreshToken, tokenExpiry()],
    );

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
    });
  }),
);

router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) throw new AppError(422, 'Email is required');

    const user = await findUserByEmail(email);
    if (!user) throw new AppError(404, 'Account not found for this email');

    const code = createResetCode();
    await withTransaction(async (client) => {
      await client.query(
        `
          UPDATE password_reset_tokens
          SET used_at = NOW()
          WHERE user_id = $1 AND used_at IS NULL
        `,
        [user.id],
      );
      await client.query(
        `
          INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
          VALUES ($1, $2, $3)
        `,
        [user.id, hashResetCode(code), resetCodeExpiry()],
      );
    });

    await sendPasswordResetEmail({
      email: user.email,
      fullName: user.full_name,
      code,
    });

    res.json({
      message: 'Password reset code sent to your email.',
      expires_in_minutes: settings.passwordResetCodeExpireMinutes,
    });
  }),
);

router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const { code, new_password: newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      throw new AppError(422, 'Email, reset code and new password are required');
    }
    if (String(newPassword).length < 8) {
      throw new AppError(422, 'Password must be at least 8 characters');
    }

    const user = await findUserByEmail(email);
    if (!user) throw new AppError(404, 'Account not found for this email');

    const resetToken = await query(
      `
        SELECT *
        FROM password_reset_tokens
        WHERE user_id = $1
          AND token_hash = $2
          AND used_at IS NULL
          AND expires_at > NOW()
        ORDER BY id DESC
        LIMIT 1
      `,
      [user.id, hashResetCode(code)],
    );

    const token = resetToken.rows[0];
    if (!token) throw new AppError(400, 'Invalid or expired reset code');

    await withTransaction(async (client) => {
      await client.query(
        `
          UPDATE users
          SET password_hash = $2, updated_at = NOW()
          WHERE id = $1
        `,
        [user.id, await hashPassword(newPassword)],
      );
      await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [token.id]);
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);
    });

    res.json({
      message: 'Password reset successful. Please login with your new password.',
    });
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refresh_token: refreshToken } = req.body || {};
    if (!refreshToken) throw new AppError(422, 'Refresh token is required');

    const user = await validateRefreshToken(refreshToken);
    const newAccess = createAccessToken(user.id);
    const newRefresh = createRefreshToken(user.id);

    await withTransaction(async (client) => {
      await client.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      await client.query(
        `
          INSERT INTO refresh_tokens (user_id, token, expires_at)
          VALUES ($1, $2, $3)
        `,
        [user.id, newRefresh, tokenExpiry()],
      );
    });

    res.json({
      access_token: newAccess,
      refresh_token: newRefresh,
      token_type: 'bearer',
    });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refresh_token: refreshToken } = req.body || {};
    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    res.json({ message: 'Logged out successfully' });
  }),
);

router.get('/me', requireUser, (req, res) => {
  res.json(serializeUser(req.user));
});

export default router;
