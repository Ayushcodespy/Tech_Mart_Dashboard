# User App SRS

## 1. Document Control

- Product: Fresh Fruits & Vegetables Grocery Commerce App
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: JWT with refresh tokens
- Platforms: Web and mobile browsers
- Audience: Developers, QA, Product, Operations

## 2. Purpose

This document defines the software requirements for the customer-facing grocery application. It covers the shopping journey from authentication to browsing, cart, checkout, orders, and profile management.

## 3. Product Overview

The user app is a grocery e-commerce application for fruits, vegetables, pantry items, and related products. It supports guest browsing, registered-user shopping, persistent sessions, profile management, cart management, and order tracking.

## 4. Goals

- Provide a fast grocery browsing and buying experience
- Support guest discovery without forcing login at entry
- Support simple COD checkout in the current phase
- Allow repeat purchasing with saved profile and address
- Keep the app mobile-first while remaining web-capable

## 5. In Scope

- Splash screen
- Guest browsing
- Registration and login
- JWT-based session persistence
- Product listing
- Category listing
- Search
- Product details
- Cart
- COD checkout
- Order history
- Order detail timeline
- Profile editing
- Saved address-based checkout
- Banner display

## 6. Out of Scope

- Online payment gateway
- Live delivery partner tracking
- Coupons and wallet
- Real wishlist backend if not yet implemented
- Multi-address book
- Returns workflow automation

## 7. Actors

### 7.1 Guest User

- Opens app
- Browses home, categories, search
- Gets redirected to login when trying protected actions

### 7.2 Registered User

- Logs in once
- Browses catalog
- Adds products to cart
- Completes profile and address
- Places COD order
- Views order history and details

## 8. Assumptions

- Backend is reachable by the app through configured API base URL
- Product catalog and categories are managed by admin
- COD is the only enabled payment mode in current release
- User provides a complete delivery address in profile before ordering

## 9. Functional Requirements

### 9.1 App Launch

- Show animated splash screen on app startup
- Continue from splash screen to app shell
- If user session is valid, keep user logged in

### 9.2 Authentication

- User can sign up with name, email, phone, and password
- User can log in with email and password
- Access token and refresh token must be stored securely
- Refresh token flow should renew session automatically
- User should not need to log in repeatedly unless tokens expire or are revoked

### 9.3 Guest Access Rules

- Guest can access:
  - Home
  - Categories
  - Search
  - Product detail
- Guest cannot directly access:
  - Cart
  - Wishlist
  - Account
  - Checkout
  - Orders
- On restricted action, app must redirect user to login

### 9.4 Home Page

- Show location placeholder or future location support area
- Show search bar
- Show promotional banners
- Show category shortcuts
- Show product sections:
  - Recommended
  - Featured
  - Trending
- Show cart badge when logged in

### 9.5 Banners

- App must fetch public active banners from backend
- Show banner image, title, and subtitle
- Ignore banners outside their active date range
- If no banners available, show fallback promo block

### 9.6 Categories

- Display admin-configured categories
- Display category icon configured by admin
- Show product count per category
- Open category-specific product listing on tap

### 9.7 Product Listing

- Show product image
- Show product name
- Show selling price
- Show availability
- Allow add-to-cart if stock exists
- Open detail screen on product tap

### 9.8 Product Detail

- Show product image
- Show name, price, stock status, and description
- Allow add-to-cart
- Show out-of-stock state if quantity is zero

### 9.9 Search

- Search by product name
- Keep recent searches locally
- Show trending items
- Allow direct add-to-cart from search results

### 9.10 Cart

- Show cart tab in bottom navigation
- Show cart item count badge
- Display cart items, quantity, unit price, and line total
- Support quantity increase and decrease
- Support item removal
- Show subtotal
- Allow navigation to checkout

### 9.11 Add-to-Cart Feedback

- On add-to-cart success, show top notification
- Notification must disappear quickly
- Notification should provide direct "Go to Cart" action

### 9.12 Checkout

- Show saved profile address
- If address is incomplete, block checkout and ask user to complete profile
- Payment methods section should show:
  - COD enabled
  - Other methods disabled as coming soon
- Place order via backend

### 9.13 Orders

- User can view order history
- User can open a specific order
- Order detail should show:
  - Order number
  - Status
  - Payment status
  - Tracking ID if present
  - Ordered items
  - Address
  - Price summary
  - Status timeline

### 9.14 Profile

- User can view personal information
- User can edit:
  - Full name
  - Phone
  - Address line 1
  - Address line 2
  - Landmark
  - City
  - State
  - Postal code
  - Country
- Profile menu items should be clickable

## 10. Non-Functional Requirements

### 10.1 Performance

- Home screen should load without noticeable delay under normal network conditions
- Search response should be near real-time
- App must handle network timeouts gracefully

### 10.2 Reliability

- Refresh token flow must recover from expired access tokens
- App must fail gracefully on backend downtime
- Error states must show retry actions

### 10.3 Usability

- Mobile-first layout
- Clear navigation
- Consistent product actions
- Minimal steps to place order

### 10.4 Security

- JWT access token required for protected endpoints
- Refresh token rotation supported
- Passwords never stored on client
- Sensitive data only fetched for authenticated user

### 10.5 Scalability

- Catalog and orders should be paginated
- Banner, category, and product assets should support future CDN/S3 migration

## 11. User Journey Flows

### 11.1 First-Time User Flow

1. User opens app
2. Splash screen appears
3. User proceeds to app shell
4. User browses catalog as guest
5. User tries add-to-cart
6. User redirected to login or signup
7. User completes profile
8. User adds to cart and checks out

### 11.2 Returning Logged-In User Flow

1. User opens app
2. Splash screen checks stored session
3. Refresh token renews access if needed
4. App opens directly to shell
5. User continues browsing or ordering

### 11.3 Browse to Order Flow

1. User opens home
2. Selects category or searches product
3. Opens product detail
4. Adds product to cart
5. Uses go-to-cart action or cart tab
6. Reviews cart
7. Proceeds to checkout
8. Confirms COD
9. Places order
10. Views order in order history

## 12. Data Flow

### 12.1 Authentication Data Flow

1. User app sends login payload to `/api/v1/auth/login`
2. Backend validates password
3. Backend returns access token and refresh token
4. App stores tokens
5. App calls `/api/v1/auth/me`
6. App stores user state in provider

### 12.2 Catalog Data Flow

1. App calls `/api/v1/categories`
2. App calls `/api/v1/products`
3. App calls `/api/v1/banners`
4. Backend returns paginated data
5. App hydrates UI state using repository and provider

### 12.3 Cart Data Flow

1. User taps add-to-cart
2. App calls protected cart endpoint
3. Backend updates user cart
4. Backend returns current cart snapshot
5. App updates cart provider and badge

### 12.4 Order Data Flow

1. User taps checkout
2. App verifies saved address
3. App sends order request to `/api/v1/orders`
4. Backend validates cart and stock
5. Backend creates order and deducts stock
6. Backend clears cart
7. App reloads order list and cart state

## 13. Major Screens

### 13.1 Splash Screen

- Branding
- Short animation
- Session bootstrapping

### 13.2 Login/Signup Screens

- Form validation
- Friendly error messages
- Loading states

### 13.4 Home Screen

- Search
- Banner carousel
- Category shortcuts
- Product rows

### 13.5 Categories Screen

- Grid of categories
- Icon + name + item count

### 13.6 Product Detail Screen

- Hero image
- Description
- Price
- Stock state
- Add-to-cart button

### 13.7 Cart Screen

- Item list
- Quantity controls
- Totals
- Checkout CTA

### 13.8 Checkout Screen

- Address review
- Payment method selection
- Place order CTA

### 13.9 Order History Screen

- Order list
- Status summary
- Amount

### 13.10 Order Detail Screen

- Timeline
- Items
- Address
- Payment and tracking info

### 13.11 Profile Screen

- Personal details
- Address summary
- Edit options
- Support/legal shortcuts

## 14. Data Entities Used by User App

### 14.1 User

- id
- email
- full_name
- phone
- role
- address fields

### 14.2 Category

- id
- name
- slug
- icon_name
- parent_id

### 14.3 Product

- id
- category_id
- name
- slug
- description
- price
- discount_percent
- final_price
- stock_qty
- image_url
- is_featured
- is_active

### 14.4 Banner

- id
- type
- title
- subtitle
- image_url
- redirect_url
- is_active
- start_date
- end_date

### 14.5 Cart

- user_id
- items[]
- subtotal

### 14.6 Order

- id
- order_number
- status
- payment_method
- payment_status
- tracking_id
- shipping_address
- subtotal
- delivery_fee
- total
- items[]

## 15. Key APIs Consumed by User App

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `GET /api/v1/categories`
- `GET /api/v1/products`
- `GET /api/v1/products/{id}`
- `GET /api/v1/banners`
- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `PATCH /api/v1/cart/items/{id}`
- `DELETE /api/v1/cart/items/{id}`
- `POST /api/v1/orders`
- `GET /api/v1/orders`
- `GET /api/v1/orders/{id}`

## 16. Error Handling Requirements

- Invalid login should show friendly message
- Network failure should show retry option
- Timeout should show connectivity message
- Protected actions should redirect to login
- Checkout with incomplete address should block order placement

## 17. Acceptance Criteria

- Guest user can browse without login
- Logged-in user can add items and place COD order
- Cart tab visible and functional
- Banner created in admin appears on home if active
- Category icon selected by admin renders in app
- Order timeline screen opens from order history

## 18. Future Enhancements

- Online payments
- Wallet and offers
- Multi-address support
- Wishlist persistence
- Reorder and subscription models
- Real-time order tracking
