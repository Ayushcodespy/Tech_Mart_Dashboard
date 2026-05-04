import pg from 'pg';

import { normalizeDatabaseUrl, settings } from './config.js';

const { Pool, types } = pg;

types.setTypeParser(types.builtins.NUMERIC, (value) => (value === null ? null : Number(value)));

const connectionString = normalizeDatabaseUrl(settings.databaseUrl);
const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;
const schemaName = settings.databaseSchema || 'public';
const qualifiedName = (name) => `${quoteIdentifier(schemaName)}.${quoteIdentifier(name)}`;
const wantsSsl =
  settings.databaseSsl ||
  connectionString.includes('sslmode=require') ||
  /\.render\.com|\.neon\.tech|\.aivencloud\.com/.test(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: wantsSsl ? { rejectUnauthorized: false } : undefined,
  options: `-c search_path=${schemaName}`,
});

export const query = (text, params = []) => pool.query(text, params);

export const getOne = async (text, params = []) => {
  const result = await query(text, params);
  return result.rows[0] || null;
};

export const withTransaction = async (handler) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const createEnum = async (name, values) => {
  const quotedValues = values.map((value) => `'${value}'`).join(', ');
  const typeName = qualifiedName(name);
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = '${name}' AND n.nspname = '${schemaName}'
      ) THEN
        CREATE TYPE ${typeName} AS ENUM (${quotedValues});
      END IF;
    END$$
  `);

  for (const value of values) {
    await query(`ALTER TYPE ${typeName} ADD VALUE IF NOT EXISTS '${value}'`);
  }
};

export const initDatabase = async () => {
  await query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schemaName)}`);
  await query(`SET search_path TO ${quoteIdentifier(schemaName)}`);

  await createEnum('userrole', ['USER', 'STAFF', 'MANAGER', 'SUPER_ADMIN', 'ADMIN']);
  await createEnum('orderstatus', [
    'PENDING',
    'ACCEPTED',
    'PACKED',
    'SHIPPED',
    'REJECTED',
    'PLACED',
    'CONFIRMED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ]);
  await createEnum('paymentmethod', ['COD']);
  await createEnum('paymentstatus', ['PENDING', 'PAID', 'FAILED']);
  await createEnum('bannertype', ['HOME_SLIDER', 'OFFER', 'CATEGORY']);
  await createEnum('inventoryactiontype', [
    'MANUAL_ADD',
    'MANUAL_SUBTRACT',
    'ORDER_DEDUCT',
    'ORDER_RESTORE',
  ]);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(30) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(120) NOT NULL,
      address_line1 VARCHAR(255),
      address_line2 VARCHAR(255),
      landmark VARCHAR(120),
      city VARCHAR(120),
      state VARCHAR(120),
      postal_code VARCHAR(20),
      country VARCHAR(80),
      role userrole NOT NULL DEFAULT 'USER',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      slug VARCHAR(140) NOT NULL UNIQUE,
      icon_name VARCHAR(80),
      image_url VARCHAR(500),
      parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      name VARCHAR(150) NOT NULL,
      slug VARCHAR(170) NOT NULL UNIQUE,
      sku VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      price NUMERIC(10,2) NOT NULL,
      discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
      final_price NUMERIC(10,2) NOT NULL,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 10,
      image_url VARCHAR(500),
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      is_out_of_stock BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS product_images (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url VARCHAR(500) NOT NULL,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS carts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      CONSTRAINT uq_cart_product UNIQUE (cart_id, product_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(600) NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(120) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      order_number VARCHAR(30) NOT NULL UNIQUE,
      status orderstatus NOT NULL DEFAULT 'PLACED',
      payment_method paymentmethod NOT NULL DEFAULT 'COD',
      payment_status paymentstatus NOT NULL DEFAULT 'PENDING',
      tracking_id VARCHAR(120),
      shipping_address TEXT NOT NULL,
      subtotal NUMERIC(10,2) NOT NULL,
      delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      total NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name_snapshot VARCHAR(150) NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      quantity INTEGER NOT NULL,
      line_total NUMERIC(10,2) NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS banners (
      id SERIAL PRIMARY KEY,
      type bannertype NOT NULL DEFAULT 'HOME_SLIDER',
      image_url VARCHAR(500) NOT NULL,
      title VARCHAR(200) NOT NULL,
      subtitle TEXT,
      redirect_url VARCHAR(500),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      start_date TIMESTAMP,
      end_date TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS inventory_logs (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      action_type inventoryactiontype NOT NULL,
      change_qty INTEGER NOT NULL,
      before_qty INTEGER NOT NULL,
      after_qty INTEGER NOT NULL,
      reason TEXT,
      reference_id VARCHAR(100),
      performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(120) NOT NULL,
      entity_type VARCHAR(80) NOT NULL,
      entity_id VARCHAR(80) NOT NULL,
      metadata_json TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS wishlist_items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_wishlist_user_product UNIQUE (user_id, product_id)
    )
  `);

  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255)');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255)');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS landmark VARCHAR(120)');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(120)');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(120)');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20)');
  await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(80)');
  await query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'USER'");
  await query('ALTER TABLE users ALTER COLUMN is_active SET DEFAULT TRUE');
  await query('ALTER TABLE users ALTER COLUMN created_at SET DEFAULT NOW()');
  await query('ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT NOW()');
  await query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon_name VARCHAR(80)');
  await query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)');
  await query('ALTER TABLE categories ALTER COLUMN created_at SET DEFAULT NOW()');
  await query('ALTER TABLE products ALTER COLUMN category_id DROP NOT NULL');
  await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(50)');
  await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0 NOT NULL');
  await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS final_price NUMERIC(10,2)');
  await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10 NOT NULL');
  await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE NOT NULL');
  await query('ALTER TABLE products ADD COLUMN IF NOT EXISTS is_out_of_stock BOOLEAN DEFAULT FALSE NOT NULL');
  await query('ALTER TABLE products ALTER COLUMN is_active SET DEFAULT TRUE');
  await query('ALTER TABLE products ALTER COLUMN created_at SET DEFAULT NOW()');
  await query('ALTER TABLE products ALTER COLUMN updated_at SET DEFAULT NOW()');
  await query("UPDATE products SET final_price = price WHERE final_price IS NULL");
  await query("UPDATE products SET sku = CONCAT('PRD-', LPAD(id::text, 6, '0')) WHERE sku IS NULL");
  await query('ALTER TABLE products ALTER COLUMN final_price SET NOT NULL');
  await query('ALTER TABLE products ALTER COLUMN sku SET NOT NULL');
  await query('ALTER TABLE product_images ALTER COLUMN is_primary SET DEFAULT FALSE');
  await query('ALTER TABLE product_images ALTER COLUMN sort_order SET DEFAULT 0');
  await query('ALTER TABLE product_images ALTER COLUMN created_at SET DEFAULT NOW()');
  await query('ALTER TABLE carts ALTER COLUMN updated_at SET DEFAULT NOW()');
  await query('ALTER TABLE refresh_tokens ALTER COLUMN created_at SET DEFAULT NOW()');
  await query('ALTER TABLE password_reset_tokens ALTER COLUMN created_at SET DEFAULT NOW()');
  await query("ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'PLACED'");
  await query("ALTER TABLE orders ALTER COLUMN payment_method SET DEFAULT 'COD'");
  await query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status paymentstatus DEFAULT \'PENDING\' NOT NULL');
  await query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_id VARCHAR(120)');
  await query("ALTER TABLE orders ALTER COLUMN payment_status SET DEFAULT 'PENDING'");
  await query('ALTER TABLE orders ALTER COLUMN delivery_fee SET DEFAULT 0');
  await query('ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL');
  await query('ALTER TABLE orders ALTER COLUMN created_at SET DEFAULT NOW()');
  await query('ALTER TABLE orders ALTER COLUMN updated_at SET DEFAULT NOW()');
  await query('ALTER TABLE banners ALTER COLUMN is_active SET DEFAULT TRUE');
  await query('ALTER TABLE banners ALTER COLUMN display_order SET DEFAULT 0');
  await query('ALTER TABLE banners ALTER COLUMN created_at SET DEFAULT NOW()');
  await query('ALTER TABLE banners ALTER COLUMN updated_at SET DEFAULT NOW()');
  await query('ALTER TABLE inventory_logs ALTER COLUMN created_at SET DEFAULT NOW()');
  await query('ALTER TABLE activity_logs ALTER COLUMN created_at SET DEFAULT NOW()');
  await query('ALTER TABLE wishlist_items ALTER COLUMN created_at SET DEFAULT NOW()');
  await query(`
    DO $$
    DECLARE
      fk RECORD;
    BEGIN
      FOR fk IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_class ref ON ref.oid = con.confrelid
        JOIN unnest(con.conkey) AS keys(attnum) ON TRUE
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = keys.attnum
        WHERE con.contype = 'f'
          AND nsp.nspname = 'public'
          AND rel.relname = 'categories'
          AND ref.relname = 'categories'
          AND att.attname = 'parent_id'
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'categories', fk.conname);
      END LOOP;

      EXECUTE '
        ALTER TABLE categories
        ADD CONSTRAINT fk_categories_parent_id_categories
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      ';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END$$
  `);
  await query(`
    DO $$
    DECLARE
      fk RECORD;
    BEGIN
      FOR fk IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_class ref ON ref.oid = con.confrelid
        JOIN unnest(con.conkey) AS keys(attnum) ON TRUE
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = keys.attnum
        WHERE con.contype = 'f'
          AND nsp.nspname = 'public'
          AND rel.relname = 'products'
          AND ref.relname = 'categories'
          AND att.attname = 'category_id'
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'products', fk.conname);
      END LOOP;

      EXECUTE '
        ALTER TABLE products
        ADD CONSTRAINT fk_products_category_id_categories
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      ';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END$$
  `);
  await query(`
    DO $$
    DECLARE
      fk RECORD;
    BEGIN
      FOR fk IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_class ref ON ref.oid = con.confrelid
        JOIN unnest(con.conkey) AS keys(attnum) ON TRUE
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = keys.attnum
        WHERE con.contype = 'f'
          AND nsp.nspname = 'public'
          AND rel.relname = 'orders'
          AND ref.relname = 'users'
          AND att.attname = 'user_id'
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'orders', fk.conname);
      END LOOP;

      EXECUTE '
        ALTER TABLE orders
        ADD CONSTRAINT fk_orders_user_id_users
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END$$
  `);
  await query(`
    DO $$
    DECLARE
      fk RECORD;
    BEGIN
      FOR fk IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_class ref ON ref.oid = con.confrelid
        JOIN unnest(con.conkey) AS keys(attnum) ON TRUE
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = keys.attnum
        WHERE con.contype = 'f'
          AND nsp.nspname = 'public'
          AND rel.relname = 'inventory_logs'
          AND ref.relname = 'users'
          AND att.attname = 'performed_by'
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'inventory_logs', fk.conname);
      END LOOP;

      EXECUTE '
        ALTER TABLE inventory_logs
        ADD CONSTRAINT fk_inventory_logs_performed_by_users
        FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
      ';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END$$
  `);
  await query(`
    DO $$
    DECLARE
      fk RECORD;
    BEGIN
      FOR fk IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_class ref ON ref.oid = con.confrelid
        JOIN unnest(con.conkey) AS keys(attnum) ON TRUE
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = keys.attnum
        WHERE con.contype = 'f'
          AND nsp.nspname = 'public'
          AND rel.relname = 'activity_logs'
          AND ref.relname = 'users'
          AND att.attname = 'actor_user_id'
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', 'activity_logs', fk.conname);
      END LOOP;

      EXECUTE '
        ALTER TABLE activity_logs
        ADD CONSTRAINT fk_activity_logs_actor_user_id_users
        FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
      ';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END$$
  `);

  await query('CREATE INDEX IF NOT EXISTS ix_products_category_id ON products(category_id)');
  await query('CREATE INDEX IF NOT EXISTS ix_products_name ON products(name)');
  await query('CREATE INDEX IF NOT EXISTS ix_products_sku ON products(sku)');
  await query('CREATE INDEX IF NOT EXISTS ix_orders_user_id ON orders(user_id)');
  await query('CREATE INDEX IF NOT EXISTS ix_inventory_logs_product_id ON inventory_logs(product_id)');
  await query('CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id ON password_reset_tokens(user_id)');
  await query('CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_hash ON password_reset_tokens(token_hash)');
};
