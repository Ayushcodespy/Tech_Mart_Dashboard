# Admin Panel SRS

## 1. Document Control

- Product: Fresh Fruits & Vegetables Admin Operations Panel
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: JWT
- Audience: Engineering, QA, Operations, Management

## 2. Purpose

This document defines the requirements for the admin and staff dashboard used to manage products, categories, banners, inventory, orders, users, and operational visibility.

## 3. Product Overview

The admin panel is a desktop-first operational dashboard for managing grocery commerce data and fulfillment workflows. It supports role-based access and provides visibility into orders, stock, product configuration, and promotional assets.

## 4. Goals

- Centralize operations in a single dashboard
- Support category, product, and banner management
- Enable order processing and status updates
- Provide at-a-glance business metrics and alerts
- Support staff, manager, and super admin workflows

## 5. In Scope

- JWT-based admin login
- Protected routes
- Dashboard analytics
- Category management
- Product management
- Banner management
- Inventory visibility
- Order management
- User role management
- File upload for banners and products
- Responsive desktop-first layout

## 6. Out of Scope

- Accounting integrations
- Delivery fleet management
- Vendor marketplace onboarding
- Multi-warehouse stock allocation
- Advanced BI exports

## 7. Actors

### 7.1 Staff

- View dashboard
- Manage products
- Manage inventory
- View and process orders
- Cannot perform restricted destructive actions if backend role rules deny

### 7.2 Manager

- Full operational management
- Manage products, banners, categories, inventory, and orders

### 7.3 Super Admin

- All manager capabilities
- Manage user roles
- Highest system access

## 8. Functional Requirements

### 8.1 Admin Authentication

- Admin logs in using the same backend auth system
- Admin session stored in browser local storage
- Protected routes require valid access token
- Unauthorized access redirects to login

### 8.2 Layout and Navigation

- Fixed sidebar on desktop
- Mobile overlay sidebar
- Header with workspace state and order badge
- Scroll only in content area, not whole app shell

### 8.3 Dashboard

- Show KPI cards:
  - Total orders
  - Pending orders
  - Total revenue
  - Low stock alerts
- Show latest incoming orders as cards
- Show revenue trend graph
- Show order status distribution
- Show top-selling products
- Show recent activity log
- Show active banners count

### 8.4 Category Management

- Create category
- Edit category
- Delete category
- Set category name
- Set category slug
- Set category icon
- Icon picker should support search using free searchable icon source
- Category list must show selected icon preview

### 8.5 Product Management

- Create product
- Assign category
- Set base price
- Set discount percentage
- Manage stock quantity
- Toggle active/disabled
- Toggle featured
- Upload main image
- Delete product if permitted by backend role
- View SKU and created date

### 8.6 Banner Management

- Create banner
- Upload image
- Set type
- Set title and subtitle
- Set redirect URL
- Set active state
- Set display order
- Set start and end dates
- Delete banner

### 8.7 Inventory Management

- Show low stock products
- Show inventory logs
- Support manual stock adjustment
- Show reasons and audit data when available

### 8.8 Orders Management

- View order list
- Filter/search by order details
- Update order status
- Update tracking ID
- Update payment status
- Surface pending/new order counts in header/dashboard

### 8.9 User Management

- List users
- Update user roles
- Delete users if backend policy allows
- Super admin only for sensitive user actions

## 9. Non-Functional Requirements

### 9.1 Usability

- Desktop-first, tablet/mobile-responsive
- Tables should remain readable on smaller screens
- Forms should give immediate validation feedback

### 9.2 Performance

- Dashboard should load summary and order data within acceptable time on local network
- Pagination required for heavy datasets

### 9.3 Security

- Protected routes
- JWT auth
- Backend-enforced RBAC
- File validation on upload
- CORS restricted to approved origins

### 9.4 Reliability

- UI should handle API failures gracefully
- Upload failures should show clear error
- Refresh actions should rehydrate data cleanly

## 10. Admin User Flows

### 10.1 Login Flow

1. Admin opens admin panel
2. Enters email and password
3. Frontend calls backend login API
4. Token stored in local storage
5. Frontend fetches current user
6. If authorized, dashboard opens

### 10.2 Create Category Flow

1. Admin opens Categories page
2. Enters category name and slug
3. Searches for icon
4. Selects icon from results
5. Saves category
6. Backend stores category metadata
7. Customer app fetches updated category icon later

### 10.3 Create Product Flow

1. Admin opens Products page
2. Creates base product with category, price, stock, and flags
3. Uploads main product image
4. Backend stores file path and product image reference
5. Admin verifies preview in product list
6. Customer app later loads image and product detail

### 10.4 Create Banner Flow

1. Admin opens Banners page
2. Uploads banner image
3. Sets title, subtitle, type, schedule, and status
4. Backend stores banner record
5. Public banners API returns active banners
6. User home screen renders banner carousel

### 10.5 Order Processing Flow

1. User places order from customer app
2. Backend creates order and deducts stock
3. Dashboard pending order count increases
4. Admin sees latest order card in header/dashboard
5. Admin updates order status through lifecycle
6. User sees updated timeline in order details

## 11. Data Flow

### 11.1 Category Data Flow

1. Admin creates/updates category through React form
2. Request sent to `/api/v1/categories`
3. Backend validates slug uniqueness
4. Backend stores name, slug, icon name
5. Customer app fetches categories and renders icon from saved icon name

### 11.2 Product Data Flow

1. Product metadata created via JSON API
2. Image uploaded via multipart endpoint
3. Backend stores image in local storage
4. Public product API exposes image path
5. Admin and user app convert relative path to full asset URL

### 11.3 Banner Data Flow

1. Banner created in admin panel
2. Backend stores file path and schedule fields
3. Public banners endpoint filters by active range
4. User app fetches active banners
5. Banner shown on home screen

### 11.4 Orders Data Flow

1. Order is created from cart
2. Backend updates inventory and order tables
3. Admin dashboard reads order metrics
4. Admin changes status/tracking/payment state
5. User app reads updated order details

## 12. Screens and Modules

### 12.1 Login Page

- Email/password form
- Friendly error handling
- Loading state

### 12.2 Dashboard Page

- KPI cards
- Latest orders
- Revenue graph
- Status chart
- Top sellers
- Activity log

### 12.3 Categories Page

- Category form
- Searchable icon picker
- Selected icon preview
- Category list with edit/delete

### 12.4 Products Page

- Filter/search
- Product table
- Price update
- Stock update
- Active/featured toggle
- Image upload
- Create modal

### 12.5 Orders Page

- Order list
- Search/filter
- Status updates
- Tracking updates
- Payment updates

### 12.6 Banners Page

- Banner form
- Date scheduling
- Image upload
- Active toggle
- Banner preview list

### 12.7 Inventory Page

- Low stock list
- Inventory logs
- Adjustment actions

### 12.8 Users Page

- User list
- Role changes
- Deletion

## 13. Data Entities Relevant to Admin

### 13.1 Category

- id
- name
- slug
- icon_name
- parent_id
- created_at

### 13.2 Product

- id
- category_id
- name
- slug
- sku
- description
- price
- discount_percent
- final_price
- stock_qty
- low_stock_threshold
- image_url
- is_featured
- is_out_of_stock
- is_active

### 13.3 ProductImage

- id
- product_id
- image_url
- is_primary
- sort_order

### 13.4 Banner

- id
- type
- image_url
- title
- subtitle
- redirect_url
- is_active
- display_order
- start_date
- end_date

### 13.5 Order

- id
- user_id
- order_number
- status
- payment_method
- payment_status
- tracking_id
- shipping_address
- subtotal
- delivery_fee
- total

### 13.6 InventoryLog

- product_id
- action_type
- before_qty
- after_qty
- performed_by
- reason

### 13.7 ActivityLog

- actor_user_id
- action
- entity_type
- entity_id
- metadata_json

## 14. Key APIs Used by Admin Panel

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/admin/dashboard/summary`
- `GET /api/v1/categories`
- `POST /api/v1/categories`
- `PATCH /api/v1/categories/{id}`
- `DELETE /api/v1/categories/{id}`
- `GET /api/v1/admin/products`
- `POST /api/v1/products`
- `PATCH /api/v1/products/{id}`
- `PATCH /api/v1/admin/products/{id}/price`
- `PATCH /api/v1/admin/products/{id}/stock`
- `PATCH /api/v1/admin/products/{id}/status`
- `PATCH /api/v1/admin/products/{id}/featured`
- `POST /api/v1/admin/products/{id}/images/main`
- `GET /api/v1/admin/orders`
- `PATCH /api/v1/admin/orders/{id}/status`
- `PATCH /api/v1/admin/orders/{id}/tracking`
- `PATCH /api/v1/admin/orders/{id}/payment-status`
- `GET /api/v1/admin/banners`
- `POST /api/v1/admin/banners`
- `PATCH /api/v1/admin/banners/{id}`
- `DELETE /api/v1/admin/banners/{id}`
- `GET /api/v1/admin/inventory/low-stock`
- `GET /api/v1/admin/inventory/logs`
- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/{id}/role`

## 15. Security Requirements

- Only authenticated admin users may access dashboard APIs
- Backend must enforce role permissions regardless of frontend visibility
- Uploaded files must be validated for type and size
- Tokens must never be exposed in URLs
- CORS must allow only intended frontend origins

## 16. Audit and Visibility

- Important admin actions should create activity entries
- Inventory changes should create inventory logs
- Dashboard should surface recent activity and low-stock risks

## 17. Acceptance Criteria

- Admin login succeeds with valid role-based account
- Sidebar remains fixed while content scrolls
- Header shows pending order count badge
- Category icon selected in admin persists and appears in user app
- Product image uploads appear in admin and user app
- Active banner appears in mobile app when within date range
- Order status updates are visible to end user

## 18. Future Enhancements

- Category image upload
- Drag-and-drop sort ordering
- Real-time order notifications
- Bulk import/export
- Advanced analytics and date-range filters
- Cloud storage migration for media
