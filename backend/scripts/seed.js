import bcryptjs from 'bcryptjs';
import { initDatabase, query, pool } from '../src/db.js';

const passwordHash = await bcryptjs.hash('admin123', 12);

await initDatabase();

// Seed admin user
const adminEmail = 'admin@techmart.com';
await query(`
  INSERT INTO users (email, full_name, password_hash, role, phone, address_line1, city, state, postal_code)
  VALUES ($1, $2, $3, 'SUPER_ADMIN', '9876543210', '123 Admin Street', 'Mumbai', 'Maharashtra', '400001')
  ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role
`, [adminEmail, 'Super Admin', passwordHash]);

// Seed categories
const categories = [
  { name: 'Fresh Fruits', slug: 'fresh-fruits', icon: 'Apple', image: 'https://images.unsplash.com/photo-1610832958506-aa563681d32a?w=500' },
  { name: 'Fresh Vegetables', slug: 'fresh-vegetables', icon: 'Carrot', image: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=500' },
  { name: 'Dairy & Eggs', slug: 'dairy-eggs', icon: 'Milk', image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=500' },
  { name: 'Bakery', slug: 'bakery', icon: 'Croissant', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500' },
];

for (const cat of categories) {
  await query(`
    INSERT INTO categories (name, slug, icon_name, image_url)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      icon_name = EXCLUDED.icon_name,
      image_url = EXCLUDED.image_url
  `, [cat.name, cat.slug, cat.icon, cat.image]);
}

// Get category IDs
const catRows = await query(`SELECT id, slug FROM categories WHERE slug IN ('fresh-fruits', 'fresh-vegetables', 'dairy-eggs')`);
const catMap = Object.fromEntries(catRows.rows.map(r => [r.slug, r.id]));

// Seed products
const products = [
  { name: 'Fresh Apples (1kg)', slug: 'fresh-apples-1kg', sku: 'FRU-001', description: 'Crisp and juicy red apples sourced directly from Kashmir orchards.', price: 120, discount: 10, stock: 50, category: 'fresh-fruits', image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500', featured: true },
  { name: 'Banana Robusta (12 pcs)', slug: 'banana-robusta-12pcs', sku: 'FRU-002', description: 'Sweet and ripe bananas, perfect for smoothies and breakfast.', price: 60, discount: 0, stock: 80, category: 'fresh-fruits', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500', featured: false },
  { name: 'Organic Tomatoes (500g)', slug: 'organic-tomatoes-500g', sku: 'VEG-001', description: 'Farm-fresh organic tomatoes, rich in flavor and nutrients.', price: 40, discount: 5, stock: 60, category: 'fresh-vegetables', image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500', featured: true },
  { name: 'Fresh Spinach Bunch', slug: 'fresh-spinach-bunch', sku: 'VEG-002', description: 'Green and leafy spinach, freshly harvested.', price: 25, discount: 0, stock: 40, category: 'fresh-vegetables', image: 'https://images.unsplash.com/photo-1576045057995-560f33ffa0b9?w=500', featured: false },
  { name: 'Amul Milk (1L)', slug: 'amul-milk-1l', sku: 'DRY-001', description: 'Pasteurised full cream milk, rich in calcium and protein.', price: 68, discount: 0, stock: 100, category: 'dairy-eggs', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=500', featured: true },
  { name: 'Farm Fresh Eggs (30 pcs)', slug: 'farm-fresh-eggs-30pcs', sku: 'DRY-002', description: 'Brown eggs from free-range chickens.', price: 220, discount: 15, stock: 45, category: 'dairy-eggs', image: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=500', featured: false },
];

for (const p of products) {
  const finalPrice = Math.round(p.price * (1 - p.discount / 100) * 100) / 100;
  const result = await query(`
    INSERT INTO products (category_id, name, slug, sku, description, price, discount_percent, final_price, stock_qty, image_url, is_featured, low_stock_threshold)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 10)
    ON CONFLICT (slug) DO UPDATE SET
      category_id = EXCLUDED.category_id,
      name = EXCLUDED.name,
      sku = EXCLUDED.sku,
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      discount_percent = EXCLUDED.discount_percent,
      final_price = EXCLUDED.final_price,
      stock_qty = EXCLUDED.stock_qty,
      image_url = EXCLUDED.image_url,
      is_featured = EXCLUDED.is_featured
    RETURNING id
  `, [catMap[p.category], p.name, p.slug, p.sku, p.description, p.price, p.discount, finalPrice, p.stock, p.image, p.featured]);

  const productId = result.rows[0].id;

  await query(`
    INSERT INTO product_images (product_id, image_url, is_primary, sort_order)
    VALUES ($1, $2, true, 0)
    ON CONFLICT DO NOTHING
  `, [productId, p.image]);
}

console.log('Seed complete!');
console.log('Admin: admin@techmart.com / admin123');

await pool.end();
