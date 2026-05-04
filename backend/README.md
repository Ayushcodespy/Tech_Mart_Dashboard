# Backend Setup (Node.js)

The active backend is a Node.js + Express API server:

- API base: `http://127.0.0.1:8000/api/v1`
- Health check: `GET http://127.0.0.1:8000/health`
- Admin web: `GET http://127.0.0.1:8000/admin`

## 1) Install dependencies

```powershell
cd backend
npm install
```

## 2) Configure env

```powershell
Copy-Item .env.example .env
```

`GROCERY_DATABASE_URL` accepts Node/Postgres URLs such as:

```env
GROCERY_DATABASE_URL=postgresql://postgres:1234@localhost:5432/grocery
GROCERY_STORE_NAME=TechMart
```

Change `GROCERY_STORE_NAME` to update the visible store name used by backend-rendered admin pages.

## 3) Run API

```powershell
npm run dev
```

For production:

```powershell
npm start
```

## API Namespaces

- `/api/v1/auth`
- `/api/v1/users`
- `/api/v1/categories`
- `/api/v1/products`
- `/api/v1/banners`
- `/api/v1/cart`
- `/api/v1/wishlist`
- `/api/v1/orders`
- `/api/v1/admin/products`
- `/api/v1/admin/banners`
- `/api/v1/admin/inventory`
- `/api/v1/admin/orders`
- `/api/v1/admin/dashboard`
- `/api/v1/admin/users`

## Notes

- Uploaded files are stored in `backend/storage`.
- The server creates or updates the PostgreSQL schema on startup for local bootstrap.
- The runnable backend entry point is `backend/src/server.js`.
