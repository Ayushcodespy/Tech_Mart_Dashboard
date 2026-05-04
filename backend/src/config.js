import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const env = (name, fallback) => {
  const groceryName = `GROCERY_${name}`;
  return process.env[groceryName] ?? process.env[name] ?? fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const parseJsonList = (value, fallback) => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
};

export const settings = {
  appName: env('APP_NAME', 'Fresh Fruits & Vegetables API'),
  storeName: env('STORE_NAME', 'TechMart'),
  apiV1Prefix: env('API_V1_PREFIX', '/api/v1'),
  debug: parseBoolean(env('DEBUG', 'false')),
  databaseUrl: env(
    'DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/grocery_db',
  ),
  databaseSchema: env('DATABASE_SCHEMA', 'public'),
  jwtSecretKey: env('JWT_SECRET_KEY', 'change-me-in-production'),
  jwtAlgorithm: env('JWT_ALGORITHM', 'HS256'),
  accessTokenExpireMinutes: Number(env('ACCESS_TOKEN_EXPIRE_MINUTES', '15')),
  refreshTokenExpireDays: Number(env('REFRESH_TOKEN_EXPIRE_DAYS', '7')),
  corsOrigins: parseJsonList(env('CORS_ORIGINS', '["*"]'), ['*']),
  port: Number(env('PORT', '8000')),
  host: env('HOST', '0.0.0.0'),
  storageRoot: path.resolve(env('STORAGE_ROOT', 'storage')),
  databaseSsl: parseBoolean(env('DATABASE_SSL', 'false')),
  smtpHost: env('SMTP_HOST', ''),
  smtpPort: Number(env('SMTP_PORT', '587')),
  smtpUsername: env('SMTP_USERNAME', ''),
  smtpPassword: env('SMTP_PASSWORD', ''),
  smtpFromEmail: env('SMTP_FROM_EMAIL', ''),
  smtpFromName: env('SMTP_FROM_NAME', 'TechMart'),
  smtpUseTls: parseBoolean(env('SMTP_USE_TLS', 'true')),
  smtpUseSsl: parseBoolean(env('SMTP_USE_SSL', 'false')),
  passwordResetCodeExpireMinutes: Number(env('PASSWORD_RESET_CODE_EXPIRE_MINUTES', '15')),
};

export const normalizeDatabaseUrl = (databaseUrl) => {
  try {
    const url = new URL(databaseUrl);
    const sslMode = url.searchParams.get('sslmode');
    if (sslMode === 'require' || sslMode === 'prefer') {
      url.searchParams.set('sslmode', 'no-verify');
    }
    return url.toString();
  } catch {
    return databaseUrl;
  }
};
