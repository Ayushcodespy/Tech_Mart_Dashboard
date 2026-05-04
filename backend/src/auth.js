import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { getOne, query } from './db.js';
import { AppError } from './errors.js';
import { settings } from './config.js';
import { ADMIN_ROLES, MANAGER_ROLES, SUPER_ADMIN_ROLES } from './utils.js';

const bcryptInput = (password) =>
  crypto.createHash('sha256').update(String(password), 'utf8').digest('base64');

export const hashPassword = async (password) => bcrypt.hash(bcryptInput(password), 12);

export const verifyPassword = async (plainPassword, hashedPassword) => {
  if (!hashedPassword) return false;
  return (
    (await bcrypt.compare(bcryptInput(plainPassword), hashedPassword)) ||
    (await bcrypt.compare(String(plainPassword), hashedPassword))
  );
};

const createToken = (subject, tokenType, expiresIn) =>
  jwt.sign(
    {
      sub: String(subject),
      type: tokenType,
    },
    settings.jwtSecretKey,
    {
      algorithm: settings.jwtAlgorithm,
      expiresIn,
    },
  );

export const createAccessToken = (subject) =>
  createToken(subject, 'access', `${settings.accessTokenExpireMinutes}m`);

export const createRefreshToken = (subject) =>
  createToken(subject, 'refresh', `${settings.refreshTokenExpireDays}d`);

export const decodeToken = (token) => {
  try {
    return jwt.verify(token, settings.jwtSecretKey, {
      algorithms: [settings.jwtAlgorithm],
    });
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
};

export const requireUser = async (req, _res, next) => {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new AppError(401, 'Could not validate credentials');
    }

    const payload = decodeToken(token);
    if (payload.type !== 'access' || !payload.sub) {
      throw new AppError(401, 'Could not validate credentials');
    }

    const user = await getOne('SELECT * FROM users WHERE id = $1', [Number(payload.sub)]);
    if (!user || !user.is_active) {
      throw new AppError(401, 'Could not validate credentials');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const requireRole = (roles, detail) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, detail));
  }
  return next();
};

export const requireAdmin = [requireUser, requireRole(ADMIN_ROLES, 'Admin access required')];
export const requireManager = [requireUser, requireRole(MANAGER_ROLES, 'Manager access required')];
export const requireSuperAdmin = [
  requireUser,
  requireRole(SUPER_ADMIN_ROLES, 'Super admin access required'),
];
export const requireProductDelete = [
  requireUser,
  requireRole(MANAGER_ROLES, 'Staff cannot delete products'),
];

export const validateRefreshToken = async (rawRefreshToken) => {
  const payload = decodeToken(rawRefreshToken);
  if (payload.type !== 'refresh') {
    throw new AppError(401, 'Invalid token type');
  }

  const tokenRow = await getOne('SELECT * FROM refresh_tokens WHERE token = $1', [rawRefreshToken]);
  if (!tokenRow) {
    throw new AppError(401, 'Refresh token revoked');
  }

  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    await query('DELETE FROM refresh_tokens WHERE id = $1', [tokenRow.id]);
    throw new AppError(401, 'Refresh token expired');
  }

  const user = await getOne('SELECT * FROM users WHERE id = $1', [tokenRow.user_id]);
  if (!user || !user.is_active) {
    throw new AppError(401, 'Invalid user');
  }

  return user;
};
